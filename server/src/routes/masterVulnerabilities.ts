import { Router } from 'express'
import multer from 'multer'
import { parse } from 'csv-parse/sync'
import { pool } from '../db/pool'

const router = Router()
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } })

// Find or create a master vulnerability, then create a discovery record.
// Race-safety: uses a transaction + row lock so two simultaneous inserts
// for the same finding on the same asset cannot both create duplicate masters.
router.post('/discover', async (req, res) => {
  const { assessment_id, asset_id, title, cve_id, severity, cvss_score, diagnosis, solution, discovered_by, is_draft,
    source_type, repository_master_id, vrn, cwe_id, category, impact } = req.body

  if (!assessment_id || !asset_id || !title?.trim() || !severity) {
    return res.status(400).json({ error: 'assessment_id, asset_id, title, and severity are required' })
  }

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    const assessmentResult = await client.query('SELECT publish_on_the_go FROM assessments WHERE id = $1', [assessment_id])
    const publishOnTheGo = assessmentResult.rows[0]?.publish_on_the_go === true
    const shouldBeDraft = publishOnTheGo ? false : (is_draft !== false)

    // Lock any matching master row for this asset to prevent a race between two simultaneous punches
    const matchResult = await client.query(
      `SELECT * FROM master_vulnerabilities WHERE asset_id = $1 AND (cve_id = $2::varchar OR title = $3) AND is_active = true FOR UPDATE`,
      [asset_id, cve_id || null, title.trim()]
    )

    let masterVuln = matchResult.rows[0]
    let discoveryType: 'Original' | 'Also Found' = 'Original'

    if (masterVuln) {
      // Master already exists — this is a re-discovery (multi-vendor "Also Found", or a re-assessment update)
      discoveryType = 'Also Found'
      await client.query(
        `UPDATE master_vulnerabilities SET severity = $1, cvss_score = $2, diagnosis = $3, solution = $4, updated_by = 'system', updated_at = NOW() WHERE id = $5`,
        [severity, cvss_score || null, diagnosis || null, solution || null, masterVuln.id]
      )
    } else {
      const created = await client.query(
        `INSERT INTO master_vulnerabilities
         (title, cve_id, severity, cvss_score, diagnosis, solution, asset_id, source_type, repository_master_id, vrn, cwe_id, category, impact, created_by, updated_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'system', 'system') RETURNING *`,
        [title.trim(), cve_id || null, severity, cvss_score || null, diagnosis || null, solution || null, asset_id,
         source_type || 'S', repository_master_id || null, vrn || null, cwe_id || null, category || null, impact || null]
      )
      masterVuln = created.rows[0]
    }

    const discovery = await client.query(
      `INSERT INTO vulnerability_discoveries (master_vuln_id, assessment_id, discovery_type, snapshot_title, snapshot_severity, snapshot_cvss_score, snapshot_diagnosis, snapshot_solution, snapshot_status, is_draft, discovered_by, published_via, created_by, updated_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'Open', $9, $10, $11, 'system', 'system') RETURNING *`,
      [masterVuln.id, assessment_id, discoveryType, title.trim(), severity, cvss_score || null, diagnosis || null, solution || null, shouldBeDraft, discovered_by || 'system', publishOnTheGo ? 'Auto' : 'Manual']
    )

    await client.query('COMMIT')
    res.status(201).json({ master: masterVuln, discovery: discovery.rows[0], discoveryType, autoPublished: publishOnTheGo })
  } catch (err) {
    await client.query('ROLLBACK')
    console.error(err)
    res.status(500).json({ error: 'failed to log finding' })
  } finally {
    client.release()
  }
})

