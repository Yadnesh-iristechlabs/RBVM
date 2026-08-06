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
  const { assessment_id, asset_id, title, cve_id, severity, cvss_score, diagnosis, solution, discovered_by, is_draft } = req.body

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
        `INSERT INTO master_vulnerabilities (title, cve_id, severity, cvss_score, diagnosis, solution, asset_id, created_by, updated_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'system', 'system') RETURNING *`,
        [title.trim(), cve_id || null, severity, cvss_score || null, diagnosis || null, solution || null, asset_id]
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