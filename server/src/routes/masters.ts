import { Router } from 'express'
import { pool } from '../db/pool'

const router = Router()
const VALID_TYPES = ['asset_domain', 'asset_class', 'asset_type', 'asset_environment', 'asset_tier', 'asset_status', 'department', 'business_unit', 'location', 'asset_group', 'regulatory_config', 'controls', 'tags', 'exposure', 'application_type', 'assessment_type', 'assessment_group']

router.get('/:type', async (req, res) => {
  if (!VALID_TYPES.includes(req.params.type)) return res.status(400).json({ error: 'invalid master type' })
  try {
    const result = await pool.query(
      'SELECT * FROM asset_masters WHERE master_type = $1 AND is_active = true ORDER BY id ASC',
      [req.params.type]
    )
    res.json(result.rows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'failed to fetch master data' })
  }
})

router.post('/:type', async (req, res) => {
  if (!VALID_TYPES.includes(req.params.type)) return res.status(400).json({ error: 'invalid master type' })
  const { value } = req.body
  if (!value?.trim()) return res.status(400).json({ error: 'value is required' })

  try {
    const result = await pool.query(
      `INSERT INTO asset_masters (master_type, value, created_by, updated_by) VALUES ($1, $2, 'system', 'system')
       ON CONFLICT (master_type, value) DO UPDATE SET is_active = true, updated_by = 'system', updated_at = NOW()
       RETURNING *`,
      [req.params.type, value.trim()]
    )
    res.status(201).json(result.rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'failed to add master value' })
  }
})

router.delete('/:type/:id', async (req, res) => {
  try {
    await pool.query(`UPDATE asset_masters SET is_active = false, updated_by = 'system', updated_at = NOW() WHERE id = $1`, [req.params.id])
    res.status(204).send()
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'failed to remove master value' })
  }
})

export default router