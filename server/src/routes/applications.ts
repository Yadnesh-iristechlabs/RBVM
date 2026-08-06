import { Router } from 'express'
import { pool } from '../db/pool'

const router = Router()

router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM applications WHERE is_active = true ORDER BY id ASC')
    res.json(result.rows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'failed to fetch applications' })
  }
})

router.post('/', async (req, res) => {
  const { app_name, description, app_type, primary_owner, secondary_owner, business_owner, technology_owner, team_lead, team_head, tags } = req.body
  if (!app_name?.trim()) return res.status(400).json({ error: 'app_name is required' })

  try {
    const countResult = await pool.query(`SELECT count(*) FROM applications`)
    const appCode = `APP-${String(Number(countResult.rows[0].count) + 1).padStart(4, '0')}`

    const result = await pool.query(
      `INSERT INTO applications (app_code, app_name, description, app_type, primary_owner, secondary_owner, business_owner, technology_owner, team_lead, team_head, tags, created_by, updated_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'system', 'system') RETURNING *`,
      [appCode, app_name.trim(), description, app_type, primary_owner, secondary_owner, business_owner, technology_owner, team_lead, team_head, tags || []]
    )
    res.status(201).json(result.rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'failed to create application' })
  }
})

router.put('/:id', async (req, res) => {
  const { app_name, description, app_type, primary_owner, secondary_owner, business_owner, technology_owner, team_lead, team_head, tags } = req.body
  try {
    const result = await pool.query(
      `UPDATE applications SET app_name=$1, description=$2, app_type=$3, primary_owner=$4, secondary_owner=$5,
       business_owner=$6, technology_owner=$7, team_lead=$8, team_head=$9, tags=$10, updated_at=NOW(), updated_by='system' WHERE id=$11 RETURNING *`,
      [app_name, description, app_type, primary_owner, secondary_owner, business_owner, technology_owner, team_lead, team_head, tags || [], req.params.id]
    )
    if (result.rows.length === 0) return res.status(404).json({ error: 'application not found' })
    res.json(result.rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'failed to update application' })
  }
})

router.delete('/:id', async (req, res) => {
  try {
    await pool.query(`UPDATE applications SET is_active = false, updated_by = 'system', updated_at = NOW() WHERE id = $1`, [req.params.id])
    res.status(204).send()
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'failed to remove application' })
  }
})

export default router