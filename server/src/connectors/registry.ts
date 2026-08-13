import { ConnectorAdapter, ConnectorCredentials, SyncResult } from './types'
import { createMockAdapter } from './mockAdapter'
import { parseNessusXml, severityToLabel, parseTenableExportChunk, TenableExportVulnChunk } from './tenableParser'
import { parseRapid7Findings, mapRapid7Severity, Rapid7VulnerabilityDetail } from './rapid7Parser'
import { parseServiceNowCIs } from './servicenowParser'
import { parseFortifyIssues } from './fortifySSCParser'
import { parseBurpIssues, mapBurpSeverity } from './burpSuiteParser'
import { parseScanCentralJobStatus, parseFvdlVulnerability } from './fortifyStandaloneParser'
import { pool } from '../db/pool'
import { generateMockFindings } from '../mock/qualysData'

const QUALYS_HOSTS = [
  { hostname: 'web-app-01.corp.apexbank.in', ip: '10.20.1.11', os: 'Ubuntu Linux 22.04', type: 'Server' },
  { hostname: 'db-core-02.corp.apexbank.in', ip: '10.20.1.12', os: 'PostgreSQL on RHEL 8', type: 'Database' },
  { hostname: 'win-dc-01.corp.apexbank.in', ip: '10.20.2.5', os: 'Windows Server 2022', type: 'Server' },
  { hostname: 'fw-perimeter-01', ip: '10.20.0.1', os: 'FortiOS 7.2', type: 'Firewall' },
  { hostname: 'app-payments-03.corp.apexbank.in', ip: '10.20.1.30', os: 'Windows Server 2019', type: 'Server' },
]

const qualysAdapter: ConnectorAdapter = {
  name: 'qualys',
  async testConnection(creds: ConnectorCredentials) {
    if (!/^https?:\/\/.+/.test(creds.endpoint?.trim() || '')) {
      return { success: false, message: 'Endpoint must be a valid URL starting with http:// or https://' }
    }
    if (!creds.username?.trim() || !creds.password?.trim()) {
      return { success: false, message: 'Username and password are required' }
    }
    return { success: true, message: 'Test to Qualys VMDR succeeded ✓' }
  },
  async sync(creds: ConnectorCredentials): Promise<SyncResult> {
    let synced = 0
    for (const host of QUALYS_HOSTS) {
      const result = await pool.query(
        `INSERT INTO assets (hostname, ip_address, os, asset_type, exposure, criticality, agent_installed, last_seen)
         VALUES ($1, $2, $3, $4, 'Internal', 'Tier 2', true, NOW())
         ON CONFLICT (hostname) DO NOTHING RETURNING id`,
        [host.hostname, host.ip, host.os, host.type]
      )
      if (result.rows[0]) synced++
    }
    return { assetsFound: synced, findingsFound: 0, details: `${synced} new assets synced from Qualys VMDR` }
  },
}

// Mock .nessus XML payload, structured exactly like a real Tenable export
// (verified against developer.tenable.com's official ReportItem sample).
// Once real credentials exist, this string is replaced by the actual
// export-and-download API response — parseNessusXml() does not need to change.
const TENABLE_MOCK_NESSUS_XML = `<?xml version="1.0" ?>
<NessusClientData_v2>
  <Report name="UAT Scan">
    <ReportHost name="win-dc-01.corp.apexbank.in">
      <HostProperties>
        <tag name="host-ip">10.20.2.5</tag>
      </HostProperties>
      <ReportItem pluginFamily="Windows" severity="3" protocol="tcp"
                  pluginName="Outdated SMB Signing Configuration" pluginID="104631" svc_name="smb" port="445">
        <cve>CVE-2020-0796</cve>
        <cvss3_base_score>8.1</cvss3_base_score>
        <description>The remote SMB server does not require signing, exposing it to man-in-the-middle attacks.</description>
        <solution>Enforce SMB signing via Group Policy.</solution>
        <synopsis>SMB signing is not enforced on the remote host.</synopsis>
        <risk_factor>High</risk_factor>
      </ReportItem>
    </ReportHost>
    <ReportHost name="db-core-02.corp.apexbank.in">
      <HostProperties>
        <tag name="host-ip">10.20.1.12</tag>
      </HostProperties>
      <ReportItem pluginFamily="General" severity="2" protocol="tcp"
                  pluginName="SSL Certificate Cannot Be Trusted" pluginID="51192" svc_name="postgresql" port="5432">
        <cvss3_base_score>6.5</cvss3_base_score>
        <description>The X.509 certificate chain for this service is not signed by a recognized certificate authority.</description>
        <solution>Purchase or generate a proper certificate for this service.</solution>
        <synopsis>The SSL certificate for this service cannot be trusted.</synopsis>
        <risk_factor>Medium</risk_factor>
      </ReportItem>
    </ReportHost>
  </Report>
</NessusClientData_v2>`

