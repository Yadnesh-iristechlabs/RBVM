import { XMLParser } from 'fast-xml-parser'

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  textNodeName: '#text',
})

export interface ParsedTenableFinding {
  hostname: string
  ip: string | null
  pluginID: string
  pluginName: string
  severity: number
  riskFactor: string | null
  cve: string | null
  cvss3BaseScore: number | null
  cvssBaseScore: number | null
  synopsis: string | null
  description: string | null
  solution: string | null
  port: string | null
  protocol: string | null
}

// Tenable's severity is a category bucket (0-4), NOT the CVSS score.
// Per official docs: 0=informational, 1=low, 2=medium, 3=high, 4=critical.
const SEVERITY_LABELS = ['Info', 'Low', 'Medium', 'High', 'Critical']

export function severityToLabel(severity: number): string {
  return SEVERITY_LABELS[severity] ?? 'Info'
}

// --- Bulk Export API (production-recommended flow) ---
// Per developer.tenable.com: POST /vulns/export queues an export, then
// GET /vulns/export/{uuid}/status polls until chunks are ready, then
// GET /vulns/export/{uuid}/chunks/{chunk_id} downloads each chunk as JSON.
// This is the primary production ingestion path — .nessus XML (above) is
// used for scan-level evidence/audit, not the main bulk sync.

export interface TenableExportVulnChunk {
  asset: { hostname: string | null; ipv4: string | null; uuid: string }
  plugin: { id: number; name: string; family: string | null }
  severity: string // info/low/medium/high/critical, per export API
  cve?: string[]
  cvss3_base_score?: number | null
  cvss_base_score?: number | null
  synopsis?: string | null
  description?: string | null
  solution?: string | null
  port?: { port: number; protocol: string } | null
}

export interface ParsedTenableExportFinding {
  hostname: string
  ip: string | null
  pluginID: string
  pluginName: string
  severity: string
  cve: string | null
  cvssScore: number | null
  synopsis: string | null
  description: string | null
  solution: string | null
  port: number | null
  protocol: string | null
}

// Parses a chunk of the real /vulns/export download response —
// an array of vulnerability records in Tenable's export JSON shape.
export function parseTenableExportChunk(chunk: TenableExportVulnChunk[]): ParsedTenableExportFinding[] {
  return chunk.map((v) => ({
    hostname: v.asset?.hostname ?? v.asset?.uuid ?? 'unknown-host',
    ip: v.asset?.ipv4 ?? null,
    pluginID: String(v.plugin?.id ?? ''),
    pluginName: v.plugin?.name ?? 'Unknown Finding',
    severity: v.severity ?? 'info',
    cve: v.cve?.[0] ?? null,
    cvssScore: v.cvss3_base_score ?? v.cvss_base_score ?? null,
    synopsis: v.synopsis ?? null,
    description: v.description ?? null,
    solution: v.solution ?? null,
    port: v.port?.port ?? null,
    protocol: v.port?.protocol ?? null,
  }))
}

// Parses real .nessus XML export into structured findings.
// Root: NessusClientData_v2 -> Report -> ReportHost[] -> ReportItem[]
export function parseNessusXml(xml: string): ParsedTenableFinding[] {
  const parsed = parser.parse(xml)
  const report = parsed?.NessusClientData_v2?.Report
  if (!report) return []

  const hosts = Array.isArray(report.ReportHost) ? report.ReportHost : [report.ReportHost].filter(Boolean)
  const findings: ParsedTenableFinding[] = []

  for (const host of hosts) {
    const hostname = host?.['@_name'] ?? 'unknown-host'

    // HostProperties tags are optional key/value pairs — extract host-ip defensively
    const tags = Array.isArray(host?.HostProperties?.tag) ? host.HostProperties.tag : [host?.HostProperties?.tag].filter(Boolean)
    const ipTag = tags.find((t: any) => t?.['@_name'] === 'host-ip')
    const ip = ipTag?.['#text'] ?? null

    const items = Array.isArray(host?.ReportItem) ? host.ReportItem : [host?.ReportItem].filter(Boolean)

    for (const item of items) {
      if (!item) continue
      findings.push({
        hostname,
        ip,
        pluginID: item['@_pluginID'] ?? '',
        pluginName: item['@_pluginName'] ?? 'Unknown Finding',
        severity: Number(item['@_severity'] ?? 0),
        riskFactor: item.risk_factor ?? null,
        cve: item.cve ?? null,
        // Per doc caveat: numeric risk comes from cvss3_base_score, NOT the severity bucket
        cvss3BaseScore: item.cvss3_base_score ? Number(item.cvss3_base_score) : null,
        cvssBaseScore: item.cvss_base_score ? Number(item.cvss_base_score) : null,
        synopsis: item.synopsis ?? null,
        description: item.description ?? null,
        solution: item.solution ?? null,
        port: item['@_port'] ?? null,
        protocol: item['@_protocol'] ?? null,
      })
    }
  }

  return findings
}