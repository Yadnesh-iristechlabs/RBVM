export interface ParsedBurpIssue {
  serialNumber: string
  issueTypeName: string
  severity: string
  originalSeverity: string
  confidence: string
  path: string
  origin: string
  descriptionHtml: string | null
  remediationHtml: string | null
  acceptedRisk: boolean
}

// Parses a real Burp Suite Enterprise GraphQL response for scan issues,
// matching the official Issue object schema (portswigger.net GraphQL docs).
// Note: Burp's API is GraphQL, not REST — the shape returned depends on
// which fields were requested in the query, unlike a fixed REST schema.
export function parseBurpIssues(graphqlResponse: any): ParsedBurpIssue[] {
  const issues = graphqlResponse?.data?.scan?.issues ?? graphqlResponse?.data?.issues ?? []
  const list = Array.isArray(issues) ? issues : [issues].filter(Boolean)

  return list.map((issue: any) => ({
    serialNumber: issue.serial_number ?? '',
    issueTypeName: issue.issue_type?.name ?? 'Unknown Issue',
    severity: issue.severity ?? 'low',
    originalSeverity: issue.original_severity ?? issue.severity ?? 'low',
    confidence: issue.confidence ?? 'tentative',
    path: issue.path ?? '/',
    origin: issue.origin ?? '',
    descriptionHtml: issue.description_html ?? null,
    remediationHtml: issue.remediation_html ?? null,
    acceptedRisk: !!issue.accepted_risk,
  }))
}

// Per PortSwigger's own documentation: "the severity level is only a rough
// approximation... use your knowledge of the context to determine how
// serious each issue is." We preserve this as a caveat, not silently trust it.
export function mapBurpSeverity(severity: string): string {
  const map: Record<string, string> = { critical: 'Critical', high: 'High', medium: 'Medium', low: 'Low', info: 'Low' }
  return map[severity.toLowerCase()] || 'Low'
}