// Main Vulnerabilities list — one row per discovery, joined to its master record,
// asset, and application. Drafts are excluded (nothing to act on until published).
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        d.id AS discovery_id, d.master_vuln_id, d.snapshot_title AS title,
        d.snapshot_severity AS severity, d.snapshot_cvss_score AS cvss_score,
        d.ticket_status, d.assignment_status, d.assigned_owner,
        d.compliance_status, d.compliance_expiry_date, d.reopen_count,
        d.verdict_l1_status, d.created_at AS discovered_at,
        m.cve_id, m.vrn, m.source_type, m.category, m.risk_score, m.inherent_risk,
        m.residual_risk, m.cisa_kev, m.exploit_available, m.occurrence_count,
        a.id AS asset_id, a.hostname, a.criticality AS asset_tier, a.exposure,
        app.app_name
      FROM vulnerability_discoveries d
      JOIN master_vulnerabilities m ON m.id = d.master_vuln_id
      JOIN assets a ON a.id = m.asset_id
      LEFT JOIN applications app ON app.id = a.application_id
      WHERE d.is_active = true AND d.is_draft = false
      ORDER BY d.id DESC
    `)
    res.json(result.rows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'failed to fetch vulnerabilities' })
  }
})

router.post('/sync-threat-intel', async (req, res) => {
  try {
    const { enrichThreatIntelligence } = await import('../services/threatIntelEnrichment')
    const result = await enrichThreatIntelligence()
    res.json(result)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'failed to sync threat intelligence' })
  }
})

router.post('/recalculate-risk', async (req, res) => {
  try {
    const { recalculateAllRiskScores } = await import('../services/riskRecalcScheduler')
    const result = await recalculateAllRiskScores()
    res.json(result)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'failed to recalculate risk scores' })
  }
})

router.get('/summary', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT a.id AS assessment_id, a.assessment_code, a.assessment_name, a.status, a.updated_at,
        COUNT(d.id) AS total_findings,
        COUNT(*) FILTER (WHERE d.snapshot_severity = 'Critical') AS critical_count,
        COUNT(*) FILTER (WHERE d.snapshot_severity = 'High') AS high_count,
        COUNT(*) FILTER (WHERE d.snapshot_severity = 'Medium') AS medium_count,
        COUNT(*) FILTER (WHERE d.snapshot_severity = 'Low') AS low_count,
        COUNT(*) FILTER (WHERE d.ticket_status = 'Closed') AS remediated_count,
        COUNT(*) FILTER (WHERE d.verdict_status = 'Approved') AS false_positive_count,
        COUNT(*) FILTER (WHERE d.is_draft = true) AS draft_count
       FROM assessments a
       LEFT JOIN vulnerability_discoveries d ON d.assessment_id = a.id AND d.is_active = true
       WHERE a.is_active = true
       GROUP BY a.id, a.assessment_code, a.assessment_name, a.status, a.updated_at
       ORDER BY a.id DESC`
    )
    res.json(result.rows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'failed to fetch summary' })
  }
})

router.get('/all', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT d.*, m.cve_id, m.asset_id, a.assessment_code, a.assessment_name, a.assessment_type
       FROM vulnerability_discoveries d
       JOIN master_vulnerabilities m ON m.id = d.master_vuln_id
       JOIN assessments a ON a.id = d.assessment_id
       WHERE d.is_active = true ORDER BY d.id DESC`
    )
    res.json(result.rows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'failed to fetch all findings' })
  }
})

// Full detail for one discovery — used by the Vulnerability Detail Drawer
// Update manual-entry compliance/reference fields on a master vulnerability
router.put('/:id/compliance-fields', async (req, res) => {
  const { cert_in_ref, rbi_audit_ref, pci_ref, owasp, sans25, stride, capec_wasc_id, vendor_advisory_id } = req.body

  try {
    const result = await pool.query(
      `UPDATE master_vulnerabilities SET
        cert_in_ref = COALESCE($1, cert_in_ref),
        rbi_audit_ref = COALESCE($2, rbi_audit_ref),
        pci_ref = COALESCE($3, pci_ref),
        owasp = COALESCE($4, owasp),
        sans25 = COALESCE($5, sans25),
        stride = COALESCE($6, stride),
        capec_wasc_id = COALESCE($7, capec_wasc_id),
        vendor_advisory_id = COALESCE($8, vendor_advisory_id),
        updated_at = NOW()
       WHERE id = $9 RETURNING *`,
      [cert_in_ref, rbi_audit_ref, pci_ref, owasp, sans25, stride, capec_wasc_id, vendor_advisory_id, req.params.id]
    )
    if (result.rows.length === 0) return res.status(404).json({ error: 'not found' })
    res.json(result.rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'failed to update compliance fields' })
  }
})

// Compensating Controls Master — list all active controls
router.get('/compensating-controls', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM compensating_controls_master WHERE is_active = true ORDER BY control_name ASC`
    )
    res.json(result.rows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'failed to fetch compensating controls' })
  }
})