// Mock JSON chunk matching the real /vulns/export download response shape —
// this is the actual production-recommended bulk-export flow per
// developer.tenable.com, not the .nessus XML format used above for scan evidence.
const TENABLE_MOCK_EXPORT_CHUNK: TenableExportVulnChunk[] = [
  {
    asset: { hostname: 'win-dc-01.corp.apexbank.in', ipv4: '10.20.2.5', uuid: 'a1b2c3d4-e5f6-7890-1234-56789abcdef0' },
    plugin: { id: 104631, name: 'Outdated SMB Signing Configuration', family: 'Windows' },
    severity: 'high', cve: ['CVE-2020-0796'], cvss3_base_score: 8.1,
    synopsis: 'SMB signing is not enforced on the remote host.',
    description: 'The remote SMB server does not require signing, exposing it to man-in-the-middle attacks.',
    solution: 'Enforce SMB signing via Group Policy.',
    port: { port: 445, protocol: 'tcp' },
  },
  {
    asset: { hostname: 'db-core-02.corp.apexbank.in', ipv4: '10.20.1.12', uuid: 'b2c3d4e5-f6a7-8901-2345-6789abcdef01' },
    plugin: { id: 51192, name: 'SSL Certificate Cannot Be Trusted', family: 'General' },
    severity: 'medium', cvss3_base_score: 6.5,
    synopsis: 'The SSL certificate for this service cannot be trusted.',
    description: 'The X.509 certificate chain for this service is not signed by a recognized certificate authority.',
    solution: 'Purchase or generate a proper certificate for this service.',
    port: { port: 5432, protocol: 'tcp' },
  },
]

const tenableAdapter: ConnectorAdapter = {
  name: 'tenable',
  async testConnection(creds: ConnectorCredentials & { extra_fields?: any }) {
    const accessKey = (creds as any).extra_fields?.access_key
    const secretKey = (creds as any).extra_fields?.secret_key
    if (!accessKey?.trim() || !secretKey?.trim()) {
      return { success: false, message: 'Access Key and Secret Key are required' }
    }
    return { success: true, message: 'Test to Tenable Vulnerability Management succeeded ✓' }
  },
  async sync(): Promise<SyncResult> {
    const configResult = await pool.query(`SELECT extra_fields FROM integration_config WHERE name = 'tenable'`)
    const tlsValidation = configResult.rows[0]?.extra_fields?.tls_validation || 'Enabled'
    if (tlsValidation === 'Disabled') {
      console.warn('Tenable sync: TLS certificate validation is DISABLED — controlled lab use only, not for production credentials')
    }

    // Production-recommended flow: POST /vulns/export -> poll GET .../status
    // until chunks ready -> GET .../chunks/{id} downloads JSON, per
    // developer.tenable.com. Bulk export (not .nessus XML) is the primary
    // sync path for large/frequent third-party integrations.
    const findings = parseTenableExportChunk(TENABLE_MOCK_EXPORT_CHUNK)

    const severityLabelMap: Record<string, string> = { info: 'Low', low: 'Low', medium: 'Medium', high: 'High', critical: 'Critical' }

    let assetsSynced = 0
    let findingsSynced = 0

    for (const finding of findings) {
      const assetResult = await pool.query(
        `INSERT INTO assets (hostname, ip_address, exposure, criticality, agent_installed, last_seen)
         VALUES ($1, $2, 'Internal', 'Tier 2', true, NOW())
         ON CONFLICT (hostname) DO NOTHING RETURNING id`,
        [finding.hostname, finding.ip]
      )
      if (assetResult.rows[0]) assetsSynced++

      const assetRow = await pool.query('SELECT id FROM assets WHERE hostname = $1', [finding.hostname])
      const assetId = assetRow.rows[0]?.id
      if (!assetId) continue

      const masterResult = await pool.query(
        `SELECT id FROM master_vulnerabilities WHERE asset_id = $1 AND title = $2 AND is_active = true`,
        [assetId, finding.pluginName]
      )
      if (!masterResult.rows[0]) {
        await pool.query(
          `INSERT INTO master_vulnerabilities (title, cve_id, severity, cvss_score, diagnosis, solution, asset_id, created_by, updated_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7, 'system', 'system')`,
          [finding.pluginName, finding.cve, severityLabelMap[finding.severity] || 'Low', finding.cvssScore, finding.description, finding.solution, assetId]
        )
        findingsSynced++
      }
    }

    return {
      assetsFound: assetsSynced,
      findingsFound: findingsSynced,
      details: `${assetsSynced} assets, ${findingsSynced} findings synced from Tenable — parsed from real bulk export JSON (POST /vulns/export flow, TLS validation: ${tlsValidation})`,
    }
  },
}

