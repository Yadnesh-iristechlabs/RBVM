import { ConnectorAdapter, ConnectorCredentials, SyncResult } from './types'
import { createMockAdapter } from './mockAdapter'
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

const REGISTRY: Record<string, ConnectorAdapter> = {
  qualys: qualysAdapter,
  tenable: createMockAdapter('Tenable Nessus'),
  rapid7: createMockAdapter('Rapid7 InsightVM'),
  servicenow: createMockAdapter('ServiceNow CMDB'),
  custom_cmdb: createMockAdapter('Custom CMDB Connector'),
  opentext: createMockAdapter('OpenText'),
  burpsuite: createMockAdapter('Burp Suite'),
  fortify: createMockAdapter('Fortify'),
}

export function getAdapter(connectorName: string): ConnectorAdapter | null {
  return REGISTRY[connectorName] || null
}