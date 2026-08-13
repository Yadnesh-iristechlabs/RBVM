import { Router } from 'express'
import { pool } from '../db/pool'

const router = Router()

async function logAudit(client: any, discoveryId: number, userId: string, action: string, prevStatus: string | null, newStatus: string, comment?: string) {
  await client.query(
    `INSERT INTO vulnerability_audit_log (discovery_id, user_id, action, previous_status, new_status, comment)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [discoveryId, userId, action, prevStatus, newStatus, comment || null]
  )
}

// Assign / reassign a discovery to an owner — starts the accept/reject handshake
router.post('/:id/assign', async (req, res) => {
  const { assigned_owner, assigned_by } = req.body
  if (!assigned_owner?.trim() || !assigned_by?.trim()) {
    return res.status(400).json({ error: 'assigned_owner and assigned_by are required' })
  }

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const current = await client.query('SELECT ticket_status, assigned_owner FROM vulnerability_discoveries WHERE id = $1', [req.params.id])
    if (current.rows.length === 0) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'not found' }) }

    const fromStatus = current.rows[0].ticket_status
    const newStatus = ['None', 'Open', 'Open Accepted', 'Open Rejected'].includes(fromStatus) ? 'Open' : fromStatus

    await client.query(
      `UPDATE vulnerability_discoveries SET assigned_owner = $1, assignment_status = 'Pending',
       reassigned_by = $2, reassigned_at = NOW(), ticket_status = $3, updated_by = $2, updated_at = NOW()
       WHERE id = $4`,
      [assigned_owner.trim(), assigned_by.trim(), newStatus, req.params.id]
    )
    await logAudit(client, Number(req.params.id), assigned_by.trim(), 'Assigned', fromStatus, newStatus, `Assigned to ${assigned_owner.trim()}`)

    await client.query('COMMIT')
    const updated = await pool.query('SELECT * FROM vulnerability_discoveries WHERE id = $1', [req.params.id])
    res.json(updated.rows[0])
  } catch (err) {
    await client.query('ROLLBACK')
    console.error(err)
    res.status(500).json({ error: 'failed to assign' })
  } finally {
    client.release()
  }
})

// Owner accepts the assignment -> Open Accepted (from Open) or In Process Accepted (from In Process)
router.post('/:id/accept', async (req, res) => {
  const { accepted_by } = req.body
  if (!accepted_by?.trim()) return res.status(400).json({ error: 'accepted_by is required' })

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const current = await client.query('SELECT ticket_status, assignment_status FROM vulnerability_discoveries WHERE id = $1', [req.params.id])
    if (current.rows.length === 0) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'not found' }) }
    if (current.rows[0].assignment_status !== 'Pending') {
      await client.query('ROLLBACK')
      return res.status(400).json({ error: 'no pending assignment to accept' })
    }

    const fromStatus = current.rows[0].ticket_status
    const toStatus = fromStatus === 'In Process' ? 'In Process Accepted' : fromStatus === 'Review' ? 'Review Accepted' : 'Open Accepted'

    await client.query(
      `UPDATE vulnerability_discoveries SET assignment_status = 'Accepted', ticket_status = $1, updated_by = $2, updated_at = NOW() WHERE id = $3`,
      [toStatus, accepted_by.trim(), req.params.id]
    )
    await logAudit(client, Number(req.params.id), accepted_by.trim(), 'Assignment Accepted', fromStatus, toStatus)

    await client.query('COMMIT')
    const updated = await pool.query('SELECT * FROM vulnerability_discoveries WHERE id = $1', [req.params.id])
    res.json(updated.rows[0])
  } catch (err) {
    await client.query('ROLLBACK')
    console.error(err)
    res.status(500).json({ error: 'failed to accept assignment' })
  } finally {
    client.release()
  }
})

// Start remediation after acknowledging ownership at Open Accepted -> In Process
router.post('/:id/start-remediation', async (req, res) => {
  const { started_by } = req.body
  if (!started_by?.trim()) return res.status(400).json({ error: 'started_by is required' })

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const current = await client.query('SELECT ticket_status FROM vulnerability_discoveries WHERE id = $1', [req.params.id])
    if (current.rows.length === 0) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'not found' }) }
    if (current.rows[0].ticket_status !== 'Open Accepted') {
      await client.query('ROLLBACK')
      return res.status(400).json({ error: 'can only start remediation from Open Accepted' })
    }

    await client.query(
      `UPDATE vulnerability_discoveries SET ticket_status = 'In Process', updated_by = $1, updated_at = NOW() WHERE id = $2`,
      [started_by.trim(), req.params.id]
    )
    await logAudit(client, Number(req.params.id), started_by.trim(), 'Remediation Started', 'Open Accepted', 'In Process')

    await client.query('COMMIT')
    const updated = await pool.query('SELECT * FROM vulnerability_discoveries WHERE id = $1', [req.params.id])
    res.json(updated.rows[0])
  } catch (err) {
    await client.query('ROLLBACK')
    console.error(err)
    res.status(500).json({ error: 'failed to start remediation' })
  } finally {
    client.release()
  }
})

// Single-Step workflow: mark Remediated directly from In Process (no UAT/Production split)
router.post('/:id/mark-remediated', async (req, res) => {
  const { marked_by } = req.body
  if (!marked_by?.trim()) return res.status(400).json({ error: 'marked_by is required' })

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const current = await client.query('SELECT ticket_status, dual_environment_enabled FROM vulnerability_discoveries WHERE id = $1', [req.params.id])
    if (current.rows.length === 0) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'not found' }) }
    if (current.rows[0].dual_environment_enabled) {
      await client.query('ROLLBACK')
      return res.status(400).json({ error: 'this ticket uses dual-environment workflow; use uat-remediated/production-remediated instead' })
    }
    if (current.rows[0].ticket_status !== 'In Process') {
      await client.query('ROLLBACK')
      return res.status(400).json({ error: 'can only mark Remediated from In Process' })
    }

    await client.query(
      `UPDATE vulnerability_discoveries SET ticket_status = 'Pending Verification', production_remediated_at = NOW(), updated_by = $1, updated_at = NOW() WHERE id = $2`,
      [marked_by.trim(), req.params.id]
    )
    await logAudit(client, Number(req.params.id), marked_by.trim(), 'Remediated (Single-Step)', 'In Process', 'Pending Verification')

    await client.query('COMMIT')
    const updated = await pool.query('SELECT * FROM vulnerability_discoveries WHERE id = $1', [req.params.id])
    res.json(updated.rows[0])
  } catch (err) {
    await client.query('ROLLBACK')
    console.error(err)
    res.status(500).json({ error: 'failed to mark remediated' })
  } finally {
    client.release()
  }
})

// Owner rejects the assignment -> logs Open Rejected / In Process Rejected, then
// returns to original owner (assigner) at the underlying working status.
router.post('/:id/reject-assignment', async (req, res) => {
  const { rejected_by, reason } = req.body
  if (!rejected_by?.trim()) return res.status(400).json({ error: 'rejected_by is required' })

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const current = await client.query('SELECT ticket_status, assignment_status FROM vulnerability_discoveries WHERE id = $1', [req.params.id])
    if (current.rows.length === 0) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'not found' }) }
    if (current.rows[0].assignment_status !== 'Pending') {
      await client.query('ROLLBACK')
      return res.status(400).json({ error: 'no pending assignment to reject' })
    }

    const fromStatus = current.rows[0].ticket_status
    const rejectedLabel = fromStatus === 'In Process' ? 'In Process Rejected' : fromStatus === 'Review' ? 'Review Rejected' : 'Open Rejected'
    const returnStatus = fromStatus === 'In Process' ? 'In Process' : fromStatus === 'Review' ? 'Review' : 'Open'

    await client.query(
      `UPDATE vulnerability_discoveries SET assignment_status = 'Rejected', assigned_owner = NULL, ticket_status = $1, updated_by = $2, updated_at = NOW() WHERE id = $3`,
      [returnStatus, rejected_by.trim(), req.params.id]
    )
    await logAudit(client, Number(req.params.id), rejected_by.trim(), rejectedLabel, fromStatus, returnStatus, reason || null)

    await client.query('COMMIT')
    const updated = await pool.query('SELECT * FROM vulnerability_discoveries WHERE id = $1', [req.params.id])
    res.json(updated.rows[0])
  } catch (err) {
    await client.query('ROLLBACK')
    console.error(err)
    res.status(500).json({ error: 'failed to reject assignment' })
  } finally {
    client.release()
  }
})

// Mark fixed in UAT
router.post('/:id/uat-remediated', async (req, res) => {
  const { marked_by } = req.body
  if (!marked_by?.trim()) return res.status(400).json({ error: 'marked_by is required' })

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const current = await client.query('SELECT ticket_status FROM vulnerability_discoveries WHERE id = $1', [req.params.id])
    if (current.rows.length === 0) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'not found' }) }
    if (current.rows[0].ticket_status !== 'In Process') {
      await client.query('ROLLBACK')
      return res.status(400).json({ error: 'can only mark UAT remediated from In Process' })
    }

    await client.query(
      `UPDATE vulnerability_discoveries SET ticket_status = 'UAT Remediated', uat_remediated_at = NOW(), updated_by = $1, updated_at = NOW() WHERE id = $2`,
      [marked_by.trim(), req.params.id]
    )
    await logAudit(client, Number(req.params.id), marked_by.trim(), 'UAT Remediated', 'In Process', 'UAT Remediated')

    await client.query('COMMIT')
    const updated = await pool.query('SELECT * FROM vulnerability_discoveries WHERE id = $1', [req.params.id])
    res.json(updated.rows[0])
  } catch (err) {
    await client.query('ROLLBACK')
    console.error(err)
    res.status(500).json({ error: 'failed to mark UAT remediated' })
  } finally {
    client.release()
  }
})

// Mark fixed in Production -> Pending Verification
router.post('/:id/production-remediated', async (req, res) => {
  const { marked_by } = req.body
  if (!marked_by?.trim()) return res.status(400).json({ error: 'marked_by is required' })

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const current = await client.query('SELECT ticket_status, dual_environment_enabled FROM vulnerability_discoveries WHERE id = $1', [req.params.id])
    if (current.rows.length === 0) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'not found' }) }

    const validFrom = current.rows[0].dual_environment_enabled ? 'UAT Remediated' : 'In Process'
    if (current.rows[0].ticket_status !== validFrom) {
      await client.query('ROLLBACK')
      return res.status(400).json({ error: `can only mark Production remediated from ${validFrom}` })
    }

    await client.query(
      `UPDATE vulnerability_discoveries SET ticket_status = 'Pending Verification', production_remediated_at = NOW(), updated_by = $1, updated_at = NOW() WHERE id = $2`,
      [marked_by.trim(), req.params.id]
    )
    await logAudit(client, Number(req.params.id), marked_by.trim(), 'Production Remediated', validFrom, 'Pending Verification')

    await client.query('COMMIT')
    const updated = await pool.query('SELECT * FROM vulnerability_discoveries WHERE id = $1', [req.params.id])
    res.json(updated.rows[0])
  } catch (err) {
    await client.query('ROLLBACK')
    console.error(err)
    res.status(500).json({ error: 'failed to mark production remediated' })
  } finally {
    client.release()
  }
})

// Verifier confirms the fix (retest) -> Closed, or sends back -> Reopened
router.post('/:id/verify', async (req, res) => {
  const { outcome, verified_by, comment } = req.body
  if (!['Confirmed', 'Failed'].includes(outcome)) return res.status(400).json({ error: 'outcome must be Confirmed or Failed' })
  if (!verified_by?.trim()) return res.status(400).json({ error: 'verified_by is required' })

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const current = await client.query('SELECT ticket_status, reopen_count FROM vulnerability_discoveries WHERE id = $1', [req.params.id])
    if (current.rows.length === 0) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'not found' }) }
    if (current.rows[0].ticket_status !== 'Pending Verification') {
      await client.query('ROLLBACK')
      return res.status(400).json({ error: 'can only verify from Pending Verification' })
    }

    if (outcome === 'Confirmed') {
      await client.query(
        `UPDATE vulnerability_discoveries SET ticket_status = 'Closed', closure_reason = 'Remediated', ticket_closed_at = NOW(), updated_by = $1, updated_at = NOW() WHERE id = $2`,
        [verified_by.trim(), req.params.id]
      )
      await logAudit(client, Number(req.params.id), verified_by.trim(), 'Verified - Fix Confirmed', 'Pending Verification', 'Closed', comment)
    } else {
      await client.query(
        `UPDATE vulnerability_discoveries SET ticket_status = 'Reopened', reopen_count = $1, updated_by = $2, updated_at = NOW() WHERE id = $3`,
        [(current.rows[0].reopen_count || 0) + 1, verified_by.trim(), req.params.id]
      )
      await logAudit(client, Number(req.params.id), verified_by.trim(), 'Verified - Fix Failed', 'Pending Verification', 'Reopened', comment)
    }

    await client.query('COMMIT')
    const updated = await pool.query('SELECT * FROM vulnerability_discoveries WHERE id = $1', [req.params.id])
    res.json(updated.rows[0])
  } catch (err) {
    await client.query('ROLLBACK')
    console.error(err)
    res.status(500).json({ error: 'failed to record verification' })
  } finally {
    client.release()
  }
})

// Move a ticket into formal Review (e.g. from Pending Verification) for assessor sign-off
router.post('/:id/request-review', async (req, res) => {
  const { requested_by } = req.body
  if (!requested_by?.trim()) return res.status(400).json({ error: 'requested_by is required' })

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const current = await client.query('SELECT ticket_status FROM vulnerability_discoveries WHERE id = $1', [req.params.id])
    if (current.rows.length === 0) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'not found' }) }
    if (current.rows[0].ticket_status !== 'Pending Verification') {
      await client.query('ROLLBACK')
      return res.status(400).json({ error: 'can only request review from Pending Verification' })
    }

    await client.query(
      `UPDATE vulnerability_discoveries SET ticket_status = 'Review', updated_by = $1, updated_at = NOW() WHERE id = $2`,
      [requested_by.trim(), req.params.id]
    )
    await logAudit(client, Number(req.params.id), requested_by.trim(), 'Review Requested', 'Pending Verification', 'Review')

    await client.query('COMMIT')
    const updated = await pool.query('SELECT * FROM vulnerability_discoveries WHERE id = $1', [req.params.id])
    res.json(updated.rows[0])
  } catch (err) {
    await client.query('ROLLBACK')
    console.error(err)
    res.status(500).json({ error: 'failed to request review' })
  } finally {
    client.release()
  }
})

// Review/verification failed -> re-open the ticket for remediation
router.post('/:id/review-reopen', async (req, res) => {
  const { reopened_by, comment } = req.body
  if (!reopened_by?.trim()) return res.status(400).json({ error: 'reopened_by is required' })

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const current = await client.query('SELECT ticket_status, reopen_count FROM vulnerability_discoveries WHERE id = $1', [req.params.id])
    if (current.rows.length === 0) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'not found' }) }
    if (!['Review', 'Review Accepted'].includes(current.rows[0].ticket_status)) {
      await client.query('ROLLBACK')
      return res.status(400).json({ error: 'can only reopen from Review or Review Accepted' })
    }

    await client.query(
      `UPDATE vulnerability_discoveries SET ticket_status = 'Open', reopen_count = $1, updated_by = $2, updated_at = NOW() WHERE id = $3`,
      [(current.rows[0].reopen_count || 0) + 1, reopened_by.trim(), req.params.id]
    )
    await logAudit(client, Number(req.params.id), reopened_by.trim(), 'Review Failed - Reopened', current.rows[0].ticket_status, 'Open', comment)

    await client.query('COMMIT')
    const updated = await pool.query('SELECT * FROM vulnerability_discoveries WHERE id = $1', [req.params.id])
    res.json(updated.rows[0])
  } catch (err) {
    await client.query('ROLLBACK')
    console.error(err)
    res.status(500).json({ error: 'failed to reopen from review' })
  } finally {
    client.release()
  }
})

// Resume remediation on a Reopened ticket -> back to In Process
router.post('/:id/resume', async (req, res) => {
  const { resumed_by } = req.body
  if (!resumed_by?.trim()) return res.status(400).json({ error: 'resumed_by is required' })

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const current = await client.query('SELECT ticket_status FROM vulnerability_discoveries WHERE id = $1', [req.params.id])
    if (current.rows.length === 0) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'not found' }) }
    if (current.rows[0].ticket_status !== 'Reopened') {
      await client.query('ROLLBACK')
      return res.status(400).json({ error: 'can only resume from Reopened' })
    }

    await client.query(
      `UPDATE vulnerability_discoveries SET ticket_status = 'In Process', updated_by = $1, updated_at = NOW() WHERE id = $2`,
      [resumed_by.trim(), req.params.id]
    )
    await logAudit(client, Number(req.params.id), resumed_by.trim(), 'Resumed Remediation', 'Reopened', 'In Process')

    await client.query('COMMIT')
    const updated = await pool.query('SELECT * FROM vulnerability_discoveries WHERE id = $1', [req.params.id])
    res.json(updated.rows[0])
  } catch (err) {
    await client.query('ROLLBACK')
    console.error(err)
    res.status(500).json({ error: 'failed to resume' })
  } finally {
    client.release()
  }
})

// Close as Duplicate, False Positive, or Compensating Control Applied — the three
// non-remediation terminal reasons. Allowed from any non-terminal state.
router.post('/:id/close-as', async (req, res) => {
  const { reason, closed_by, comment } = req.body
  if (!['Duplicate', 'False Positive', 'Compensating Control Applied'].includes(reason)) {
    return res.status(400).json({ error: 'reason must be Duplicate, False Positive, or Compensating Control Applied' })
  }
  if (!closed_by?.trim()) return res.status(400).json({ error: 'closed_by is required' })

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const current = await client.query('SELECT ticket_status FROM vulnerability_discoveries WHERE id = $1', [req.params.id])
    if (current.rows.length === 0) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'not found' }) }
    const terminalStates = ['Closed', 'Duplicate', 'False Positive', 'Compensating Control Applied']
    if (terminalStates.includes(current.rows[0].ticket_status)) {
      await client.query('ROLLBACK')
      return res.status(400).json({ error: `ticket is already terminal (${current.rows[0].ticket_status})` })
    }

    await client.query(
      `UPDATE vulnerability_discoveries SET ticket_status = $1, closure_reason = $1, ticket_closed_at = NOW(), updated_by = $2, updated_at = NOW() WHERE id = $3`,
      [reason, closed_by.trim(), req.params.id]
    )
    await logAudit(client, Number(req.params.id), closed_by.trim(), `Closed as ${reason}`, current.rows[0].ticket_status, reason, comment)

    await client.query('COMMIT')
    const updated = await pool.query('SELECT * FROM vulnerability_discoveries WHERE id = $1', [req.params.id])
    res.json(updated.rows[0])
  } catch (err) {
    await client.query('ROLLBACK')
    console.error(err)
    res.status(500).json({ error: 'failed to close ticket' })
  } finally {
    client.release()
  }
})

// Generic comment logging without a state change
router.post('/:id/comment', async (req, res) => {
  const { comment, added_by } = req.body
  if (!comment?.trim() || !added_by?.trim()) return res.status(400).json({ error: 'comment and added_by are required' })

  const client = await pool.connect()
  try {
    const current = await client.query('SELECT ticket_status FROM vulnerability_discoveries WHERE id = $1', [req.params.id])
    if (current.rows.length === 0) return res.status(404).json({ error: 'not found' })
    await logAudit(client, Number(req.params.id), added_by.trim(), 'Comment Added', current.rows[0].ticket_status, current.rows[0].ticket_status, comment.trim())
    res.status(201).json({ success: true })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'failed to add comment' })
  } finally {
    client.release()
  }
})

router.get('/:id/audit-history', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM vulnerability_audit_log WHERE discovery_id = $1 ORDER BY created_at ASC`,
      [req.params.id]
    )
    res.json(result.rows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'failed to fetch audit history' })
  }
})

export default router