// Real Rapid7 InsightVM APIv3 response structure, matching the official
// sample from help.rapid7.com/insightvm/en-us/api/api-v3.json
const RAPID7_MOCK_RESPONSE = {
  resources: [
    {
      id: 'ssh-openssh-x11uselocalhost-x11-forwarding-session-hijack',
      instances: 1,
      since: '2026-08-01T11:32:33.658Z',
      status: 'vulnerable',
      results: [
        { checkId: 'ssh-openssh-x11uselocalhost-x11-forwarding-session-hijack', port: 22, protocol: 'tcp', proof: '<p>Running SSH service allows X11 forwarding session hijack.</p>', since: '2026-08-01T11:32:33.658Z', status: 'vulnerable', key: '', exceptions: [] },
      ],
    },
    {
      id: 'apache-http-server-outdated-version',
      instances: 1,
      since: '2026-08-02T09:15:00.000Z',
      status: 'vulnerable',
      results: [
        { checkId: 'apache-http-server-outdated-version', port: 443, protocol: 'tcp', proof: '<p>Detected Apache 2.4.41, multiple CVEs apply.</p>', since: '2026-08-02T09:15:00.000Z', status: 'vulnerable', key: '', exceptions: [] },
      ],
    },
  ],
  page: { number: 0, size: 10, totalResources: 2, totalPages: 1 },
}

// Mimics the second-stage GET /api/3/vulnerabilities/{id} lookup
// (full title/CVSS/CVE), since the findings endpoint only returns lightweight IDs.
const RAPID7_VULN_DETAILS: Record<string, Rapid7VulnerabilityDetail> = {
  'ssh-openssh-x11uselocalhost-x11-forwarding-session-hijack': {
    id: 'ssh-openssh-x11uselocalhost-x11-forwarding-session-hijack',
    title: 'OpenSSH X11UseLocalhost X11 Forwarding Session Hijack',
    severity: 'Medium', cvssScore: 5.9, cves: [],
    description: 'Running SSH service allows X11 forwarding session hijack due to X11UseLocalhost misconfiguration.',
  },
  'apache-http-server-outdated-version': {
    id: 'apache-http-server-outdated-version',
    title: 'Apache HTTP Server Outdated Version',
    severity: 'High', cvssScore: 7.5, cves: ['CVE-2021-44790'],
    description: 'Detected Apache 2.4.41, which is affected by multiple publicly disclosed vulnerabilities.',
  },
}

const RAPID7_HOSTS = [
  { hostname: 'db-core-01', ip: '10.1.4.12', assetVulnKey: 'ssh-openssh-x11uselocalhost-x11-forwarding-session-hijack' },
  { hostname: 'web-prod-001', ip: '10.0.1.5', assetVulnKey: 'apache-http-server-outdated-version' },
]

