CREATE TABLE assets (
  id SERIAL PRIMARY KEY,
  hostname VARCHAR(255) NOT NULL,
  ip_address VARCHAR(45),
  ipv6_address VARCHAR(45),
  fqdn VARCHAR(255),
  asset_type VARCHAR(50),
  business_unit VARCHAR(255),
  criticality VARCHAR(10),
  exposure VARCHAR(50),
  os VARCHAR(255),
  os_version VARCHAR(100),
  asset_group VARCHAR(255),
  priority VARCHAR(10),
  owner VARCHAR(255),
  location VARCHAR(255),
  cloud_provider VARCHAR(50),
  instance_id VARCHAR(255),
  tags TEXT[],
  agent_installed BOOLEAN,
  compliance_frameworks TEXT[],
  mac_address VARCHAR(17),
  serial_number VARCHAR(255),
  environment VARCHAR(50),
  network_segment VARCHAR(255),
  cloud_region VARCHAR(100),
  agent_version VARCHAR(50),
  first_seen DATE,
  last_seen DATE,
  org_id INTEGER,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_assets_hostname ON assets(hostname);
CREATE INDEX idx_assets_org_id ON assets(org_id);

CREATE TABLE exceptions (
  id SERIAL PRIMARY KEY,
  asset_id INTEGER REFERENCES assets(id) ON DELETE CASCADE,
  finding_title VARCHAR(500),
  type VARCHAR(100),
  status VARCHAR(50) DEFAULT 'Pending',
  reason TEXT,
  requested_by VARCHAR(255),
  expiry DATE,
  created_at TIMESTAMP DEFAULT NOW()
);

import { Router } from 'express'
import { pool } from '../db/pool'

const router = Router()

router.get('/config', async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM workflow_config WHERE name = 'default'")
    if (result.rows.length === 0) {
      const created = await pool.query(
        "INSERT INTO workflow_config (name, workflow_type) VALUES ('default', 1) RETURNING *"
      )
      return res.json(created.rows[0])
    }
    res.json(result.rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'failed to fetch workflow config' })
  }
})

router.put('/config', async (req, res) => {
  const { workflow_type } = req.body
  if (![1, 2, 3].includes(workflow_type)) return res.status(400).json({ error: 'workflow_type must be 1, 2, or 3' })

  try {
    const result = await pool.query(
      `UPDATE workflow_config SET workflow_type = $1, updated_at = NOW() WHERE name = 'default' RETURNING *`,
      [workflow_type]
    )
    if (result.rows.length === 0) {
      const created = await pool.query(
        `INSERT INTO workflow_config (name, workflow_type) VALUES ('default', $1) RETURNING *`,
        [workflow_type]
      )
      return res.json(created.rows[0])
    }
    res.json(result.rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'failed to update workflow config' })
  }
})

router.post('/ingest', async (req, res) => {
  const { asset_id, finding_qid, finding_title } = req.body
  if (!asset_id || !finding_qid || !finding_title) {
    return res.status(400).json({ error: 'asset_id, finding_qid, and finding_title are required' })
  }

  try {
    const configResult = await pool.query("SELECT workflow_type FROM workflow_config WHERE name = 'default'")
    const workflowType = configResult.rows[0]?.workflow_type ?? 1

    const assetResult = await pool.query('SELECT owner FROM assets WHERE id = $1', [asset_id])
    const owner = assetResult.rows[0]?.owner ?? null

    let status = 'Pending'
    let assignedTo: string | null = null
    let publishedAt: string | null = null

    if (workflowType === 1) {
      status = 'Published'
      assignedTo = owner
      publishedAt = new Date().toISOString()
    } else if (workflowType === 2) {
      status = 'Pending L1 Review'
    } else if (workflowType === 3) {
      status = 'Pending L1 Review'
    }

    const result = await pool.query(
      `INSERT INTO finding_reviews (asset_id, finding_qid, finding_title, workflow_type, status, assigned_to, published_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [asset_id, finding_qid, finding_title, workflowType, status, assignedTo, publishedAt]
    )
    res.status(201).json(result.rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'failed to ingest finding' })
  }
})

router.get('/reviews', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM finding_reviews ORDER BY created_at DESC')
    res.json(result.rows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'failed to fetch reviews' })
  }
})

router.post('/reviews/:id/l1-decision', async (req, res) => {
  const { decision, reviewer } = req.body
  if (!['Approved', 'Rejected', 'False Positive'].includes(decision)) {
    return res.status(400).json({ error: 'decision must be Approved, Rejected, or False Positive' })
  }

  try {
    const reviewResult = await pool.query('SELECT * FROM finding_reviews WHERE id = $1', [req.params.id])
    const review = reviewResult.rows[0]
    if (!review) return res.status(404).json({ error: 'review not found' })

    let newStatus = decision === 'Approved'
      ? (review.workflow_type === 3 ? 'Pending L2 Approval' : 'Published')
      : decision === 'False Positive' ? 'False Positive' : 'Rejected'

    let publishedAt = null
    let assignedTo = review.assigned_to
    if (newStatus === 'Published') {
      publishedAt = new Date().toISOString()
      const assetResult = await pool.query('SELECT owner FROM assets WHERE id = $1', [review.asset_id])
      assignedTo = assetResult.rows[0]?.owner ?? null
    }

    const result = await pool.query(
      `UPDATE finding_reviews SET status = $1, l1_reviewer = $2, l1_decision = $3, l1_decided_at = NOW(), assigned_to = $4, published_at = $5 WHERE id = $6 RETURNING *`,
      [newStatus, reviewer, decision, assignedTo, publishedAt, req.params.id]
    )
    res.json(result.rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'failed to record L1 decision' })
  }
})

router.post('/reviews/:id/l2-decision', async (req, res) => {
  const { decision, approver } = req.body
  if (!['Approved', 'Rejected'].includes(decision)) {
    return res.status(400).json({ error: 'decision must be Approved or Rejected' })
  }

  try {
    const reviewResult = await pool.query('SELECT * FROM finding_reviews WHERE id = $1', [req.params.id])
    const review = reviewResult.rows[0]
    if (!review) return res.status(404).json({ error: 'review not found' })

    let newStatus = decision === 'Approved' ? 'Published' : 'Rejected'
    let publishedAt = null
    let assignedTo = review.assigned_to
    if (newStatus === 'Published') {
      publishedAt = new Date().toISOString()
      const assetResult = await pool.query('SELECT owner FROM assets WHERE id = $1', [review.asset_id])
      assignedTo = assetResult.rows[0]?.owner ?? null
    }

    const result = await pool.query(
      `UPDATE finding_reviews SET status = $1, l2_approver = $2, l2_decision = $3, l2_decided_at = NOW(), assigned_to = $4, published_at = $5 WHERE id = $6 RETURNING *`,
      [newStatus, approver, decision, assignedTo, publishedAt, req.params.id]
    )
    res.json(result.rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'failed to record L2 decision' })
  }
})

export default router