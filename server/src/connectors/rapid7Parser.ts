export interface ParsedRapid7Finding {
  vulnId: string
  status: string
  since: string | null
  checkId: string | null
  port: number | null
  protocol: string | null
  proof: string | null
}

// Parses a real Rapid7 InsightVM APIv3 VulnerabilityFinding response
// (GET /api/3/assets/{id}/vulnerabilities), matching the official
// resources[]/page/VulnerabilityFinding/AssessmentResult schema.
export function parseRapid7Findings(json: any): ParsedRapid7Finding[] {
  const resources = Array.isArray(json?.resources) ? json.resources : []
  const findings: ParsedRapid7Finding[] = []

  for (const finding of resources) {
    if (finding.status !== 'vulnerable') continue // skip invulnerable/no-results per official status enum

    const results = Array.isArray(finding.results) ? finding.results : []
    if (results.length === 0) {
      findings.push({ vulnId: finding.id, status: finding.status, since: finding.since ?? null, checkId: null, port: null, protocol: null, proof: null })
      continue
    }

    for (const result of results) {
      findings.push({
        vulnId: finding.id,
        status: result.status ?? finding.status,
        since: result.since ?? finding.since ?? null,
        checkId: result.checkId ?? null,
        port: result.port ?? null,
        protocol: result.protocol ?? null,
        proof: result.proof ?? null,
      })
    }
  }

  return findings
}

// Rapid7's lightweight finding only has an id — full title/CVSS/CVE/description
// requires a second call to GET /api/3/vulnerabilities/{id}, per official docs.
// This mirrors that structure so the real integration slots in without redesign.
export interface Rapid7VulnerabilityDetail {
  id: string
  title: string
  severity: string
  cvssScore: number | null
  cves: string[]
  description: string | null
}

export function mapRapid7Severity(cvssScore: number | null): string {
  if (cvssScore === null) return 'Low'
  if (cvssScore >= 9) return 'Critical'
  if (cvssScore >= 7) return 'High'
  if (cvssScore >= 4) return 'Medium'
  return 'Low'
}