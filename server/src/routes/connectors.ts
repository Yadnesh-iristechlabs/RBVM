import { Router } from 'express'
import { pool } from '../db/pool'
import { getAdapter } from '../connectors/registry'

const router = Router()

router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM connectors WHERE is_active = true ORDER BY id ASC')
    res.json(result.rows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'failed to fetch connectors' })
  }
})

router.post('/:name/test', async (req, res) => {
  const adapter = getAdapter(req.params.name)
  if (!adapter) return res.status(404).json({ error: 'unknown connector' })
  try {
    const result = await adapter.testConnection(req.body)
    res.json(result)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'test connection failed' })
  }
})

router.post('/:name/sync', async (req, res) => {
  const adapter = getAdapter(req.params.name)
  if (!adapter) return res.status(404).json({ error: 'unknown connector' })
  try {
    const configResult = await pool.query('SELECT * FROM integration_config WHERE name = $1', [req.params.name])
    const config = configResult.rows[0]
    if (!config || !config.connected) {
      return res.status(400).json({ error: 'connector is not connected' })
    }
    const result = await adapter.sync({ endpoint: config.endpoint, username: config.username, password: '' })
    res.json(result)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'sync failed' })
  }
})

export default router