// Get controls currently applied to a specific finding
router.get('/:id/applied-controls', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT ac.id, ac.applied_by, ac.applied_at, cm.id AS control_id, cm.control_name, cm.discount_percent
       FROM vulnerability_applied_controls ac
       JOIN compensating_controls_master cm ON cm.id = ac.control_id
       WHERE ac.master_vuln_id = $1 ORDER BY ac.applied_at ASC`,
      [req.params.id]
    )
    res.json(result.rows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'failed to fetch applied controls' })
  }
})

// Apply a compensating control to a finding -> recalculates and stores Residual Risk
router.post('/:id/applied-controls', async (req, res) => {
  const { control_id, applied_by } = req.body
  if (!control_id || !applied_by?.trim()) {
    return res.status(400).json({ error: 'control_id and applied_by are required' })
  }

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    const vulnResult = await client.query('SELECT risk_score FROM master_vulnerabilities WHERE id = $1', [req.params.id])
    if (vulnResult.rows.length === 0) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'not found' }) }

    await client.query(
      `INSERT INTO vulnerability_applied_controls (master_vuln_id, control_id, applied_by) VALUES ($1, $2, $3)
       ON CONFLICT (master_vuln_id, control_id) DO NOTHING`,
      [req.params.id, control_id, applied_by.trim()]
    )

    const controlsResult = await client.query(
      `SELECT cm.discount_percent FROM vulnerability_applied_controls ac
       JOIN compensating_controls_master cm ON cm.id = ac.control_id
       WHERE ac.master_vuln_id = $1`,
      [req.params.id]
    )

    const totalDiscount = Math.min(
      controlsResult.rows.reduce((sum, r) => sum + Number(r.discount_percent), 0),
      50
    )
    const inherentRisk = Number(vulnResult.rows[0].risk_score) || 0
    const residualRisk = Math.round(inherentRisk * (1 - totalDiscount / 100))

    await client.query(
      `UPDATE master_vulnerabilities SET residual_risk = $1, updated_at = NOW() WHERE id = $2`,
      [residualRisk, req.params.id]
    )

    await client.query('COMMIT')
    res.status(201).json({ total_discount_percent: totalDiscount, inherent_risk: inherentRisk, residual_risk: residualRisk })
  } catch (err) {
    await client.query('ROLLBACK')
    console.error(err)
    res.status(500).json({ error: 'failed to apply control' })
  } finally {
    client.release()
  }
})

// Remove a compensating control from a finding -> recalculates Residual Risk
router.delete('/applied-controls/:appliedId', async (req, res) => {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    const appliedResult = await client.query('SELECT master_vuln_id FROM vulnerability_applied_controls WHERE id = $1', [req.params.appliedId])
    if (appliedResult.rows.length === 0) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'not found' }) }
    const masterVulnId = appliedResult.rows[0].master_vuln_id

    await client.query('DELETE FROM vulnerability_applied_controls WHERE id = $1', [req.params.appliedId])

    const vulnResult = await client.query('SELECT risk_score FROM master_vulnerabilities WHERE id = $1', [masterVulnId])
    const controlsResult = await client.query(
      `SELECT cm.discount_percent FROM vulnerability_applied_controls ac
       JOIN compensating_controls_master cm ON cm.id = ac.control_id
       WHERE ac.master_vuln_id = $1`,
      [masterVulnId]
    )

    const totalDiscount = Math.min(controlsResult.rows.reduce((sum, r) => sum + Number(r.discount_percent), 0), 50)
    const inherentRisk = Number(vulnResult.rows[0].risk_score) || 0
    const residualRisk = controlsResult.rows.length > 0 ? Math.round(inherentRisk * (1 - totalDiscount / 100)) : null

    await client.query(`UPDATE master_vulnerabilities SET residual_risk = $1, updated_at = NOW() WHERE id = $2`, [residualRisk, masterVulnId])

    await client.query('COMMIT')
    res.json({ success: true, residual_risk: residualRisk })
  } catch (err) {
    await client.query('ROLLBACK')
    console.error(err)
    res.status(500).json({ error: 'failed to remove control' })
  } finally {
    client.release()
  }
})

router.get('/:id/url-locations', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM vulnerability_url_locations WHERE master_vuln_id = $1 AND is_active = true ORDER BY id ASC`,
      [req.params.id]
    )
    res.json(result.rows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'failed to fetch url locations' })
  }
})

