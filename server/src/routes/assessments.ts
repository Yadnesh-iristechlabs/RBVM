import { Router } from 'express'
import { pool } from '../db/pool'

const router = Router()

router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM assessments WHERE is_active = true ORDER BY id DESC')
    res.json(result.rows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'failed to fetch assessments' })
  }
})

router.get('/:id/asset-details', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT ar.application_type, ar.environment, ar.business_exposure, ar.url, ar.application_owner, ar.tier,
              ar.business_spoc, ar.department, ar.asset_group,
              app.app_name, app.app_code, app.business_owner, app.technology_owner
       FROM assessments a
       JOIN assessment_requests ar ON ar.id = a.request_id
       LEFT JOIN applications app ON app.id = ar.application_id
       WHERE a.id = $1`,
      [req.params.id]
    )
    if (result.rows.length === 0) return res.status(404).json({ error: 'not found' })
    res.json(result.rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'failed to fetch asset details' })
  }
})

router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM assessments WHERE id = $1', [req.params.id])
    if (result.rows.length === 0) return res.status(404).json({ error: 'not found' })
    res.json(result.rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'failed to fetch assessment' })
  }
})

const VALID_TRANSITIONS: Record<string, string[]> = {
  'Not Started': ['In-Process Manual', 'In-Process Auto', 'Cancelled'],
  'In-Process Manual': ['Paused', 'Completed', 'Cancelled'],
  'In-Process Auto': ['Paused', 'Completed', 'Cancelled'],
  'Paused': ['In-Process Manual', 'In-Process Auto', 'Cancelled'],
  'Completed': [],
  'Cancelled': [],
}

router.put('/:id/status', async (req, res) => {
  const { status, discardDrafts } = req.body
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    const current = await client.query('SELECT status FROM assessments WHERE id = $1', [req.params.id])
    if (current.rows.length === 0) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'not found' }) }

    const currentStatus = current.rows[0].status
    if (!VALID_TRANSITIONS[currentStatus]?.includes(status)) {
      await client.query('ROLLBACK')
      return res.status(400).json({ error: `Cannot transition from "${currentStatus}" to "${status}"` })
    }

    if (status === 'Completed') {
      const draftCheck = await client.query(
        `SELECT count(*) FROM vulnerability_discoveries WHERE assessment_id = $1 AND is_draft = true AND is_active = true`,
        [req.params.id]
      )
      const draftCount = Number(draftCheck.rows[0].count)

      if (draftCount > 0 && !discardDrafts) {
        await client.query('ROLLBACK')
        return res.status(409).json({ error: 'drafts_pending', draftCount, message: `${draftCount} draft finding(s) will be discarded if you proceed.` })
      }

      if (draftCount > 0 && discardDrafts) {
        await client.query(
          `UPDATE vulnerability_discoveries SET is_active = false, updated_by = 'system', updated_at = NOW() WHERE assessment_id = $1 AND is_draft = true`,
          [req.params.id]
        )
      }

      // Freeze every remaining (published) discovery record for this assessment
      await client.query(
        `UPDATE vulnerability_discoveries SET is_frozen = true, updated_by = 'system', updated_at = NOW() WHERE assessment_id = $1 AND is_active = true`,
        [req.params.id]
      )
    }

    const result = await client.query(
      `UPDATE assessments SET status = $1, updated_by = 'system', updated_at = NOW() WHERE id = $2 RETURNING *`,
      [status, req.params.id]
    )

    await client.query('COMMIT')
    res.json(result.rows[0])
  } catch (err) {
    await client.query('ROLLBACK')
    console.error(err)
    res.status(500).json({ error: 'failed to update status' })
  } finally {
    client.release()
  }
})

export default router