import { Router } from 'express'
import { pool } from '../db/pool'

const router = Router()

router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM vuln_snapshots ORDER BY created_at ASC LIMIT 30')
    res.json(result.rows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'failed to fetch snapshots' })
  }
})

router.post('/', async (req, res) => {
  const { total, critical, high, medium, low } = req.body
  try {
    const result = await pool.query(
      `INSERT INTO vuln_snapshots (total, critical, high, medium, low, created_by, updated_by) VALUES ($1, $2, $3, $4, $5, 'system', 'system') RETURNING *`,
      [total, critical, high, medium, low]
    )
    res.status(201).json(result.rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'failed to save snapshot' })
  }
})

export default router