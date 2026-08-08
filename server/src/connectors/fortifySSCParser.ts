export interface ParsedFortifyIssue {
  id: number
  issueInstanceId: string
  issueName: string
  friority: string
  severity: number
  confidence: number
  analyzer: string | null
  kingdom: string | null
  engineType: string | null
  fullFileName: string | null
  lineNumber: number | null
  primaryLocation: string | null
  audited: boolean
  foundDate: string | null
  projectVersionName: string | null
}

// Parses a real Fortify SSC issues API response
// (GET /api/v1/projectVersions/{id}/issues), matching the official
// { data: [...], count, responseCode, links } envelope.
export function parseFortifyIssues(json: any): ParsedFortifyIssue[] {
  const data = Array.isArray(json?.data) ? json.data : []

  return data.map((issue: any) => ({
    id: issue.id ?? 0,
    issueInstanceId: issue.issueInstanceId ?? '',
    issueName: issue.issueName ?? 'Unknown Issue',
    // friority = Fortify's own priority field: Critical/High/Medium/Low
    friority: issue.friority ?? 'Low',
    severity: issue.severity ?? 0,
    confidence: issue.confidence ?? 0,
    analyzer: issue.analyzer ?? null,
    kingdom: issue.kingdom ?? null,
    engineType: issue.engineType ?? null,
    fullFileName: issue.fullFileName ?? null,
    lineNumber: issue.lineNumber ?? null,
    primaryLocation: issue.primaryLocation ?? null,
    audited: !!issue.audited,
    foundDate: issue.foundDate ?? null,
    projectVersionName: issue.projectVersionName ?? null,
  }))
}