router.post('/:id/url-locations', async (req, res) => {
  const { url, reported_by } = req.body
  if (!url?.trim()) return res.status(400).json({ error: 'url is required' })

  try {
    const result = await pool.query(
      `INSERT INTO vulnerability_url_locations (master_vuln_id, url, reported_by) VALUES ($1, $2, $3) RETURNING *`,
      [req.params.id, url.trim(), reported_by || null]
    )
    res.status(201).json(result.rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'failed to add url location' })
  }
})

router.put('/url-locations/:locationId/status', async (req, res) => {
  const { status } = req.body
  if (!['Open', 'Fixed', 'Not Applicable'].includes(status)) {
    return res.status(400).json({ error: 'status must be Open, Fixed, or Not Applicable' })
  }
  try {
    const result = await pool.query(
      `UPDATE vulnerability_url_locations SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [status, req.params.locationId]
    )
    if (result.rows.length === 0) return res.status(404).json({ error: 'not found' })
    res.json(result.rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'failed to update status' })
  }
})

router.delete('/url-locations/:locationId', async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE vulnerability_url_locations SET is_active = false WHERE id = $1 RETURNING id`,
      [req.params.locationId]
    )
    if (result.rows.length === 0) return res.status(404).json({ error: 'not found' })
    res.json({ success: true })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'failed to remove url location' })
  }
})

router.get('/discovery/:id', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        d.*, d.snapshot_title AS title, d.snapshot_severity AS severity,
        d.snapshot_cvss_score AS cvss_score,
        m.cve_id, m.vrn, m.cwe_id, m.source_type, m.category, m.ease_of_exploitation,
        m.cia_impact, m.ext_reference, m.owasp, m.sans25, m.stride, m.pci_ref,
        m.cert_in_ref, m.rbi_audit_ref, m.exploit_available, m.cisa_kev, m.occurrence_count,
        m.inherent_risk, m.residual_risk, m.risk_score, m.impact AS master_impact, m.risk_type_justification,
        m.good_reads, m.compensating_control, m.asset_id,
        m.vulnerability_no, m.capec_wasc_id, m.vendor_advisory_id, m.target_url_location,
        m.epss_score, m.epss_percentile, m.cisa_ransomware,
        a.hostname, a.criticality AS asset_tier, a.exposure, a.ip_address, a.owner AS asset_owner,
        app.app_name, app.app_tier, app.is_sox_scoped
      FROM vulnerability_discoveries d
      JOIN master_vulnerabilities m ON m.id = d.master_vuln_id
      JOIN assets a ON a.id = m.asset_id
      LEFT JOIN applications app ON app.id = a.application_id
      WHERE d.id = $1
    `, [req.params.id])

    if (result.rows.length === 0) return res.status(404).json({ error: 'not found' })

    const auditResult = await pool.query(
      `SELECT * FROM vulnerability_audit_log WHERE discovery_id = $1 ORDER BY created_at ASC`,
      [req.params.id]
    )

    const exceptionResult = await pool.query(
      `SELECT * FROM vulnerability_exceptions WHERE discovery_id = $1 ORDER BY id DESC LIMIT 1`,
      [req.params.id]
    )

    res.json({ ...result.rows[0], audit_history: auditResult.rows, latest_exception: exceptionResult.rows[0] || null })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'failed to fetch discovery detail' })
  }
})

router.get('/assessment/:assessmentId', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT d.*, m.cve_id, m.asset_id FROM vulnerability_discoveries d
       JOIN master_vulnerabilities m ON m.id = d.master_vuln_id
       WHERE d.assessment_id = $1 AND d.is_active = true ORDER BY d.id ASC`,
      [req.params.assessmentId]
    )
    res.json(result.rows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'failed to fetch findings' })
  }
})

