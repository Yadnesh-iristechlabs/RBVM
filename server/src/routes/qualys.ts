import { Router } from 'express'
import { pool } from '../db/pool'
import { generateMockFindings, generateSeverityCounts } from '../mock/qualysData'

const router = Router()

const MOCK_HOSTS = [
  { hostname: 'web-app-01.corp.apexbank.in', ip: '10.20.1.11', os: 'Ubuntu Linux 22.04', type: 'Server' },
  { hostname: 'db-core-02.corp.apexbank.in', ip: '10.20.1.12', os: 'PostgreSQL on RHEL 8', type: 'Database' },
  { hostname: 'win-dc-01.corp.apexbank.in', ip: '10.20.2.5', os: 'Windows Server 2022', type: 'Server' },
  { hostname: 'fw-perimeter-01', ip: '10.20.0.1', os: 'FortiOS 7.2', type: 'Firewall' },
  { hostname: 'app-payments-03.corp.apexbank.in', ip: '10.20.1.30', os: 'Windows Server 2019', type: 'Server' },
]

router.post('/sync', async (req, res) => {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const created = []

    for (const host of MOCK_HOSTS) {
      const result = await client.query(
        `INSERT INTO assets (hostname, ip_address, os, asset_type, exposure, criticality, agent_installed, last_seen)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
         ON CONFLICT DO NOTHING
         RETURNING *`,
        [host.hostname, host.ip, host.os, host.type, 'Internal', 'Tier 2', true]
      )
      if (result.rows[0]) created.push(result.rows[0])
    }

    await client.query('COMMIT')
    res.status(201).json({ synced: created.length, assets: created })
  } catch (err) {
    await client.query('ROLLBACK')
    console.error(err)
    res.status(500).json({ error: 'sync failed' })
  } finally {
    client.release()
  }
})

router.get('/findings/:assetId', async (req, res) => {
  const assetId = Number(req.params.assetId)
  const count = 3 + Math.floor(Math.random() * 8)
  const vulnTypeParam = req.query.include_vuln_type as string | undefined
  const vulnType = vulnTypeParam === 'potential' ? 'potential' : vulnTypeParam === 'confirmed' ? 'confirmed' : undefined
  const findings = generateMockFindings(assetId, count, vulnType)
  const severityCounts = generateSeverityCounts(findings)

  if (req.query.output_format === 'xml') {
    const assetRes = await pool.query('SELECT * FROM assets WHERE id = $1', [assetId])
    const asset = assetRes.rows[0]
    if (!asset) return res.status(404).send('<error>asset not found</error>')

    const esc = (s: any) => `<![CDATA[${s ?? ''}]]>`
    const now = new Date().toISOString()
    const detections = findings.map((f) => `
        <DETECTION>
          <UNIQUE_VULN_ID>${f.unique_vuln_id}</UNIQUE_VULN_ID>
          <QID>${f.qid}</QID>
          <TYPE>${f.type}</TYPE>
          <SEVERITY>${f.severity}</SEVERITY>
          <SSL>0</SSL>
          <RESULTS>${esc(f.diagnosis)}</RESULTS>
          <STATUS>${f.status}</STATUS>
          <FIRST_FOUND_DATETIME>${f.first_found}</FIRST_FOUND_DATETIME>
          <LAST_FOUND_DATETIME>${f.last_found}</LAST_FOUND_DATETIME>
          <TIMES_FOUND>${f.times_found}</TIMES_FOUND>
          <LAST_TEST_DATETIME>${f.last_found}</LAST_TEST_DATETIME>
          <LAST_UPDATE_DATETIME>${now}</LAST_UPDATE_DATETIME>
          <IS_IGNORED>0</IS_IGNORED>
          <IS_DISABLED>0</IS_DISABLED>
          <LAST_PROCESSED_DATETIME>${now}</LAST_PROCESSED_DATETIME>
        </DETECTION>`).join('')

    const xml = `<?xml version="1.0" encoding="UTF-8" ?>
<!DOCTYPE HOST_LIST_VM_DETECTION_OUTPUT SYSTEM "https://qualysapi.qg1.apps.qualys.in/api/4.0/fo/asset/host/vm/detection/dtd/output.dtd">
<HOST_LIST_VM_DETECTION_OUTPUT>
  <RESPONSE>
    <DATETIME>${now}</DATETIME>
    <HOST_LIST>
      <HOST>
        <ID>${asset.id}</ID>
        <IP>${asset.ip_address ?? ''}</IP>
        <TRACKING_METHOD>IP</TRACKING_METHOD>
        <ASSET_GROUP_LIST />
        <NETWORK_ID>2458227</NETWORK_ID>
        <NETWORK_NAME>Apex-Bank-Internal</NETWORK_NAME>
        <OS>${esc(asset.os)}</OS>
        <DNS>${esc(asset.fqdn || asset.hostname)}</DNS>
        <DNS_DATA>
          <HOSTNAME>${esc(asset.hostname)}</HOSTNAME>
          <DOMAIN>${esc(asset.fqdn ? asset.fqdn.split('.').slice(1).join('.') : 'corp.apexbank.in')}</DOMAIN>
          <FQDN>${esc(asset.fqdn || asset.hostname)}</FQDN>
        </DNS_DATA>
        <LAST_SCAN_DATETIME>${asset.last_seen ? new Date(asset.last_seen).toISOString() : now}</LAST_SCAN_DATETIME>
        <LAST_VM_SCANNED_DATE>${asset.last_seen ? new Date(asset.last_seen).toISOString() : now}</LAST_VM_SCANNED_DATE>
        <LAST_VM_SCANNED_DURATION>149</LAST_VM_SCANNED_DURATION>
        <LAST_VM_AUTH_SCANNED_DATE>${asset.last_seen ? new Date(asset.last_seen).toISOString() : now}</LAST_VM_AUTH_SCANNED_DATE>
        <LAST_VM_AUTH_SCANNED_DURATION>149</LAST_VM_AUTH_SCANNED_DURATION>
        <DETECTION_LIST>${detections}
        </DETECTION_LIST>
      </HOST>
    </HOST_LIST>
  </RESPONSE>
</HOST_LIST_VM_DETECTION_OUTPUT>`

    res.set('Content-Type', 'application/xml')
    return res.send(xml)
  }

  res.json({ severityCounts, findings, datetime: new Date().toISOString() })
})

export default router