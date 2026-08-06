import { Router } from 'express'
import { pool } from '../db/pool'

const router = Router()

router.get('/asset/:assetId', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM exceptions WHERE asset_id = $1 ORDER BY created_at DESC', [req.params.assetId])
    res.json(result.rows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'failed to fetch exceptions' })
  }
})

router.post('/', async (req, res) => {
  const { asset_id, finding_title, type, reason, requested_by, expiry } = req.body
  if (!asset_id || !finding_title || !reason) return res.status(400).json({ error: 'asset_id, finding_title, and reason are required' })

  try {
    const result = await pool.query(
      `INSERT INTO exceptions (asset_id, finding_title, type, reason, requested_by, expiry, created_by, updated_by)
       VALUES ($1, $2, $3, $4, $5, $6, 'system', 'system') RETURNING *`,
      [asset_id, finding_title, type, reason, requested_by, expiry]
    )
    res.status(201).json(result.rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'failed to create exception' })
  }
})

router.put('/:id', async (req, res) => {
  const { status } = req.body
  try {
    const result = await pool.query(`UPDATE exceptions SET status = $1, updated_by = 'system', updated_at = NOW() WHERE id = $2 RETURNING *`, [status, req.params.id])
    if (result.rows.length === 0) return res.status(404).json({ error: 'exception not found' })
    res.json(result.rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'failed to update exception' })
  }
})

router.delete('/:id', async (req, res) => {
  try {
    await pool.query(`UPDATE exceptions SET is_active = false, updated_by = 'system', updated_at = NOW() WHERE id = $1`, [req.params.id])
    res.status(204).send()
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'failed to delete exception' })
  }
})

export default router