import { pool } from '../db/pool'

const CISA_KEV_URL = 'https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json'
const EPSS_URL = 'https://api.first.org/data/v1/epss'

interface CisaKevEntry {
  cveID: string
  knownRansomwareCampaignUse: string // "Known" or "Unknown"
}

interface CisaKevCatalog {
  vulnerabilities: CisaKevEntry[]
}

// Pulls the full CISA KEV catalog once, builds a lookup map by CVE ID.
async function fetchCisaKevCatalog(): Promise<Map<string, boolean>> {
  const res = await fetch(CISA_KEV_URL)
  if (!res.ok) throw new Error(`CISA KEV fetch failed: ${res.status}`)
  const data = (await res.json()) as CisaKevCatalog

  const map = new Map<string, boolean>()
  for (const entry of data.vulnerabilities) {
    map.set(entry.cveID, entry.knownRansomwareCampaignUse === 'Known')
  }
  return map
}

// EPSS API supports comma-separated CVE batches, capped conservatively at 100 per call.
async function fetchEpssScores(cveIds: string[]): Promise<Map<string, { score: number; percentile: number }>> {
  const map = new Map<string, { score: number; percentile: number }>()
  const batchSize = 100

  for (let i = 0; i < cveIds.length; i += batchSize) {
    const batch = cveIds.slice(i, i + batchSize)
    const res = await fetch(`${EPSS_URL}?cve=${batch.join(',')}`)
    if (!res.ok) {
      console.error(`EPSS fetch failed for batch starting at ${i}: ${res.status}`)
      continue
    }
    const data = (await res.json()) as { data?: Array<{ cve: string; epss: string; percentile: string }> }
    for (const row of data.data ?? []) {
      map.set(row.cve, { score: Number(row.epss), percentile: Number(row.percentile) * 100 })
    }
  }
  return map
}

export async function enrichThreatIntelligence(): Promise<{ kevUpdated: number; epssUpdated: number; failed: number }> {
  let kevUpdated = 0
  let epssUpdated = 0
  let failed = 0

  const { rows: vulns } = await pool.query(
    `SELECT id, cve_id FROM master_vulnerabilities WHERE is_active = true AND cve_id IS NOT NULL`
  )

  if (vulns.length === 0) {
    return { kevUpdated: 0, epssUpdated: 0, failed: 0 }
  }

  let kevMap = new Map<string, boolean>()
  try {
    kevMap = await fetchCisaKevCatalog()
  } catch (err) {
    console.error('[threat-intel] CISA KEV fetch failed, skipping KEV enrichment this run:', err)
  }

  let epssMap = new Map<string, { score: number; percentile: number }>()
  try {
    epssMap = await fetchEpssScores(vulns.map((v) => v.cve_id))
  } catch (err) {
    console.error('[threat-intel] EPSS fetch failed, skipping EPSS enrichment this run:', err)
  }

  for (const v of vulns) {
    try {
      const isKev = kevMap.has(v.cve_id)
      const isRansomware = kevMap.get(v.cve_id) ?? false
      const epss = epssMap.get(v.cve_id)

      await pool.query(
        `UPDATE master_vulnerabilities SET
          cisa_kev = $1, cisa_ransomware = $2,
          epss_score = $3, epss_percentile = $4,
          updated_at = NOW()
         WHERE id = $5`,
        [isKev, isRansomware, epss?.score ?? null, epss?.percentile ?? null, v.id]
      )

      if (isKev) kevUpdated++
      if (epss) epssUpdated++
    } catch (err) {
      console.error(`[threat-intel] failed to update master_vuln_id ${v.id}:`, err)
      failed++
    }
  }

  console.log(`[threat-intel] done — ${kevUpdated} KEV matches, ${epssUpdated} EPSS matches, ${failed} failed`)
  return { kevUpdated, epssUpdated, failed }
}