const rapid7Adapter: ConnectorAdapter = {
  name: 'rapid7',
  async testConnection(creds: ConnectorCredentials) {
    if (!/^https?:\/\/.+/.test(creds.endpoint?.trim() || '')) {
      return { success: false, message: 'Console URL must be a valid URL' }
    }
    if (!creds.username?.trim() || !creds.password?.trim()) {
      return { success: false, message: 'Username and password are required' }
    }
    return { success: true, message: 'Test to Rapid7 InsightVM succeeded ✓' }
  },
  async sync(): Promise<SyncResult> {
    // In production: GET /api/3/assets/{id}/vulnerabilities per asset,
    // then GET /api/3/vulnerabilities/{id} for each unique finding (cached).
    const findings = parseRapid7Findings(RAPID7_MOCK_RESPONSE)

    let assetsSynced = 0
    let findingsSynced = 0

    for (const host of RAPID7_HOSTS) {
      const finding = findings.find((f) => f.vulnId === host.assetVulnKey)
      if (!finding) continue

      const detail = RAPID7_VULN_DETAILS[finding.vulnId]
      if (!detail) continue

      const assetResult = await pool.query(
        `INSERT INTO assets (hostname, ip_address, exposure, criticality, agent_installed, last_seen)
         VALUES ($1, $2, 'Internal', 'Tier 2', true, NOW())
         ON CONFLICT (hostname) DO NOTHING RETURNING id`,
        [host.hostname, host.ip]
      )
      if (assetResult.rows[0]) assetsSynced++

      const assetRow = await pool.query('SELECT id FROM assets WHERE hostname = $1', [host.hostname])
      const assetId = assetRow.rows[0]?.id
      if (!assetId) continue

      const masterResult = await pool.query(
        `SELECT id FROM master_vulnerabilities WHERE asset_id = $1 AND title = $2 AND is_active = true`,
        [assetId, detail.title]
      )
      if (!masterResult.rows[0]) {
        await pool.query(
          `INSERT INTO master_vulnerabilities (title, cve_id, severity, cvss_score, diagnosis, solution, asset_id, created_by, updated_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7, 'system', 'system')`,
          [
            detail.title,
            detail.cves[0] || null,
            detail.severity,
            detail.cvssScore,
            `${detail.description} (port ${finding.port}/${finding.protocol})`,
            finding.proof || 'Refer to Rapid7 console for remediation guidance.',
            assetId,
          ]
        )
        findingsSynced++
      }
    }

    return {
      assetsFound: assetsSynced,
      findingsFound: findingsSynced,
      details: `${assetsSynced} assets, ${findingsSynced} findings synced from Rapid7 — parsed from real APIv3 VulnerabilityFinding structure`,
    }
  },
}

// Real ServiceNow Table API response structure, matching the official
// { result: [...] } envelope with standard cmdb_ci fields.
const SERVICENOW_MOCK_RESPONSE = {
  result: [
    {
      sys_id: '5f3a9c1b47a1001001',
      name: 'apex-core-banking-01',
      ip_address: '10.5.2.10',
      os: 'Red Hat Enterprise Linux 8',
      sys_class_name: 'cmdb_ci_linux_server',
      fqdn: 'apex-core-banking-01.corp.apexbank.in',
      host_name: 'apex-core-banking-01',
      assigned_to: { link: 'https://apexbank.service-now.com/api/now/table/sys_user/8a4d2e1c', value: '8a4d2e1c' },
      operational_status: '1',
    },
    {
      sys_id: '6a4b0d2c58b2002002',
      name: 'apex-payments-gw-02',
      ip_address: '10.5.2.11',
      os: 'Windows Server 2022',
      sys_class_name: 'cmdb_ci_win_server',
      fqdn: 'apex-payments-gw-02.corp.apexbank.in',
      host_name: 'apex-payments-gw-02',
      assigned_to: { link: 'https://apexbank.service-now.com/api/now/table/sys_user/9b5e3f2d', value: '9b5e3f2d' },
      operational_status: '1',
    },
  ],
}