router.put('/discovery/:id/publish', async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE vulnerability_discoveries SET is_draft = false, published_via = 'Manual', updated_by = 'system', updated_at = NOW() WHERE id = $1 RETURNING *`,
      [req.params.id]
    )
    if (result.rows.length === 0) return res.status(404).json({ error: 'not found' })
    res.json(result.rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'failed to publish finding' })
  }
})

router.put('/discovery/:id/request-verdict', async (req, res) => {
  const { verdict, requested_by } = req.body
  if (verdict !== 'False Positive') return res.status(400).json({ error: 'only False Positive verdict is currently supported' })

  try {
    const existing = await pool.query('SELECT snapshot_severity FROM vulnerability_discoveries WHERE id = $1', [req.params.id])
    if (existing.rows.length === 0) return res.status(404).json({ error: 'not found' })
    const needsL2 = ['Critical', 'High'].includes(existing.rows[0].snapshot_severity)

    const result = await pool.query(
      `UPDATE vulnerability_discoveries SET verdict_requested = $1, verdict_status = 'Pending', verdict_requested_by = $2,
       verdict_l1_status = 'Pending', updated_by = 'system', updated_at = NOW() WHERE id = $3 AND is_frozen = false RETURNING *`,
      [verdict, requested_by || 'system', req.params.id]
    )
    if (result.rows.length === 0) return res.status(404).json({ error: 'not found, or finding is frozen and cannot be modified' })
    res.json({ ...result.rows[0], needsL2 })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'failed to request verdict' })
  }
})

router.put('/discovery/:id/verdict-decision', async (req, res) => {
  const { decision, reviewed_by, level } = req.body
  if (!['Approved', 'Rejected'].includes(decision)) return res.status(400).json({ error: 'decision must be Approved or Rejected' })

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    const discoveryResult = await client.query('SELECT * FROM vulnerability_discoveries WHERE id = $1', [req.params.id])
    const discovery = discoveryResult.rows[0]
    if (!discovery) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'not found' }) }

    const needsL2 = ['Critical', 'High'].includes(discovery.snapshot_severity)
    const decisionLevel = level || (needsL2 ? 'L1' : 'Final')

    if (decisionLevel === 'L1') {
      if (discovery.verdict_l1_status !== 'Pending') { await client.query('ROLLBACK'); return res.status(400).json({ error: 'no pending L1 review on this finding' }) }

      if (decision === 'Rejected') {
        await client.query(
          `UPDATE vulnerability_discoveries SET verdict_status = 'Rejected', verdict_l1_status = 'Rejected', verdict_l1_by = $1, verdict_l1_at = NOW(), updated_by = 'system', updated_at = NOW() WHERE id = $2`,
          [reviewed_by || 'system', req.params.id]
        )
      } else {
        await client.query(
          `UPDATE vulnerability_discoveries SET verdict_l1_status = 'Approved', verdict_l1_by = $1, verdict_l1_at = NOW(), updated_by = 'system', updated_at = NOW() WHERE id = $2`,
          [reviewed_by || 'system', req.params.id]
        )
      }
    } else {
      // Final decision: either a direct single-tier (Medium/Low) Reviewer call, or L2 Approver sign-off after L1
      if (needsL2 && discovery.verdict_l1_status !== 'Approved') { await client.query('ROLLBACK'); return res.status(400).json({ error: 'L1 review must be approved before L2 approval' }) }

      await client.query(
        `UPDATE vulnerability_discoveries SET verdict_status = $1, verdict_reviewed_by = $2, verdict_reviewed_at = NOW(), verdict_l2_by = $2, verdict_l2_at = NOW(), updated_by = 'system', updated_at = NOW() WHERE id = $3`,
        [decision, reviewed_by || 'system', req.params.id]
      )

      if (decision === 'Approved') {
        await client.query(
          `UPDATE master_vulnerabilities SET analyst_verdict = $1, verdict_status = 'Approved', updated_by = 'system', updated_at = NOW() WHERE id = $2`,
          [discovery.verdict_requested, discovery.master_vuln_id]
        )
      }
    }

    await client.query('COMMIT')
    const updated = await pool.query('SELECT * FROM vulnerability_discoveries WHERE id = $1', [req.params.id])
    res.json(updated.rows[0])
  } catch (err) {
    await client.query('ROLLBACK')
    console.error(err)
    res.status(500).json({ error: 'failed to record verdict decision' })
  } finally {
    client.release()
  }
})

router.put('/discovery/:id/discard', async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE vulnerability_discoveries SET is_active = false, updated_by = 'system', updated_at = NOW() WHERE id = $1 RETURNING *`,
      [req.params.id]
    )
    if (result.rows.length === 0) return res.status(404).json({ error: 'not found' })
    res.json(result.rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'failed to discard finding' })
  }
})

