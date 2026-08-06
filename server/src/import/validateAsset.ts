const ASSET_TYPES = ['Server', 'Workstation', 'Network Device', 'Cloud Instance', 'Container', 'Database', 'Mobile', 'IoT', 'Virtual Machine', 'Firewall', 'Router', 'Switch']
const EXPOSURES = ['Internet', 'Internal', 'Intranet', 'DMZ', 'Cloud', 'Hybrid']
const CLOUD_PROVIDERS = ['AWS', 'Azure', 'GCP', 'OCI', 'On-premises']
const HOSTNAME_ALIASES = ['hostname', 'host', 'asset', 'name', 'device']

function normalizeAssetType(value: string): string | null {
  const v = value.toLowerCase()
  if (v.includes('container') || v.includes('k8s') || v.includes('pod')) return 'Container'
  for (const type of ASSET_TYPES) {
    if (v.includes(type.toLowerCase())) return type
  }
  return null
}

function normalizeExposure(value: string): string | null {
  const v = value.toLowerCase()
  if (v.includes('external') || v.includes('public')) return 'Internet'
  for (const exp of EXPOSURES) {
    if (v.includes(exp.toLowerCase())) return exp
  }
  return null
}

function normalizeCriticality(value: string): string {
  const match = value.match(/tier\s*(\d)/i)
  if (match) return `Tier ${match[1]}`
  return 'Tier 3'
}

function normalizeAgentInstalled(value: string): boolean | null {
  const v = value.toLowerCase().trim()
  if (['yes', 'installed', 'true', '1'].includes(v)) return true
  if (['no', 'not installed', 'false', '0'].includes(v)) return false
  return null
}

export function findHostnameColumn(headers: string[]): string | null {
  const lower = headers.map((h) => h.toLowerCase().trim())
  for (const alias of HOSTNAME_ALIASES) {
    const idx = lower.indexOf(alias)
    if (idx !== -1) return headers[idx]
  }
  return null
}

export interface ValidationError {
  row: number
  field: string
  message: string
}

export function validateRow(row: Record<string, string>, hostnameCol: string, rowIndex: number) {
  const errors: ValidationError[] = []
  const hostname = row[hostnameCol]?.trim()

  if (!hostname) {
    errors.push({ row: rowIndex, field: 'hostname', message: 'hostname is required' })
  }

  const normalized: Record<string, any> = { hostname }

  if (row['Asset Type']) {
    const type = normalizeAssetType(row['Asset Type'])
    if (!type) errors.push({ row: rowIndex, field: 'Asset Type', message: `unrecognized asset type: ${row['Asset Type']}` })
    normalized.asset_type = type
  }

  if (row['Exposure']) {
    const exposure = normalizeExposure(row['Exposure'])
    if (!exposure) errors.push({ row: rowIndex, field: 'Exposure', message: `unrecognized exposure: ${row['Exposure']}` })
    normalized.exposure = exposure
  }

  normalized.criticality = row['Criticality'] ? normalizeCriticality(row['Criticality']) : 'Tier 3'

  if (row['Cloud Provider']) {
    const match = CLOUD_PROVIDERS.find((p) => p.toLowerCase() === row['Cloud Provider'].toLowerCase())
    normalized.cloud_provider = match || row['Cloud Provider']
  }

  if (row['Agent Installed']) {
    normalized.agent_installed = normalizeAgentInstalled(row['Agent Installed'])
  }

  normalized.ip_address = row['IP Address'] || row['IPv4'] || null
  normalized.business_unit = row['Business Unit'] || null
  normalized.os = row['OS'] || null
  normalized.owner = row['Owner'] || null
  normalized.compliance_frameworks = row['Compliance Frameworks'] || null

  return { normalized, errors }
}