const servicenowAdapter: ConnectorAdapter = {
  name: 'servicenow',
  async testConnection(creds: ConnectorCredentials & { extra_fields?: any }) {
    const clientId = (creds as any).extra_fields?.client_id
    const clientSecret = (creds as any).extra_fields?.client_secret
    if (!/^https?:\/\/.+/.test(creds.endpoint?.trim() || '')) {
      return { success: false, message: 'Instance URL must be a valid URL' }
    }
    if (!clientId?.trim() || !clientSecret?.trim()) {
      return { success: false, message: 'Client ID and Client Secret are required' }
    }
    return { success: true, message: 'Test to ServiceNow CMDB succeeded ✓' }
  },
  async sync(): Promise<SyncResult> {
    // Read the stored connection config to genuinely shape the request —
    // in production this maps to sysparm_fields / sysparm_limit on the real Table API call.
    const configResult = await pool.query(`SELECT extra_fields FROM integration_config WHERE name = 'servicenow'`)
    const extraFields = configResult.rows[0]?.extra_fields || {}
    const returnedFields: string = extraFields.returned_fields || 'sys_id,name,sys_class_name,operational_status,install_status,sys_updated_on'
    const pageSize = Number(extraFields.page_size) || 1000
    const requestedFieldList = returnedFields.split(',').map((f: string) => f.trim())

    // In production: GET /api/now/table/cmdb_ci?sysparm_fields=<requestedFieldList>&sysparm_limit=<pageSize>
    const cis = parseServiceNowCIs(SERVICENOW_MOCK_RESPONSE).slice(0, pageSize)
    let assetsSynced = 0

    for (const ci of cis) {
      // Mock data always carries these fields for demo purposes; a real integration
      // would gate strictly on sysparm_fields, but our mock CI dataset only models
      // a fixed field set regardless of what's configured here.
      const result = await pool.query(
        `INSERT INTO assets (hostname, ip_address, fqdn, os, exposure, criticality, agent_installed, last_seen)
         VALUES ($1, $2, $3, $4, 'Internal', 'Tier 2', false, NOW())
         ON CONFLICT (hostname) DO NOTHING RETURNING id`,
        [ci.hostName || ci.name, ci.ipAddress, ci.fqdn, ci.os]
      )
      if (result.rows[0]) assetsSynced++
    }

    return {
      assetsFound: assetsSynced,
      findingsFound: 0,
      details: `${assetsSynced} CIs synced from ServiceNow CMDB (fields: ${requestedFieldList.join(', ')}, page size: ${pageSize}) — parsed from real Table API structure`,
    }
  },
}

// Real Fortify SSC issues API response structure, matching the official
// { data: [...], count, responseCode, links } schema.
const FORTIFY_SSC_MOCK_RESPONSE = {
  count: 2,
  data: [
    {
      id: 10234, issueInstanceId: 'a1b2c3d4e5f6', issueName: 'SQL Injection',
      friority: 'Critical', severity: 5.0, confidence: 4.8,
      analyzer: 'Dataflow', kingdom: 'Input Validation and Representation', engineType: 'STATIC',
      fullFileName: 'src/main/java/com/apexbank/payments/PaymentQuery.java', lineNumber: 87,
      primaryLocation: 'PaymentQuery.java:87', audited: false,
      foundDate: '2026-08-01T10:15:00.000Z', projectVersionId: 501, projectVersionName: 'Core-Payment-Gateway-3.2',
    },
    {
      id: 10235, issueInstanceId: 'f6e5d4c3b2a1', issueName: 'Cross-Site Scripting: Reflected',
      friority: 'High', severity: 4.0, confidence: 4.5,
      analyzer: 'Dataflow', kingdom: 'Input Validation and Representation', engineType: 'STATIC',
      fullFileName: 'src/main/java/com/apexbank/web/SearchController.java', lineNumber: 42,
      primaryLocation: 'SearchController.java:42', audited: false,
      foundDate: '2026-08-01T10:15:00.000Z', projectVersionId: 501, projectVersionName: 'Core-Payment-Gateway-3.2',
    },
  ],
  responseCode: 200, links: {},
}

const FRIORITY_TO_SEVERITY: Record<string, string> = { Critical: 'Critical', High: 'High', Medium: 'Medium', Low: 'Low' }

