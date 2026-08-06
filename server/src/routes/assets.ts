import { Router } from 'express'
import { pool } from '../db/pool'

const router = Router()

router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM assets WHERE is_active = true ORDER BY created_at DESC')
    res.json(result.rows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'failed to fetch assets' })
  }
})

router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM assets WHERE id = $1', [req.params.id])
    if (result.rows.length === 0) return res.status(404).json({ error: 'asset not found' })
    res.json(result.rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'failed to fetch asset' })
  }
})

router.post('/', async (req, res) => {
  const { hostname, ip_address, fqdn, asset_type, exposure, criticality, asset_domain, asset_class, asset_environment, asset_status, department, business_unit, location, asset_group_master, mac_address, port, url_ssid, user_type, endpoint, application_id, qualys_asset_id, qualys_agent_id, qualys_netbios_hostname, qualys_tags, region_vpc_id, qweb_host_id, tenable_asset_id, tenable_agent_name, tenable_repository_name, tenable_manager_name, compliance_frameworks, force } = req.body
  if (!hostname) return res.status(400).json({ error: 'hostname is required' })

  try {
    if (!force) {
      const dupCheck = await pool.query(
        `SELECT id, hostname, asset_code FROM assets WHERE
         (ip_address = $1 AND $1 IS NOT NULL AND $1 != '' AND fqdn = $2 AND $2 IS NOT NULL AND $2 != '')
         OR (ip_address = $1 AND $1 IS NOT NULL AND $1 != '' AND location = $3 AND $3 IS NOT NULL AND $3 != '')
         OR (hostname = $4 AND asset_domain = $5 AND asset_environment = $6)
         OR (ip_address = $1 AND $1 IS NOT NULL AND $1 != '' AND mac_address = $7 AND $7 IS NOT NULL AND $7 != '')
         LIMIT 1`,
        [ip_address, fqdn, location, hostname, asset_domain, asset_environment, mac_address]
      )
      if (dupCheck.rows.length > 0) {
        return res.status(409).json({
          error: 'potential_duplicate',
          message: `A matching asset already exists: "${dupCheck.rows[0].hostname}" (${dupCheck.rows[0].asset_code || 'no code'})`,
          existingAssetId: dupCheck.rows[0].id,
        })
      }
    }

    const domainCode = (asset_domain || 'GEN').replace(/[^A-Za-z]/g, '').slice(0, 5).toUpperCase() || 'GEN'
    const countResult = await pool.query(`SELECT count(*) FROM assets WHERE asset_code LIKE $1`, [`AST-${domainCode}-%`])
    const nextSeq = String(Number(countResult.rows[0].count) + 1).padStart(4, '0')
    const assetCode = `AST-${domainCode}-${nextSeq}`

    const complianceStatus = (compliance_frameworks && compliance_frameworks.length > 0) ? 'Compliant' : 'Non-Compliant'

    const result = await pool.query(
      `INSERT INTO assets (asset_code, hostname, ip_address, fqdn, asset_type, exposure, criticality, asset_domain, asset_class, asset_environment, asset_status, department, business_unit, location, asset_group_master, mac_address, port, url_ssid, user_type, endpoint, application_id, qualys_asset_id, qualys_agent_id, qualys_netbios_hostname, qualys_tags, region_vpc_id, qweb_host_id, tenable_asset_id, tenable_agent_name, tenable_repository_name, tenable_manager_name, compliance_status, compliance_frameworks, created_by, updated_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, 'system', 'system') RETURNING *`,
      [assetCode, hostname, ip_address, fqdn, asset_type, exposure, criticality, asset_domain, asset_class, asset_environment, asset_status, department, business_unit, location, asset_group_master, mac_address, port, url_ssid, user_type, endpoint, application_id || null, qualys_asset_id, qualys_agent_id, qualys_netbios_hostname, qualys_tags || [], region_vpc_id, qweb_host_id, tenable_asset_id, tenable_agent_name, tenable_repository_name, tenable_manager_name, complianceStatus, compliance_frameworks || []]
    )
    res.status(201).json(result.rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'failed to create asset' })
  }
})

