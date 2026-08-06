import { Router } from 'express'
import { pool } from '../db/pool'

const router = Router()

router.get('/asset/:assetId', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM asset_components WHERE asset_id = $1 AND is_active = true ORDER BY id ASC', [req.params.assetId])
    res.json(result.rows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'failed to fetch components' })
  }
})

router.post('/', async (req, res) => {
  const { asset_id, component_name, attribute_name, version, component_owner } = req.body
  if (!asset_id || !component_name?.trim()) return res.status(400).json({ error: 'asset_id and component_name are required' })
  try {
    const result = await pool.query(
      `INSERT INTO asset_components (asset_id, component_name, attribute_name, version, component_owner, created_by, updated_by) VALUES ($1, $2, $3, $4, $5, 'system', 'system') RETURNING *`,
      [asset_id, component_name.trim(), attribute_name, version, component_owner]
    )
    res.status(201).json(result.rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'failed to add component' })
  }
})

router.delete('/:id', async (req, res) => {
  try {
    await pool.query(`UPDATE asset_components SET is_active = false, updated_by = 'system', updated_at = NOW() WHERE id = $1`, [req.params.id])
    res.status(204).send()
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'failed to delete component' })
  }
})

export default router