router.put('/discovery/:id/open-ticket', async (req, res) => {
  const { remediation_owner } = req.body
  try {
    const existing = await pool.query('SELECT is_draft, verdict_status FROM vulnerability_discoveries WHERE id = $1', [req.params.id])
    if (existing.rows.length === 0) return res.status(404).json({ error: 'not found' })
    if (existing.rows[0].is_draft) return res.status(400).json({ error: 'cannot open a ticket on a draft finding' })
    if (existing.rows[0].verdict_status === 'Approved') return res.status(400).json({ error: 'cannot open a remediation ticket on a finding with an approved False Positive verdict' })

    const countResult = await pool.query(`SELECT count(*) FROM vulnerability_discoveries WHERE ticket_id IS NOT NULL`)
    const ticketId = `TKT-${new Date().getFullYear()}-${String(Number(countResult.rows[0].count) + 1).padStart(4, '0')}`

    const result = await pool.query(
      `UPDATE vulnerability_discoveries SET ticket_id = $1, ticket_status = 'Open', ticket_opened_at = NOW(), remediation_owner = $2, updated_by = 'system', updated_at = NOW() WHERE id = $3 RETURNING *`,
      [ticketId, remediation_owner || null, req.params.id]
    )
    res.json(result.rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'failed to open ticket' })
  }
})

router.put('/discovery/:id/ticket-status', async (req, res) => {
  const { status } = req.body
  const VALID = ['Open', 'Remediation In Progress', 'Pending Retest', 'Closed']
  if (!VALID.includes(status)) return res.status(400).json({ error: `status must be one of: ${VALID.join(', ')}` })

  try {
    const closedAt = status === 'Closed' ? ', ticket_closed_at = NOW()' : ''
    const result = await pool.query(
      `UPDATE vulnerability_discoveries SET ticket_status = $1, updated_by = 'system', updated_at = NOW()${closedAt} WHERE id = $2 RETURNING *`,
      [status, req.params.id]
    )
    if (result.rows.length === 0) return res.status(404).json({ error: 'not found' })

    if (status === 'Closed') {
      const discovery = result.rows[0]
      await pool.query(`UPDATE master_vulnerabilities SET status = 'Remediated', updated_by = 'system', updated_at = NOW() WHERE id = $1`, [discovery.master_vuln_id])
    }

    res.json(result.rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'failed to update ticket status' })
  }
})

