import { Router } from 'express'
import { pool } from '../db/pool'

const router = Router()

router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM vulnerability_repository_master WHERE is_active = true ORDER BY vulnerability_name ASC`
    )
    res.json(result.rows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'failed to fetch repository master list' })
  }
})

router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM vulnerability_repository_master WHERE id = $1 AND is_active = true`,
      [req.params.id]
    )
    if (result.rows.length === 0) return res.status(404).json({ error: 'not found' })
    res.json(result.rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'failed to fetch repository entry' })
  }
})

router.post('/', async (req, res) => {
  const {
    assessment_type, plugin_id, vulnerability_name, tags, risk_on_internet, risk_on_intranet,
    ease_of_exploitation, category, cia, ext_reference, component, description, impact, solution,
    good_reads, compensating_control, detailed_steps,
  } = req.body

  if (!assessment_type || !vulnerability_name?.trim() || !risk_on_internet || !risk_on_intranet || !description?.trim() || !impact?.trim() || !solution?.trim()) {
    return res.status(400).json({ error: 'assessment_type, vulnerability_name, risk_on_internet, risk_on_intranet, description, impact, and solution are required' })
  }

  const VALID_RISK = ['Critical', 'High', 'Medium', 'Low', 'Info']
  if (!VALID_RISK.includes(risk_on_internet) || !VALID_RISK.includes(risk_on_intranet)) {
    return res.status(400).json({ error: 'risk values must be one of Critical, High, Medium, Low, Info' })
  }

  try {
    const result = await pool.query(
      `INSERT INTO vulnerability_repository_master
       (assessment_type, plugin_id, vulnerability_name, tags, risk_on_internet, risk_on_intranet,
        ease_of_exploitation, category, cia, ext_reference, component, description, impact, solution,
        good_reads, compensating_control, detailed_steps, created_by, updated_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, 'system', 'system')
       RETURNING *`,
      [assessment_type, plugin_id || null, vulnerability_name.trim(), tags || null, risk_on_internet, risk_on_intranet,
       ease_of_exploitation || null, category || null, cia || null, ext_reference || null, component || null,
       description.trim(), impact.trim(), solution.trim(), good_reads || null, compensating_control || false, detailed_steps || null]
    )
    res.status(201).json(result.rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'failed to create repository entry' })
  }
})

router.put('/:id', async (req, res) => {
  const {
    assessment_type, plugin_id, vulnerability_name, tags, risk_on_internet, risk_on_intranet,
    ease_of_exploitation, category, cia, ext_reference, component, description, impact, solution,
    good_reads, compensating_control, detailed_steps,
  } = req.body

  try {
    const result = await pool.query(
      `UPDATE vulnerability_repository_master SET
        assessment_type = $1, plugin_id = $2, vulnerability_name = $3, tags = $4, risk_on_internet = $5,
        risk_on_intranet = $6, ease_of_exploitation = $7, category = $8, cia = $9, ext_reference = $10,
        component = $11, description = $12, impact = $13, solution = $14, good_reads = $15,
        compensating_control = $16, detailed_steps = $17, updated_by = 'system', updated_at = NOW()
       WHERE id = $18 AND is_active = true RETURNING *`,
      [assessment_type, plugin_id || null, vulnerability_name?.trim(), tags || null, risk_on_internet, risk_on_intranet,
       ease_of_exploitation || null, category || null, cia || null, ext_reference || null, component || null,
       description?.trim(), impact?.trim(), solution?.trim(), good_reads || null, compensating_control || false,
       detailed_steps || null, req.params.id]
    )
    if (result.rows.length === 0) return res.status(404).json({ error: 'not found' })
    res.json(result.rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'failed to update repository entry' })
  }
})

router.delete('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE vulnerability_repository_master SET is_active = false, updated_by = 'system', updated_at = NOW() WHERE id = $1 RETURNING id`,
      [req.params.id]
    )
    if (result.rows.length === 0) return res.status(404).json({ error: 'not found' })
    res.json({ success: true })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'failed to delete repository entry' })
  }
})

export default router