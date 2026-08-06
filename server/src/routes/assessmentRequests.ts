import { Router } from 'express'
import { pool } from '../db/pool'

const router = Router()

router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM assessment_requests WHERE is_active = true ORDER BY id DESC')
    res.json(result.rows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'failed to fetch assessment requests' })
  }
})

router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM assessment_requests WHERE id = $1', [req.params.id])
    if (result.rows.length === 0) return res.status(404).json({ error: 'not found' })
    res.json(result.rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'failed to fetch assessment request' })
  }
})

router.post('/', async (req, res) => {
  const {
    assessment_type, type_of_assessment, assessment_group, frequency, tentative_start_date, assessment_name,
    application_type, environment, application_id, business_exposure, url, application_owner, tier,
    business_spoc, department, asset_group, cr_number, remarks, previous_assessment_id, requested_by,
  } = req.body

  if (!assessment_type || !type_of_assessment || !assessment_name) {
    return res.status(400).json({ error: 'assessment_type, type_of_assessment, and assessment_name are required' })
  }

  try {
    const countResult = await pool.query(`SELECT count(*) FROM assessment_requests`)
    const requestId = `REQ-${new Date().getFullYear()}-${String(Number(countResult.rows[0].count) + 1).padStart(4, '0')}`

    const result = await pool.query(
      `INSERT INTO assessment_requests (
        request_id, assessment_type, type_of_assessment, assessment_group, frequency, tentative_start_date, assessment_name,
        application_type, environment, application_id, business_exposure, url, application_owner, tier,
        business_spoc, department, asset_group, cr_number, remarks, previous_assessment_id, requested_by,
        created_by, updated_by
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,'system','system')
      RETURNING *`,
      [requestId, assessment_type, type_of_assessment, assessment_group, frequency, tentative_start_date || null, assessment_name,
       application_type, environment, application_id || null, business_exposure, url, application_owner, tier,
       business_spoc, department, asset_group, cr_number, remarks, previous_assessment_id || null, requested_by || 'system']
    )
    res.status(201).json(result.rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'failed to create assessment request' })
  }
})

router.put('/:id/approve', async (req, res) => {
  const { tester, coordinators, reviewer, publish_on_the_go } = req.body
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    const reqResult = await client.query('SELECT * FROM assessment_requests WHERE id = $1', [req.params.id])
    const request = reqResult.rows[0]
    if (!request) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'not found' }) }

    await client.query(
      `UPDATE assessment_requests SET status = 'Approved', action_taken_by = 'system', action_taken_on = NOW(), updated_by = 'system', updated_at = NOW() WHERE id = $1`,
      [req.params.id]
    )

    const countResult = await client.query(`SELECT count(*) FROM assessments`)
    const assessmentCode = `ASM-${new Date().getFullYear()}-${String(Number(countResult.rows[0].count) + 1).padStart(4, '0')}`

    const assessmentResult = await client.query(
      `INSERT INTO assessments (assessment_code, request_id, assessment_name, assessment_type, tester, coordinators, reviewer, publish_on_the_go, created_by, updated_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'system', 'system') RETURNING *`,
      [assessmentCode, request.id, request.assessment_name, request.assessment_type, tester || null, coordinators || [], reviewer || null, !!publish_on_the_go]
    )

    await client.query('COMMIT')
    res.status(201).json({ request: { ...request, status: 'Approved' }, assessment: assessmentResult.rows[0] })
  } catch (err) {
    await client.query('ROLLBACK')
    console.error(err)
    res.status(500).json({ error: 'failed to approve request and create assessment' })
  } finally {
    client.release()
  }
})

router.put('/:id/reject', async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE assessment_requests SET status = 'Rejected', action_taken_by = 'system', action_taken_on = NOW(), updated_by = 'system', updated_at = NOW() WHERE id = $1 RETURNING *`,
      [req.params.id]
    )
    if (result.rows.length === 0) return res.status(404).json({ error: 'not found' })
    res.json(result.rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'failed to reject request' })
  }
})

router.post('/retest/:discoveryId', async (req, res) => {
  try {
    const discoveryResult = await pool.query(
      `SELECT d.*, a.assessment_type, a.assessment_name, ar.application_id, ar.application_type, ar.environment, ar.business_exposure, ar.url, ar.application_owner, ar.tier, ar.business_spoc, ar.department, ar.asset_group
       FROM vulnerability_discoveries d
       JOIN assessments a ON a.id = d.assessment_id
       JOIN assessment_requests ar ON ar.id = a.request_id
       WHERE d.id = $1`,
      [req.params.discoveryId]
    )
    const source = discoveryResult.rows[0]
    if (!source) return res.status(404).json({ error: 'source finding not found' })
    if (source.ticket_status !== 'Closed') return res.status(400).json({ error: 'can only request a re-test for a closed/remediated finding' })

    const countResult = await pool.query(`SELECT count(*) FROM assessment_requests`)
    const requestId = `REQ-${new Date().getFullYear()}-${String(Number(countResult.rows[0].count) + 1).padStart(4, '0')}`

    const result = await pool.query(
      `INSERT INTO assessment_requests (
        request_id, assessment_type, type_of_assessment, assessment_name,
        application_type, environment, application_id, business_exposure, url, application_owner, tier,
        business_spoc, department, asset_group, remarks, requested_by, retest_of_discovery_id,
        created_by, updated_by
      ) VALUES ($1,$2,'Re-assessment',$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,'system','system')
      RETURNING *`,
      [requestId, source.assessment_type, `Re-test: ${source.snapshot_title}`,
       source.application_type, source.environment, source.application_id, source.business_exposure, source.url, source.application_owner, source.tier,
       source.business_spoc, source.department, source.asset_group,
       `Auto-generated re-test request following remediation of "${source.snapshot_title}" (ticket ${source.ticket_id}).`,
       'system', source.id]
    )
    res.status(201).json(result.rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'failed to create re-test request' })
  }
})

export default router