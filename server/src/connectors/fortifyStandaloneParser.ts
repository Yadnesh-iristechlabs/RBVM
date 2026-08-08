export interface ScanCentralJobStatus {
  jobToken: string
  status: string
  state: string
  submittedAt: string | null
  completedAt: string | null
  sensorPoolName: string | null
}

// Parses a real ScanCentral SAST job-status response
// (GET /rest/v4/job/{token}/status), per the official Micro Focus/OpenText docs.
// The exact field set is per-instance (documented in that controller's own
// /rest/api-docs Swagger), so this reads defensively rather than assuming a fixed shape.
export function parseScanCentralJobStatus(json: any): ScanCentralJobStatus {
  return {
    jobToken: json?.jobToken ?? json?.token ?? '',
    status: json?.status ?? json?.jobState ?? 'UNKNOWN',
    state: json?.state ?? json?.status ?? 'UNKNOWN',
    submittedAt: json?.submitDate ?? json?.submittedAt ?? null,
    completedAt: json?.completedDate ?? json?.completedAt ?? null,
    sensorPoolName: json?.sensorPoolName ?? json?.poolName ?? null,
  }
}

// FPR/FVDL has no official published schema (version increments across SCA
// releases — 1.11 to 1.12 in SCA 4.00 per the doc). Per OpenText's own
// recommendation, we treat this as "parse ClassInfo/InstanceInfo defensively,
// gated on the FVDL version attribute" rather than binding to one fixed shape.
export interface FvdlVulnerability {
  classId: string | null
  kingdom: string | null
  analyzerName: string | null
  defaultSeverity: string | null
  instanceId: string | null
  instanceSeverity: number | null
  confidence: number | null
}

export function parseFvdlVulnerability(vuln: any, fvdlVersion?: string): FvdlVulnerability {
  // Gate on version so a future FVDL schema bump doesn't silently misparse
  const supportedVersions = ['1.11', '1.12']
  if (fvdlVersion && !supportedVersions.includes(fvdlVersion)) {
    console.warn(`FVDL version ${fvdlVersion} not explicitly tested — parsing defensively`)
  }

  return {
    classId: vuln?.ClassInfo?.ClassID ?? null,
    kingdom: vuln?.ClassInfo?.Kingdom ?? null,
    analyzerName: vuln?.ClassInfo?.AnalyzerName ?? null,
    defaultSeverity: vuln?.ClassInfo?.DefaultSeverity ?? null,
    instanceId: vuln?.InstanceInfo?.InstanceID ?? null,
    instanceSeverity: vuln?.InstanceInfo?.InstanceSeverity ? Number(vuln.InstanceInfo.InstanceSeverity) : null,
    confidence: vuln?.InstanceInfo?.Confidence ? Number(vuln.InstanceInfo.Confidence) : null,
  }
}