router.put('/:id', async (req, res) => {
  const { hostname, ip_address, fqdn, asset_type, exposure, criticality, asset_domain, asset_class, asset_environment, asset_status, department, business_unit, location, asset_group_master, mac_address, port, url_ssid, user_type, endpoint, application_id, qualys_asset_id, qualys_agent_id, qualys_netbios_hostname, qualys_tags, region_vpc_id, qweb_host_id, tenable_asset_id, tenable_agent_name, tenable_repository_name, tenable_manager_name, compliance_frameworks } = req.body

  try {
    const complianceStatus = (compliance_frameworks && compliance_frameworks.length > 0) ? 'Compliant' : 'Non-Compliant'

    const result = await pool.query(
      `UPDATE assets SET hostname = $1, ip_address = $2, fqdn = $3, asset_type = $4,
       exposure = $5, criticality = $6, asset_domain = $7, asset_class = $8,
       asset_environment = $9, asset_status = $10, department = $11, business_unit = $12,
       location = $13, asset_group_master = $14, mac_address = $15, port = $16, url_ssid = $17,
       user_type = $18, endpoint = $19, application_id = $20, qualys_asset_id = $21, qualys_agent_id = $22,
       qualys_netbios_hostname = $23, qualys_tags = $24, region_vpc_id = $25, qweb_host_id = $26,
       tenable_asset_id = $27, tenable_agent_name = $28, tenable_repository_name = $29, tenable_manager_name = $30,
       compliance_status = $31, compliance_frameworks = $32,
       updated_at = NOW(), updated_by = 'system' WHERE id = $33 RETURNING *`,
      [hostname, ip_address, fqdn, asset_type, exposure, criticality, asset_domain, asset_class, asset_environment, asset_status, department, business_unit, location, asset_group_master, mac_address, port, url_ssid, user_type, endpoint, application_id || null, qualys_asset_id, qualys_agent_id, qualys_netbios_hostname, qualys_tags || [], region_vpc_id, qweb_host_id, tenable_asset_id, tenable_agent_name, tenable_repository_name, tenable_manager_name, complianceStatus, compliance_frameworks || [], req.params.id]
    )
    if (result.rows.length === 0) return res.status(404).json({ error: 'asset not found' })
    res.json(result.rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'failed to update asset' })
  }
})

router.delete('/:id', async (req, res) => {
  try {
    const result = await pool.query(`UPDATE assets SET is_active = false, updated_at = NOW(), updated_by = 'system' WHERE id = $1 RETURNING id`, [req.params.id])
    if (result.rows.length === 0) return res.status(404).json({ error: 'asset not found' })
    res.status(204).send()
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'failed to delete asset' })
  }
})

router.post('/bulk/coordinators', async (req, res) => {
  const { ids, coordinators, mode } = req.body
  if (!Array.isArray(ids) || ids.length === 0 || !Array.isArray(coordinators) || !['append', 'replace', 'remove'].includes(mode)) {
    return res.status(400).json({ error: 'ids, coordinators array, and a valid mode (append/replace/remove) are required' })
  }
  try {
    if (mode === 'replace') {
      await pool.query(`UPDATE assets SET coordinators = $1, updated_at = NOW() WHERE id = ANY($2::int[])`, [coordinators, ids])
    } else if (mode === 'append') {
      await pool.query(
        `UPDATE assets SET coordinators = (SELECT ARRAY(SELECT DISTINCT unnest(COALESCE(coordinators, ARRAY[]::text[]) || $1::text[]))), updated_at = NOW() WHERE id = ANY($2::int[])`,
        [coordinators, ids]
      )
    } else {
      await pool.query(
        `UPDATE assets SET coordinators = (SELECT ARRAY(SELECT unnest(COALESCE(coordinators, ARRAY[]::text[])) EXCEPT SELECT unnest($1::text[]))), updated_at = NOW() WHERE id = ANY($2::int[])`,
        [coordinators, ids]
      )
    }
    res.json({ updated: ids.length, mode })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'failed to bulk update coordinators' })
  }
})

router.post('/bulk/masters', async (req, res) => {
  const { ids, fields } = req.body
  if (!Array.isArray(ids) || ids.length === 0 || !fields || typeof fields !== 'object') {
    return res.status(400).json({ error: 'ids array and fields object are required' })
  }
  const allowed = ['department', 'business_unit', 'asset_tier', 'asset_environment', 'asset_status', 'location']
  const setClauses: string[] = []
  const values: any[] = []
  let i = 1
  for (const key of allowed) {
    if (fields[key] !== undefined && fields[key] !== '') {
      const col = key === 'asset_tier' ? 'criticality' : key === 'asset_environment' ? 'asset_environment' : key
      setClauses.push(`${col} = $${i}`)
      values.push(fields[key])
      i++
    }
  }
  if (setClauses.length === 0) return res.status(400).json({ error: 'no fields provided to update' })
  values.push(ids)
  try {
    await pool.query(`UPDATE assets SET ${setClauses.join(', ')}, updated_at = NOW() WHERE id = ANY($${i}::int[])`, values)
    res.json({ updated: ids.length, fields: Object.keys(fields) })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'failed to bulk update fields' })
  }
})

router.get('/owners/list', async (req, res) => {
  try {
    const result = await pool.query(`SELECT DISTINCT owner FROM assets WHERE owner IS NOT NULL AND owner != '' ORDER BY owner ASC`)
    res.json(result.rows.map((r) => r.owner))
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'failed to fetch owners' })
  }
})

router.post('/bulk/owner', async (req, res) => {
  const { ids, owner } = req.body
  if (!Array.isArray(ids) || ids.length === 0 || !owner) {
    return res.status(400).json({ error: 'ids array and owner are required' })
  }
  try {
    await pool.query(`UPDATE assets SET owner = $1, updated_at = NOW() WHERE id = ANY($2::int[])`, [owner, ids])
    res.json({ updated: ids.length })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'failed to bulk update owner' })
  }
})

export default router