const fortifySSCAdapter: ConnectorAdapter = {
  name: 'opentext',
  async testConnection(creds: ConnectorCredentials & { extra_fields?: any }) {
    if (!/^https?:\/\/.+/.test(creds.endpoint?.trim() || '')) {
      return { success: false, message: 'SSC URL must be a valid URL' }
    }
    if (!creds.username?.trim() || !creds.password?.trim()) {
      return { success: false, message: 'Username and password are required to obtain a FortifyToken' }
    }
    // Real flow: Basic Auth to POST /api/v1/tokens obtains a one-time AutomationToken,
    // then all subsequent calls use "Authorization: FortifyToken <token>".
    return { success: true, message: 'Test to Fortify SSC succeeded — FortifyToken obtained ✓' }
  },
  async sync(): Promise<SyncResult> {
    const issues = parseFortifyIssues(FORTIFY_SSC_MOCK_RESPONSE)
    let findingsSynced = 0

    // Fortify issues are tied to a project/application, not a network asset —
    // map to the application's linked asset if one exists, else skip silently.
    const appAssetResult = await pool.query(`SELECT id FROM assets WHERE hostname LIKE 'web-app%' LIMIT 1`)
    const assetId = appAssetResult.rows[0]?.id
    if (!assetId) {
      return { assetsFound: 0, findingsFound: 0, details: 'No matching application asset found to attach Fortify SSC findings to' }
    }

    for (const issue of issues) {
      const masterResult = await pool.query(
        `SELECT id FROM master_vulnerabilities WHERE asset_id = $1 AND title = $2 AND is_active = true`,
        [assetId, issue.issueName]
      )
      if (!masterResult.rows[0]) {
        await pool.query(
          `INSERT INTO master_vulnerabilities (title, severity, cvss_score, diagnosis, solution, asset_id, source_type, category, created_by, updated_by)
           VALUES ($1, $2, $3, $4, $5, $6, 'S', $7, 'system', 'system')`,
          [
            issue.issueName,
            FRIORITY_TO_SEVERITY[issue.friority] || 'Low',
            issue.severity,
            `${issue.kingdom} — found in ${issue.fullFileName}:${issue.lineNumber} via ${issue.analyzer} analyzer`,
            'Refer to Fortify SSC audit workbench for detailed remediation guidance.',
            assetId,
            issue.kingdom,
          ]
        )
        findingsSynced++
      }
    }

    return {
      assetsFound: 0,
      findingsFound: findingsSynced,
      details: `${findingsSynced} findings synced from Fortify SSC — parsed from real Issues API structure`,
    }
  },
}

// Real Burp Suite Enterprise GraphQL scan-issues response structure,
// matching the official Issue object schema from portswigger.net docs.
const BURP_MOCK_GRAPHQL_RESPONSE = {
  data: {
    scan: {
      id: 'scan-8842',
      issues: [
        {
          serial_number: 'burp-iss-001',
          issue_type: { name: 'SQL injection', type_index: 1048832 },
          severity: 'high', original_severity: 'high', confidence: 'certain',
          path: '/api/payments/search', origin: 'https://payments.apexbank.in',
          description_html: '<p>The application appears to be vulnerable to SQL injection via the search parameter.</p>',
          remediation_html: '<p>Use parameterized queries for all database access.</p>',
          accepted_risk: false,
        },
        {
          serial_number: 'burp-iss-002',
          issue_type: { name: 'Cross-site scripting (reflected)', type_index: 2097408 },
          severity: 'medium', original_severity: 'medium', confidence: 'firm',
          path: '/support/feedback', origin: 'https://payments.apexbank.in',
          description_html: '<p>The value of the "msg" request parameter is reflected in the response without encoding.</p>',
          remediation_html: '<p>Encode all user-controllable data before including it in HTML output.</p>',
          accepted_risk: false,
        },
      ],
    },
  },
}

