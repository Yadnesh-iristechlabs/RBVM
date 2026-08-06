const CVE_SAMPLES = [
  { cve: 'CVE-2016-2183', title: 'Birthday attacks against TLS ciphers with 64bit block size (Sweet32)', severity: 3 },
  { cve: 'CVE-2021-44228', title: 'Apache Log4j2 Remote Code Execution (Log4Shell)', severity: 4 },
  { cve: 'CVE-2019-0708', title: 'Remote Desktop Services Remote Code Execution (BlueKeep)', severity: 4 },
  { cve: 'CVE-2017-0144', title: 'SMBv1 Remote Code Execution (EternalBlue)', severity: 4 },
  { cve: 'CVE-2014-0160', title: 'OpenSSL Heartbeat Information Disclosure (Heartbleed)', severity: 4 },
  { cve: 'CVE-2020-1472', title: 'Netlogon Elevation of Privilege (Zerologon)', severity: 4 },
  { cve: 'CVE-2018-13379', title: 'Fortinet SSL VPN Path Traversal', severity: 3 },
  { cve: 'CVE-2022-22965', title: 'Spring Framework Remote Code Execution (Spring4Shell)', severity: 4 },
  { cve: 'CVE-2015-1635', title: 'HTTP.sys Remote Code Execution', severity: 3 },
  { cve: 'CVE-2019-11510', title: 'Pulse Secure VPN Arbitrary File Disclosure', severity: 3 },
]

function randomFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function randomDate(daysBack: number): string {
  const d = new Date()
  d.setDate(d.getDate() - Math.floor(Math.random() * daysBack))
  return d.toISOString()
}

export function generateMockFindings(assetId: number, count: number, vulnType?: 'confirmed' | 'potential') {
  const findings = []
  for (let i = 0; i < count; i++) {
    const sample = randomFrom(CVE_SAMPLES)
    const isKev = Math.random() < 0.15
    const hasExploit = Math.random() < 0.3
    const type = vulnType ? (vulnType === 'potential' ? 'Potential' : 'Confirmed') : randomFrom(['Confirmed', 'Confirmed', 'Confirmed', 'Potential'])
    const timesFound = 1 + Math.floor(Math.random() * 12)
    findings.push({
      unique_vuln_id: 3900000 + Math.floor(Math.random() * 200000),
      qid: 38000 + Math.floor(Math.random() * 60000),
      title: sample.title,
      cve_id: sample.cve,
      type,
      severity: sample.severity,
      cvss_score: (sample.severity * 2 + Math.random() * 2).toFixed(1),
      pci_flag: Math.random() < 0.4,
      status: randomFrom(['New', 'Active', 'Re-Opened', 'Fixed']),
      times_found: timesFound,
      first_found: randomDate(45),
      last_found: randomDate(5),
      is_kev: isKev,
      has_exploit: hasExploit,
      diagnosis: `The remote host is affected by a vulnerability related to ${sample.title.toLowerCase()}.`,
      solution: 'Apply the vendor-supplied patch or upgrade to a fixed version as documented in the relevant security advisory.',
      asset_id: assetId,
    })
  }
  return findings
}

export function generateSeverityCounts(findings: ReturnType<typeof generateMockFindings>) {
  return {
    critical: findings.filter((f) => f.severity === 4).length,
    high: findings.filter((f) => f.severity === 3).length,
    medium: findings.filter((f) => f.severity === 2).length,
    low: findings.filter((f) => f.severity === 1).length,
  }
}