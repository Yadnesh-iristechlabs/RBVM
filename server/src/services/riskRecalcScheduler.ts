import cron from 'node-cron'
import { pool } from '../db/pool'
import { calculateCompositeRisk } from './riskScoreEngine'

// Recalculates composite risk for every active master vulnerability, driven by
// its asset (criticality/exposure), CISA KEV/ransomware, EPSS, and the most
// recent active discovery (severity/CVSS/status/published date).
// Runs daily at midnight per Kapil's spec. Also exported for manual/on-demand runs.

export async function recalculateAllRiskScores(): Promise<{ updated: number; failed: number }> {
  let updated = 0
  let failed = 0

  const { rows: vulns } = await pool.query(`
    SELECT
      mv.id AS master_vuln_id,
      mv.severity,
      mv.cvss_score,
      mv.cisa_kev,
      mv.cisa_ransomware,
      mv.epss_score,
      a.criticality AS asset_tier,
      a.exposure
    FROM master_vulnerabilities mv
    JOIN assets a ON a.id = mv.asset_id
    WHERE mv.is_active = true
  `)

  for (const v of vulns) {
    try {
      const { rows: discoveries } = await pool.query(
        `SELECT ticket_status, created_at
         FROM vulnerability_discoveries
         WHERE master_vuln_id = $1 AND is_active = true
         ORDER BY created_at DESC LIMIT 1`,
        [v.master_vuln_id]
      )

      const discovery = discoveries[0]
      const publishedAt = discovery?.created_at ? new Date(discovery.created_at) : new Date()
      const remediatedStatuses = ['Production Remediated', 'Pending Verification', 'Closed']
      const isRemediated = discovery ? remediatedStatuses.includes(discovery.ticket_status) : false

      const result = calculateCompositeRisk({
        cvssScore: v.cvss_score,
        sourceRisk: v.severity,
        cisaKev: v.cisa_kev ?? false,
        cisaRansomware: v.cisa_ransomware ?? false,
        epssScore: v.epss_score,
        assetTier: v.asset_tier,
        exposure: v.exposure,
        certInAdvisory: false,
        publishedAt,
        isRemediated,
      })

      await pool.query(
        `UPDATE master_vulnerabilities SET risk_score = $1, inherent_risk = $2, updated_at = NOW() WHERE id = $3`,
        [result.score, result.rating, v.master_vuln_id]
      )

      if (discovery) {
        await pool.query(
          `UPDATE vulnerability_discoveries SET compliance_status = $1, compliance_expiry_date = $2
           WHERE master_vuln_id = $3 AND is_active = true`,
          [result.complianceStatus, result.complianceExpiryDate, v.master_vuln_id]
        )
      }

      updated++
    } catch (err) {
      console.error(`risk recalculation failed for master_vuln_id ${v.master_vuln_id}:`, err)
      failed++
    }
  }

  console.log(`[risk-recalc] done — ${updated} updated, ${failed} failed`)
  return { updated, failed }
}

export function startRiskRecalculationScheduler() {
  cron.schedule('0 0 * * *', async () => {
    console.log('[risk-recalc] starting scheduled midnight run')
    try {
      const { enrichThreatIntelligence } = await import('./threatIntelEnrichment')
      await enrichThreatIntelligence()
    } catch (err) {
      console.error('[risk-recalc] threat intel sync failed, continuing with stale data:', err)
    }
    await recalculateAllRiskScores()
  })
  console.log('[risk-recalc] scheduler registered — daily at midnight')
}