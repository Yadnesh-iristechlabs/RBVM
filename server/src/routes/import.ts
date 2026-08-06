import { Router } from 'express'
import multer from 'multer'
import { parse } from 'csv-parse/sync'
import * as XLSX from 'xlsx'
import { XMLParser } from 'fast-xml-parser'
import { pool } from '../db/pool'
import { findHostnameColumn, validateRow } from '../import/validateAsset'

const router = Router()
const upload = multer({ storage: multer.memoryStorage() })

function parseUploadedFile(filename: string, buffer: Buffer): Record<string, string>[] {
  const ext = filename.toLowerCase().split('.').pop()

  if (ext === 'xlsx' || ext === 'xls') {
    const wb = XLSX.read(buffer, { type: 'buffer' })
    const sheet = wb.Sheets[wb.SheetNames[0]]
    return XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false }) as Record<string, string>[]
  }

  if (ext === 'xml') {
    const parser = new XMLParser({ ignoreAttributes: false, cdataPropName: '__cdata' })
    const parsed = parser.parse(buffer.toString('utf-8'))

    const qualysRoot = parsed.HOST_LIST_VM_DETECTION_OUTPUT ?? parsed.HOST_LIST_OUTPUT
    if (qualysRoot) {
      let hosts = qualysRoot.RESPONSE?.HOST_LIST?.HOST ?? []
      if (!Array.isArray(hosts)) hosts = [hosts]
      const unwrap = (v: any) => (v && typeof v === 'object' && '__cdata' in v ? v.__cdata : v ?? '')
      return hosts.map((h: any) => ({
        Hostname: String(unwrap(h.DNS_DATA?.HOSTNAME) || unwrap(h.DNS) || ''),
        'IP Address': String(h.IP ?? ''),
        OS: String(unwrap(h.OS)),
        FQDN: String(unwrap(h.DNS_DATA?.FQDN) || unwrap(h.DNS) || ''),
      }))
    }

    const root = parsed.assets ?? parsed.Assets ?? parsed
    let rows = root.asset ?? root.Asset ?? []
    if (!Array.isArray(rows)) rows = [rows]
    return rows.map((r: Record<string, unknown>) => {
      const flat: Record<string, string> = {}
      for (const key of Object.keys(r)) flat[key] = String(r[key] ?? '')
      return flat
    })
  }

  const content = buffer.toString('utf-8')
  return parse(content, { columns: true, skip_empty_lines: true, comment: '#' })
}

router.post('/validate', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'no file uploaded' })

  let records: Record<string, string>[]
  try {
    records = parseUploadedFile(req.file.originalname, req.file.buffer)
  } catch (err) {
    return res.status(400).json({ error: 'failed to parse file — check format is valid CSV, XLSX, or XML' })
  }

  if (records.length === 0) {
    return res.status(400).json({ error: 'no rows found in file' })
  }

  const hostnameCol = findHostnameColumn(Object.keys(records[0]))
  if (!hostnameCol) {
    return res.status(400).json({ error: 'no hostname column found' })
  }

  const results = records.map((row, i) => validateRow(row, hostnameCol, i + 2))
  const allErrors = results.flatMap((r) => r.errors)
  const validRows = results.filter((r) => r.errors.length === 0).map((r) => r.normalized)

  res.json({
    totalRows: records.length,
    validCount: validRows.length,
    errorCount: allErrors.length,
    errors: allErrors,
    preview: validRows.slice(0, 10),
  })
})

router.post('/commit', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'no file uploaded' })

  let records: Record<string, string>[]
  try {
    records = parseUploadedFile(req.file.originalname, req.file.buffer)
  } catch (err) {
    return res.status(400).json({ error: 'failed to parse file — check format is valid CSV, XLSX, or XML' })
  }

  const hostnameCol = findHostnameColumn(Object.keys(records[0]))
  if (!hostnameCol) return res.status(400).json({ error: 'no hostname column found' })

  const results = records.map((row, i) => validateRow(row, hostnameCol, i + 2))
  const validRows = results.filter((r) => r.errors.length === 0).map((r) => r.normalized)

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    for (const row of validRows) {
      const frameworks = row.compliance_frameworks
        ? String(row.compliance_frameworks).split(/[;,]/).map((s: string) => s.trim()).filter(Boolean)
        : null
      await client.query(
        `INSERT INTO assets (hostname, ip_address, asset_type, exposure, criticality, business_unit, os, owner, cloud_provider, agent_installed, compliance_frameworks)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         ON CONFLICT (hostname) DO UPDATE SET
           ip_address = EXCLUDED.ip_address,
           asset_type = EXCLUDED.asset_type,
           exposure = EXCLUDED.exposure,
           criticality = EXCLUDED.criticality,
           business_unit = EXCLUDED.business_unit,
           os = EXCLUDED.os,
           owner = EXCLUDED.owner,
           cloud_provider = EXCLUDED.cloud_provider,
           agent_installed = EXCLUDED.agent_installed,
           compliance_frameworks = EXCLUDED.compliance_frameworks,
           updated_at = NOW()`,
        [row.hostname, row.ip_address, row.asset_type, row.exposure, row.criticality, row.business_unit, row.os, row.owner, row.cloud_provider, row.agent_installed, frameworks]
      )
    }
    await client.query('COMMIT')
    res.status(201).json({ imported: validRows.length })
  } catch (err) {
    await client.query('ROLLBACK')
    console.error(err)
    res.status(500).json({ error: 'import failed' })
  } finally {
    client.release()
  }
})

export default router