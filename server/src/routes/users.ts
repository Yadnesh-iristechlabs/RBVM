import { Router } from 'express'
import { pool } from '../db/pool'

const router = Router()

router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM app_users WHERE is_active = true ORDER BY id ASC')
    res.json(result.rows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'failed to fetch users' })
  }
})

router.post('/', async (req, res) => {
  const { name, email, role, user_type, is_tester, is_reviewer, is_approver } = req.body
  if (!name?.trim() || !email?.trim()) return res.status(400).json({ error: 'name and email are required' })
  try {
    const result = await pool.query(
      `INSERT INTO app_users (name, email, role, user_type, is_tester, is_reviewer, is_approver, created_by, updated_by) VALUES ($1, $2, $3, $4, $5, $6, $7, 'system', 'system') RETURNING *`,
      [name.trim(), email.trim(), role?.trim() || null, user_type || 'Internal', !!is_tester, !!is_reviewer, !!is_approver]
    )
    res.status(201).json(result.rows[0])
  } catch (err: any) {
    if (err.code === '23505') return res.status(409).json({ error: 'a user with this email already exists' })
    console.error(err)
    res.status(500).json({ error: 'failed to create user' })
  }
})

router.put('/:id', async (req, res) => {
  const { name, email, role, user_type, is_tester, is_reviewer, is_approver } = req.body
  try {
    const result = await pool.query(
      `UPDATE app_users SET name = $1, email = $2, role = $3, user_type = $4, is_tester = $5, is_reviewer = $6, is_approver = $7, updated_by = 'system', updated_at = NOW() WHERE id = $8 RETURNING *`,
      [name?.trim(), email?.trim(), role?.trim() || null, user_type || 'Internal', !!is_tester, !!is_reviewer, !!is_approver, req.params.id]
    )
    if (result.rows.length === 0) return res.status(404).json({ error: 'user not found' })
    res.json(result.rows[0])
  } catch (err: any) {
    if (err.code === '23505') return res.status(409).json({ error: 'a user with this email already exists' })
    console.error(err)
    res.status(500).json({ error: 'failed to update user' })
  }
})

router.delete('/:id', async (req, res) => {
  try {
    await pool.query(`UPDATE app_users SET is_active = false, updated_by = 'system', updated_at = NOW() WHERE id = $1`, [req.params.id])
    res.status(204).send()
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'failed to remove user' })
  }
})

export default router