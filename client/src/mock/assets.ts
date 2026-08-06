export interface MockAsset {
  id: number
  createdAt?: string
  cloud_provider?: string
  hostname: string
  fqdn: string
  ip_address: string
  os: string
  owner: string
  asset_type: string
  exposure: string
  criticality: string
  priority: string
  business_unit: string
  location: string
  vulnCounts: { critical: number; high: number; medium: number; low: number }
  riskScore: number
  riskTrend: 'up' | 'down'
  riskLabel: 'High' | 'Medium' | 'Low'
  lastScan: string
  agentInstalled: boolean
  compliance_frameworks: string[]
  coordinators?: string[]
}

export const mockAssets: MockAsset[] = [
  {
    id: 1,
    hostname: 'win-app-018',
    fqdn: 'win-app-018.cybernx.com',
    ip_address: '10.20.50.199',
    os: 'Windows Server 2016',
    owner: 'Neha Gupta',
    asset_type: 'Server',
    exposure: 'Internet',
    criticality: 'Tier 2',
    priority: '3',
    business_unit: 'Payments',
    location: 'Pune DR',
    vulnCounts: { critical: 3, high: 2, medium: 2, low: 0 },
    riskScore: 64,
    riskTrend: 'down',
    riskLabel: 'High',
    lastScan: '15d ago',
    agentInstalled: true,
    compliance_frameworks: ['SEBI', 'DPDPA'],
  },
  {
    id: 2,
    hostname: 'win-dc-010',
    fqdn: 'win-dc-010.cybernx.com',
    ip_address: '10.28.21.205',
    os: 'Windows Server 2012',
    owner: 'Karthik Iyer',
    asset_type: 'Server',
    exposure: 'Internet',
    criticality: 'Tier 2',
    priority: '3',
    business_unit: 'Audit & Compliance',
    location: 'Hyderabad DC',
    vulnCounts: { critical: 4, high: 4, medium: 1, low: 3 },
    riskScore: 62,
    riskTrend: 'down',
    riskLabel: 'High',
    lastScan: '1d ago',
    agentInstalled: true,
    compliance_frameworks: ['SEBI'],
  },
  {
    id: 3,
    hostname: 'fw-edge-008',
    fqdn: 'fw-edge-008.cybernx.com',
    ip_address: '10.17.200.205',
    os: 'Fortinet FortiOS 7.2',
    owner: 'Rahul Singh',
    asset_type: 'Network Device',
    exposure: 'Internet',
    criticality: 'Tier 1',
    priority: '2',
    business_unit: 'Digital Banking',
    location: 'Mumbai DC2',
    vulnCounts: { critical: 4, high: 4, medium: 0, low: 3 },
    riskScore: 62,
    riskTrend: 'down',
    riskLabel: 'Medium',
    lastScan: '8d ago',
    agentInstalled: true,
    compliance_frameworks: ['RBI'],
  },
  {
    id: 4,
    hostname: 'sw-core-006',
    fqdn: 'sw-core-006.cybernx.com',
    ip_address: '10.12.253.52',
    os: 'Palo Alto PAN-OS',
    owner: 'Amit Shah',
    asset_type: 'Network Device',
    exposure: 'Internet',
    criticality: 'Tier 3',
    priority: '4',
    business_unit: 'Treasury',
    location: 'Delhi HQ',
    vulnCounts: { critical: 3, high: 0, medium: 0, low: 3 },
    riskScore: 61,
    riskTrend: 'down',
    riskLabel: 'Medium',
    lastScan: '6d ago',
    agentInstalled: false,
    compliance_frameworks: ['DPDPA'],
  },
]