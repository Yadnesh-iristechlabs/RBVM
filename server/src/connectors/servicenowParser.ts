export interface ParsedServiceNowCI {
  sysId: string
  name: string
  ipAddress: string | null
  os: string | null
  sysClassName: string | null
  fqdn: string | null
  hostName: string | null
  assignedTo: string | null
  operationalStatus: string | null
}

// Parses a real ServiceNow Table API response (GET /api/now/table/cmdb_ci),
// matching the official response envelope: { result: [...] }.
// Per official docs, reference fields (e.g. assigned_to) return
// { link, value } by default — this reads .value defensively.
export function parseServiceNowCIs(json: any): ParsedServiceNowCI[] {
  const records = Array.isArray(json?.result) ? json.result : []

  return records.map((r: any) => ({
    sysId: r.sys_id ?? '',
    name: r.name ?? 'Unknown CI',
    ipAddress: r.ip_address ?? null,
    os: r.os ?? null,
    sysClassName: r.sys_class_name ?? null,
    fqdn: r.fqdn ?? null,
    hostName: r.host_name ?? null,
    // Reference field — extract .value (sys_id) since .link is a URL, not display data
    assignedTo: typeof r.assigned_to === 'object' ? r.assigned_to?.value ?? null : r.assigned_to ?? null,
    operationalStatus: r.operational_status ?? null,
  }))
}