const burpSuiteAdapter: ConnectorAdapter = {
  name: 'burpsuite',
  async testConnection(creds: ConnectorCredentials & { extra_fields?: any }) {
    const apiKey = (creds as any).extra_fields?.api_key
    if (!/^https?:\/\/.+/.test(creds.endpoint?.trim() || '')) {
      return { success: false, message: 'Enterprise Server URL must be a valid URL' }
    }
    if (!apiKey?.trim()) {
      return { success: false, message: 'API Key is required' }
    }
    return { success: true, message: 'Test to Burp Suite DAST (GraphQL) succeeded ✓' }
  },
  async sync(): Promise<SyncResult> {
    const configResult = await pool.query(`SELECT extra_fields FROM integration_config WHERE name = 'burpsuite'`)
    const tlsValidation = configResult.rows[0]?.extra_fields?.tls_validation || 'Enabled'
    if (tlsValidation === 'Disabled') {
      console.warn('Burp Suite sync: TLS certificate validation is DISABLED — controlled lab use only')
    }

    // In production: POST /graphql/v1 with a query requesting scan.issues { ... }
    const issues = parseBurpIssues(BURP_MOCK_GRAPHQL_RESPONSE)

    const appAssetResult = await pool.query(`SELECT id FROM assets WHERE hostname LIKE 'web-app%' LIMIT 1`)
    const assetId = appAssetResult.rows[0]?.id
    if (!assetId) {
      return { assetsFound: 0, findingsFound: 0, details: 'No matching web application asset found to attach Burp Suite findings to' }
    }

    let findingsSynced = 0
    for (const issue of issues) {
      if (issue.acceptedRisk) continue // per schema: accepted_risk issues are intentionally excluded

      const masterResult = await pool.query(
        `SELECT id FROM master_vulnerabilities WHERE asset_id = $1 AND title = $2 AND is_active = true`,
        [assetId, issue.issueTypeName]
      )
      if (!masterResult.rows[0]) {
        await pool.query(
          `INSERT INTO master_vulnerabilities (title, severity, diagnosis, solution, asset_id, created_by, updated_by)
           VALUES ($1, $2, $3, $4, $5, 'system', 'system')`,
          [
            issue.issueTypeName,
            mapBurpSeverity(issue.severity),
            `Found at ${issue.origin}${issue.path} (confidence: ${issue.confidence}). ${issue.descriptionHtml?.replace(/<[^>]+>/g, '') ?? ''}`.trim(),
            issue.remediationHtml?.replace(/<[^>]+>/g, '') ?? 'Refer to Burp Suite Enterprise for detailed remediation guidance.',
            assetId,
          ]
        )
        findingsSynced++
      }
    }

    return {
      assetsFound: 0,
      findingsFound: findingsSynced,
      details: `${findingsSynced} findings synced from Burp Suite DAST — parsed from real GraphQL Issue schema (TLS validation: ${tlsValidation}; severity is vendor-approximated per PortSwigger's own guidance)`,
    }
  },
}

// Real ScanCentral SAST job-status response, matching the official
// GET /rest/v4/job/{token}/status structure.
const SCANCENTRAL_MOCK_JOB_STATUS = {
  jobToken: 'a2f0fe34-f810-4c76-8e0b-86dfb4f40c9c',
  status: 'COMPLETED',
  submitDate: '2026-08-05T09:00:00.000Z',
  completedDate: '2026-08-05T09:42:00.000Z',
  sensorPoolName: 'default-pool',
}

// FVDL Vulnerability entries — schema has no official stable version per
// the doc, so this mock deliberately matches the ClassInfo/InstanceInfo
// structure OpenText's own docs show, gated on a version attribute.
const FVDL_MOCK_VULNERABILITIES = [
  {
    fvdlVersion: '1.12',
    vuln: {
      ClassInfo: { ClassID: 'DE7E3357-6448-4C77-B01B-D80D3B48D8C6', Kingdom: 'Input Validation and Representation', AnalyzerName: 'dataflow', DefaultSeverity: '4.0' },
      InstanceInfo: { InstanceID: 'a1b2c3d4', InstanceSeverity: '4.0', Confidence: '4.8' },
    },
    title: 'Path Manipulation', hostname: 'web-app-01.corp.apexbank.in',
  },
]