router.put('/discovery/:id/mark-clean', async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE vulnerability_discoveries SET ticket_status = 'Closed', ticket_closed_at = NOW(), updated_by = 'system', updated_at = NOW() WHERE id = $1 AND is_draft = false RETURNING *`,
      [req.params.id]
    )
    if (result.rows.length === 0) return res.status(404).json({ error: 'not found, or finding is still a draft' })

    await pool.query(`UPDATE master_vulnerabilities SET status = 'Remediated', updated_by = 'system', updated_at = NOW() WHERE id = $1`, [result.rows[0].master_vuln_id])
    res.json(result.rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'failed to mark clean' })
  }
})

router.post('/bulk-upload/:assessmentId', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'no file uploaded' })

  const assessmentResult = await pool.query('SELECT id FROM assessments WHERE id = $1 AND is_active = true', [req.params.assessmentId])
  if (assessmentResult.rows.length === 0) return res.status(404).json({ error: 'assessment not found' })

  let records: any[]
  try {
    records = parse(req.file.buffer.toString('utf-8'), { columns: true, skip_empty_lines: true, trim: true })
  } catch (err) {
    return res.status(400).json({ error: 'failed to parse CSV — ensure it has headers: title, severity, cve_id, cvss_score, diagnosis, solution' })
  }

  if (records.length === 0) return res.status(400).json({ error: 'CSV contains no data rows' })
  if (records.length > 500) return res.status(400).json({ error: 'CSV exceeds maximum of 500 rows per upload' })

  const VALID_SEVERITIES = ['Critical', 'High', 'Medium', 'Low']
  const results = { created: 0, matched: 0, skipped: 0, errors: [] as string[] }

  for (let i = 0; i < records.length; i++) {
    const row = records[i]
    const rowNum = i + 2 // account for header row + 1-index

    if (!row.title?.trim()) { results.skipped++; results.errors.push(`Row ${rowNum}: missing title`); continue }
    if (!VALID_SEVERITIES.includes(row.severity)) { results.skipped++; results.errors.push(`Row ${rowNum}: invalid severity "${row.severity}" — must be Critical/High/Medium/Low`); continue }

    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const matchResult = await client.query(
        `SELECT * FROM master_vulnerabilities WHERE asset_id = 200 AND (cve_id = $1::varchar OR title = $2) AND is_active = true FOR UPDATE`,
        [row.cve_id || null, row.title.trim()]
      )
      let masterVuln = matchResult.rows[0]
      const wasMatched = !!masterVuln

      if (masterVuln) {
        results.matched++
        await client.query(
          `UPDATE master_vulnerabilities SET severity = $1, cvss_score = $2, updated_by = 'system', updated_at = NOW() WHERE id = $3`,
          [row.severity, row.cvss_score ? Number(row.cvss_score) : null, masterVuln.id]
        )
      } else {
        results.created++
        const created = await client.query(
          `INSERT INTO master_vulnerabilities (title, cve_id, severity, cvss_score, diagnosis, solution, asset_id, created_by, updated_by)
           VALUES ($1, $2, $3, $4, $5, $6, 200, 'system', 'system') RETURNING *`,
          [row.title.trim(), row.cve_id || null, row.severity, row.cvss_score ? Number(row.cvss_score) : null, row.diagnosis || null, row.solution || null]
        )
        masterVuln = created.rows[0]
      }

      await client.query(
        `INSERT INTO vulnerability_discoveries (master_vuln_id, assessment_id, discovery_type, snapshot_title, snapshot_severity, snapshot_cvss_score, snapshot_diagnosis, snapshot_solution, snapshot_status, is_draft, discovered_by, created_by, updated_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'Open', true, $9, 'system', 'system')`,
        [masterVuln.id, req.params.assessmentId, wasMatched ? 'Also Found' : 'Original', row.title.trim(), row.severity, row.cvss_score ? Number(row.cvss_score) : null, row.diagnosis || null, row.solution || null, 'Bulk Upload']
      )

      await client.query('COMMIT')
    } catch (err) {
      await client.query('ROLLBACK')
      results.skipped++
      results.errors.push(`Row ${rowNum}: database error`)
    } finally {
      client.release()
    }
  }

  res.json(results)
})

export default router