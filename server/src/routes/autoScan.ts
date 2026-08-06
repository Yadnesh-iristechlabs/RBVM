import { Router } from 'express'
import { pool } from '../db/pool'

const router = Router()

function computeNextRun(frequency: string, runTime: string, dayOfWeek?: number, dayOfMonth?: number): Date {
  const [h, m] = runTime.split(':').map(Number)
  const now = new Date()
  const next = new Date()
  next.setHours(h, m, 0, 0)

  if (frequency === 'Once' || frequency === 'Daily') {
    if (next <= now) next.setDate(next.getDate() + 1)
  } else if (frequency === 'Weekly') {
    const targetDay = dayOfWeek ?? 1
    while (next.getDay() !== targetDay || next <= now) next.setDate(next.getDate() + 1)
  } else if (frequency === 'Monthly' || frequency === 'Yearly') {
    const targetDate = dayOfMonth ?? 1
    next.setDate(targetDate)
    if (next <= now) {
      if (frequency === 'Monthly') next.setMonth(next.getMonth() + 1)
      else next.setFullYear(next.getFullYear() + 1)
    }
  }
  return next
}

router.post('/schedule', async (req, res) => {
  const { assessment_id, scan_tool, scan_type, frequency, run_time, day_of_week, day_of_month } = req.body
  if (!assessment_id || !scan_tool?.trim() || !scan_type?.trim() || !frequency) {
    return res.status(400).json({ error: 'assessment_id, scan_tool, scan_type, and frequency are required' })
  }

  try {
    const nextRun = computeNextRun(frequency, run_time || '09:00', day_of_week, day_of_month)
    const result = await pool.query(
      `INSERT INTO auto_scan_schedules (assessment_id, scan_tool, scan_type, frequency, next_run_at, run_time, day_of_week, day_of_month, created_by, updated_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'system', 'system') RETURNING *`,
      [assessment_id, scan_tool.trim(), scan_type.trim(), frequency, nextRun, run_time || '09:00', day_of_week || null, day_of_month || null]
    )
    res.status(201).json(result.rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'failed to create schedule' })
  }
})

router.get('/schedule/assessment/:assessmentId', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM auto_scan_schedules WHERE assessment_id = $1 AND is_active = true', [req.params.assessmentId])
    res.json(result.rows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'failed to fetch schedule' })
  }
})

// Simulates the Trigger Engine: the platform's background task runner checking
// for schedules whose next_run_at has arrived, and firing the scan.
// In production this would be invoked by a cron/scheduler process, not an API call.
router.post('/trigger-check', async (req, res) => {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    const due = await client.query(
      `SELECT * FROM auto_scan_schedules WHERE status = 'Active' AND next_run_at <= NOW() AND is_active = true FOR UPDATE SKIP LOCKED`
    )

    const triggered = []
    for (const schedule of due.rows) {
      const assessmentResult = await client.query('SELECT * FROM assessments WHERE id = $1', [schedule.assessment_id])
      const assessment = assessmentResult.rows[0]
      if (!assessment || ['Completed', 'Cancelled'].includes(assessment.status)) {
        await client.query(`UPDATE auto_scan_schedules SET status = 'Cancelled', updated_by = 'system', updated_at = NOW() WHERE id = $1`, [schedule.id])
        continue
      }

      // Move assessment into In-Process Auto if it was Not Started
      if (assessment.status === 'Not Started') {
        await client.query(`UPDATE assessments SET status = 'In-Process Auto', updated_by = 'system', updated_at = NOW() WHERE id = $1`, [schedule.assessment_id])
      }

      // Mock scan result — a realistic finding, mimicking a parsed JSON/XML scanner response
      const mockFindings = [
        { title: 'Outdated TLS Version Supported', severity: 'Medium', cvss_score: 5.9, diagnosis: `${schedule.scan_tool} detected TLS 1.0/1.1 still enabled`, solution: 'Disable legacy TLS versions, enforce TLS 1.2+' },
      ]

      for (const finding of mockFindings) {
        const matchResult = await client.query(
          `SELECT id FROM master_vulnerabilities WHERE asset_id = (SELECT application_id FROM assessment_requests WHERE id = $1) AND title = $2 AND is_active = true FOR UPDATE`,
          [assessment.request_id, finding.title]
        )
        // Note: simplified asset resolution for this mock trigger — real implementation resolves via asset mapping, not application_id directly
        let masterVulnId = matchResult.rows[0]?.id
        if (!masterVulnId) {
          const created = await client.query(
            `INSERT INTO master_vulnerabilities (title, severity, cvss_score, diagnosis, solution, asset_id, created_by, updated_by)
             VALUES ($1, $2, $3, $4, $5, (SELECT id FROM assets LIMIT 1), 'system', 'system') RETURNING id`,
            [finding.title, finding.severity, finding.cvss_score, finding.diagnosis, finding.solution]
          )
          masterVulnId = created.rows[0].id
        }
        await client.query(
          `INSERT INTO vulnerability_discoveries (master_vuln_id, assessment_id, discovery_type, snapshot_title, snapshot_severity, snapshot_cvss_score, snapshot_diagnosis, snapshot_solution, snapshot_status, is_draft, discovered_by, created_by, updated_by)
           VALUES ($1, $2, 'Original', $3, $4, $5, $6, $7, 'Open', true, $8, 'system', 'system')`,
          [masterVulnId, schedule.assessment_id, finding.title, finding.severity, finding.cvss_score, finding.diagnosis, finding.solution, `${schedule.scan_tool} (auto)`]
        )
      }

      const isOneTime = schedule.frequency === 'Once'
      const nextRun = isOneTime ? schedule.next_run_at : computeNextRun(schedule.frequency, schedule.run_time, schedule.day_of_week, schedule.day_of_month)
      await client.query(
        `UPDATE auto_scan_schedules SET last_run_at = NOW(), next_run_at = $1, status = $2, updated_by = 'system', updated_at = NOW() WHERE id = $3`,
        [nextRun, isOneTime ? 'Cancelled' : 'Active', schedule.id]
      )

      triggered.push({ schedule_id: schedule.id, assessment_id: schedule.assessment_id, findings_created: mockFindings.length })
    }

    await client.query('COMMIT')
    res.json({ triggeredCount: triggered.length, triggered })
  } catch (err) {
    await client.query('ROLLBACK')
    console.error(err)
    res.status(500).json({ error: 'trigger check failed' })
  } finally {
    client.release()
  }
})

export default router