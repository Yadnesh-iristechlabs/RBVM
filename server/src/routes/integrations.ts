import { Router } from 'express'
import { pool } from '../db/pool'
import { encrypt } from '../utils/encryption'

const router = Router()

router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT id, name, endpoint, username, connected, extra_fields, auth_profile, updated_at, created_at FROM integration_config ORDER BY updated_at DESC')
    res.json(result.rows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'failed to fetch integrations' })
  }
})

router.get('/:name', async (req, res) => {
  try {
    const result = await pool.query('SELECT id, name, endpoint, username, connected, extra_fields, auth_profile, updated_at, created_at FROM integration_config WHERE name = $1', [req.params.name])
    if (result.rows.length === 0) return res.json({ name: req.params.name, connected: false })
    res.json(result.rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'failed to fetch integration config' })
  }
})

router.post('/:name/connect', async (req, res) => {
  const { endpoint, username, password, extra_fields, auth_profile } = req.body

  if (!endpoint) {
    return res.status(400).json({ error: 'endpoint is required' })
  }
  if (!/^https?:\/\/.+/.test(endpoint)) {
    return res.status(400).json({ error: 'endpoint must be a valid URL starting with http:// or https://' })
  }

  try {
    const encryptedPassword = password ? encrypt(password) : null
    const encryptedExtraFields = extra_fields
      ? Object.fromEntries(Object.entries(extra_fields).map(([k, v]) => [k, typeof v === 'string' && v ? encrypt(v) : v]))
      : {}

    const result = await pool.query(
      `INSERT INTO integration_config (name, endpoint, username, password_encrypted, extra_fields, auth_profile, connected, updated_at, created_by, updated_by)
       VALUES ($1, $2, $3, $4, $5, $6, true, NOW(), 'system', 'system')
       ON CONFLICT (name) DO UPDATE SET endpoint = $2, username = $3, password_encrypted = $4, extra_fields = $5, auth_profile = $6, connected = true, updated_at = NOW(), updated_by = 'system'
       RETURNING id, name, endpoint, username, connected, auth_profile, updated_at`,
      [req.params.name, endpoint, username || null, encryptedPassword, JSON.stringify(encryptedExtraFields), auth_profile || 'default']
    )
    res.json(result.rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'failed to save integration config' })
  }
})

router.delete('/:name', async (req, res) => {
  try {
    await pool.query(`UPDATE integration_config SET is_active = false, updated_by = 'system', updated_at = NOW() WHERE name = $1`, [req.params.name])
    res.status(204).send()
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'failed to remove integration' })
  }
})

router.post('/:name/disconnect', async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE integration_config SET connected = false, updated_at = NOW(), updated_by = 'system' WHERE name = $1 RETURNING *`,
      [req.params.name]
    )
    res.json(result.rows[0] ?? { name: req.params.name, connected: false })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'failed to disconnect' })
  }
})

export default router