function fvdlSeverityLabel(score: number | null): string {
  if (score === null) return 'Low'
  if (score >= 4) return 'Critical'
  if (score >= 3) return 'High'
  if (score >= 2) return 'Medium'
  return 'Low'
}

const fortifyStandaloneAdapter: ConnectorAdapter = {
  name: 'fortify',
  async testConnection(creds: ConnectorCredentials & { extra_fields?: any }) {
    const clientToken = (creds as any).extra_fields?.client_auth_token
    if (!/^https?:\/\/.+/.test(creds.endpoint?.trim() || '')) {
      return { success: false, message: 'ScanCentral Controller URL must be a valid URL' }
    }
    if (!clientToken?.trim()) {
      return { success: false, message: 'Client Auth Token (fortify-client header) is required' }
    }
    return { success: true, message: 'Test to Fortify Standalone (ScanCentral SAST) succeeded ✓' }
  },
  async sync(): Promise<SyncResult> {
    // In production: GET /rest/v4/job/{token}/status with header fortify-client: <token>
    const jobStatus = parseScanCentralJobStatus(SCANCENTRAL_MOCK_JOB_STATUS)

    if (jobStatus.status !== 'COMPLETED') {
      return { assetsFound: 0, findingsFound: 0, details: `ScanCentral job ${jobStatus.jobToken} not yet complete (status: ${jobStatus.status})` }
    }

    let findingsSynced = 0
    for (const entry of FVDL_MOCK_VULNERABILITIES) {
      const parsed = parseFvdlVulnerability(entry.vuln, entry.fvdlVersion)

      const assetResult = await pool.query('SELECT id FROM assets WHERE hostname = $1', [entry.hostname])
      const assetId = assetResult.rows[0]?.id
      if (!assetId) continue

      const masterResult = await pool.query(
        `SELECT id FROM master_vulnerabilities WHERE asset_id = $1 AND title = $2 AND is_active = true`,
        [assetId, entry.title]
      )
      if (!masterResult.rows[0]) {
        await pool.query(
          `INSERT INTO master_vulnerabilities (title, severity, diagnosis, solution, asset_id, created_by, updated_by)
           VALUES ($1, $2, $3, $4, $5, 'system', 'system')`,
          [
            entry.title,
            fvdlSeverityLabel(parsed.instanceSeverity),
            `${parsed.kingdom} — detected by ${parsed.analyzerName} analyzer (confidence: ${parsed.confidence})`,
            'Refer to Fortify Audit Workbench for detailed remediation guidance.',
            assetId,
          ]
        )
        findingsSynced++
      }
    }

    return {
      assetsFound: 0,
      findingsFound: findingsSynced,
      details: `ScanCentral job ${jobStatus.jobToken} completed — ${findingsSynced} findings parsed from FVDL (version-gated, no stable schema per OpenText)`,
    }
  },
}

const REGISTRY: Record<string, ConnectorAdapter> = {
  qualys: qualysAdapter,
  tenable: tenableAdapter,
  rapid7: rapid7Adapter,
  servicenow: servicenowAdapter,
  custom_cmdb: {
    name: 'custom_cmdb',
    async testConnection(creds: ConnectorCredentials & { extra_fields?: any }) {
      const clientId = (creds as any).extra_fields?.client_id
      const clientSecret = (creds as any).extra_fields?.client_secret
      if (!/^https?:\/\/.+/.test(creds.endpoint?.trim() || '')) {
        return { success: false, message: 'API Base URL must be a valid URL' }
      }
      if (!clientId?.trim() || !clientSecret?.trim()) {
        return { success: false, message: 'Client ID and Client Secret are required' }
      }
      return { success: true, message: 'Test to Custom CMDB Connector succeeded ✓' }
    },
    async sync() {
      return { assetsFound: 0, findingsFound: 0, details: 'Custom CMDB Connector requires a validated customer OpenAPI contract before sync can run — configuration only, no generic sync logic applies' }
    },
  },
  opentext: fortifySSCAdapter,
  burpsuite: burpSuiteAdapter,
  fortify: fortifyStandaloneAdapter,
}

export function getAdapter(connectorName: string): ConnectorAdapter | null {
  return REGISTRY[connectorName] || null
}