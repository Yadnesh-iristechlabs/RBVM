import { useState, useEffect } from 'react'
import { X, Pencil, Server, ShieldAlert, ExternalLink } from 'lucide-react'
import type { MockAsset } from '@/mock/assets'

interface Finding {
  qid: number
  title: string
  cve_id: string
  severity: number
  cvss_score: string
  pci_flag: boolean
  status: string
  first_found: string
  last_found: string
  is_kev: boolean
  has_exploit: boolean
  diagnosis: string
  solution: string
}

const SEV_LABEL: Record<number, { label: string; cls: string }> = {
  4: { label: 'Critical', cls: 'bg-red-500 text-white' },
  3: { label: 'High', cls: 'bg-orange-500 text-white' },
  2: { label: 'Medium', cls: 'bg-amber-400 text-black' },
  1: { label: 'Low', cls: 'bg-blue-400 text-white' },
}

const TABS = ['Summary', 'Vulnerabilities', 'History', 'Agent', 'Controls', 'Exceptions', 'System Info', 'Components']

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">{title}</h4>
      {children}
    </div>
  )
}

function Grid2({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-xl border border-border bg-muted/20 p-4">{children}</div>
}

function KV({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</div>
      <div className="text-sm font-medium text-foreground">{value}</div>
    </div>
  )
}

const CONTROLS_LIST = [
  { key: 'waf', label: 'Web Application Firewall', points: -8 },
  { key: 'isolation', label: 'Network Isolation / Segmentation', points: -10 },
  { key: 'mfa', label: 'MFA Enforced', points: -5 },
  { key: 'edr', label: 'EDR / XDR on host', points: -7 },
  { key: 'ips', label: 'IPS Signature Coverage', points: -6 },
  { key: 'patch', label: 'Virtual Patch', points: -9 },
  { key: 'backup', label: 'Tested Backup / DR', points: -4 },
]

function ControlsTab({ riskScore }: { riskScore: number }) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [applied, setApplied] = useState(false)

  const toggle = (key: string) => setSelected((prev) => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); setApplied(false); return n })

  const deduction = CONTROLS_LIST.filter((c) => selected.has(c.key)).reduce((s, c) => s + c.points, 0)
  const adjustedScore = Math.max(0, riskScore + (applied ? deduction : 0))

  return (
    <>
      <Section title="Compensating Controls">
        <div className="space-y-2">
          {CONTROLS_LIST.map((c) => (
            <label key={c.key} className="flex items-center justify-between rounded-lg border border-border p-3 cursor-pointer hover:bg-muted/30">
              <div className="flex items-center gap-3">
                <input type="checkbox" checked={selected.has(c.key)} onChange={() => toggle(c.key)} className="w-4 h-4 accent-blue-600" />
                <span className="text-sm font-medium text-foreground">{c.label}</span>
              </div>
              <span className="text-xs font-bold text-green-600">{c.points} pts</span>
            </label>
          ))}
        </div>
      </Section>

      <div className="rounded-xl border border-border bg-muted/20 p-4 flex items-center justify-between">
        <div>
          <div className="text-xs text-muted-foreground uppercase tracking-wide">Priority Score</div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-foreground">{applied ? adjustedScore : riskScore}</span>
            {applied && deduction !== 0 && <span className="text-xs font-semibold text-green-600">({deduction} pts applied)</span>}
          </div>
        </div>
        <button
          onClick={() => setApplied(true)}
          disabled={selected.size === 0}
          className="h-9 px-4 text-sm font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Apply Controls
        </button>
      </div>
    </>
  )
}

interface Exception {
  id: number
  findingTitle: string
  type: string
  status: 'Pending' | 'Approved' | 'Rejected'
  reason: string
  requestedBy: string
  expiry: string
}

function seedFromId(id: number) {
  return ((id * 9301 + 49297) % 233280) / 233280
}

function SystemInfoTab({ asset }: { asset: MockAsset }) {
  const seed = seedFromId(asset.id)
  const isWindows = asset.os.toLowerCase().includes('windows')
  const isLinux = asset.os.toLowerCase().includes('linux') || asset.os.toLowerCase().includes('ubuntu')

  const cpu = Math.floor(seed * 4) * 2 + 2
  const ram = [8, 16, 32, 64][Math.floor(seed * 4)]
  const disk = [128, 256, 512, 1024][Math.floor(seed * 4)]

  const ports = [
    { port: 22, protocol: 'TCP', service: 'SSH', state: 'Open', version: 'OpenSSH 8.9' },
    { port: 80, protocol: 'TCP', service: 'HTTP', state: asset.exposure === 'Internet' ? 'Open' : 'Filtered', version: 'nginx 1.24' },
    { port: 443, protocol: 'TCP', service: 'HTTPS', state: 'Open', version: 'TLS 1.3' },
    { port: 3389, protocol: 'TCP', service: 'RDP', state: isWindows ? 'Open' : 'Closed', version: isWindows ? 'MS-RDP' : '—' },
    { port: 3306, protocol: 'TCP', service: 'MySQL', state: asset.asset_type === 'Database' ? 'Open' : 'Closed', version: asset.asset_type === 'Database' ? '8.0.34' : '—' },
  ].filter((p) => p.state !== 'Closed')

  return (
    <>
      <Section title="Hardware">
        <Grid2>
          <KV label="Architecture" value="x86_64" />
          <KV label="Manufacturer" value={asset.cloud_provider || 'Dell / HPE'} />
          <KV label="Hypervisor" value={asset.cloud_provider ? 'KVM (cloud)' : 'VMware ESXi'} />
          <KV label="CPU" value={`${cpu} vCPU`} />
          <KV label="RAM" value={`${ram} GB`} />
          <KV label="Disk" value={`${disk} GB SSD`} />
          <KV label="BIOS Version" value="2.1.4" />
          <KV label="Last Boot" value={new Date(Date.now() - seed * 30 * 86400000).toLocaleDateString()} />
        </Grid2>
      </Section>

      <Section title="Network">
        <Grid2>
          <KV label="IPv4" value={asset.ip_address} />
          <KV label="FQDN" value={asset.fqdn || '—'} />
          <KV label="Exposure Zone" value={asset.exposure} />
          <KV label="Location / DC" value={asset.location || '—'} />
          <KV label="Timezone" value="Asia/Kolkata" />
          <KV label="Domain" value={isWindows ? 'corp.apexbank.in' : 'N/A'} />
        </Grid2>
      </Section>

      <Section title="Open Ports">
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/30 border-b border-border/40">
                {['Port', 'Protocol', 'Service', 'State', 'Version'].map((h) => (
                  <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/20">
              {ports.map((p) => (
                <tr key={p.port}>
                  <td className="px-3 py-2 font-mono text-sm">{p.port}</td>
                  <td className="px-3 py-2 text-sm text-muted-foreground">{p.protocol}</td>
                  <td className="px-3 py-2 text-sm font-medium text-foreground">{p.service}</td>
                  <td className="px-3 py-2"><span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-green-100 text-green-700">{p.state}</span></td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{p.version}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
    </>
  )
}

function ExceptionsTab({ findings, assetId }: { findings: Finding[]; assetId: number }) {
  const [exceptions, setExceptions] = useState<Exception[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [selectedFinding, setSelectedFinding] = useState('')
  const [type, setType] = useState('Risk Acceptance')
  const [reason, setReason] = useState('')

  const fetchExceptions = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/exceptions/asset/${assetId}`)
      const data = await res.json()
      const mapped: Exception[] = data.map((row: any) => ({
        id: row.id,
        findingTitle: row.finding_title,
        type: row.type,
        status: row.status,
        reason: row.reason,
        requestedBy: row.requested_by,
        expiry: row.expiry ? new Date(row.expiry).toLocaleDateString() : '—',
      }))
      setExceptions(mapped)
    } catch (err) {
      console.error('failed to fetch exceptions', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchExceptions()
  }, [assetId])

  const submit = async () => {
    if (!selectedFinding.trim() || !reason.trim()) return
    const exp = new Date()
    exp.setDate(exp.getDate() + 90)
    try {
      await fetch('/api/exceptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          asset_id: assetId,
          finding_title: selectedFinding,
          type,
          reason,
          requested_by: 'you@cybernx.com',
          expiry: exp.toISOString().split('T')[0],
        }),
      })
      setSelectedFinding('')
      setReason('')
      setShowForm(false)
      fetchExceptions()
    } catch (err) {
      console.error('failed to submit exception', err)
    }
  }

  const statusCls: Record<string, string> = {
    Pending: 'bg-amber-100 text-amber-700',
    Approved: 'bg-green-100 text-green-700',
    Rejected: 'bg-red-100 text-red-700',
  }

  return (
    <>
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Active Exceptions</h4>
        <button onClick={() => setShowForm((s) => !s)} className="h-8 px-3 text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700">
          + Request Exception
        </button>
      </div>

      {showForm && (
        <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-3">
          <div>
            <label className="text-xs font-semibold text-muted-foreground block mb-1">Finding</label>
            <select value={selectedFinding} onChange={(e) => setSelectedFinding(e.target.value)} className="w-full h-9 px-2 text-sm rounded-md border border-input bg-background">
              <option value="">Select a finding…</option>
              {findings.map((f) => <option key={f.qid} value={f.title}>{f.title} ({f.cve_id})</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">Type</label>
              <select value={type} onChange={(e) => setType(e.target.value)} className="w-full h-9 px-2 text-sm rounded-md border border-input bg-background">
                {['Risk Acceptance', 'False Positive', 'Compensating Control', 'Not Applicable'].map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">Expiry</label>
              <input disabled value="90 days from approval" className="w-full h-9 px-2 text-sm rounded-md border border-input bg-muted text-muted-foreground" />
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground block mb-1">Reason</label>
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} className="w-full px-3 py-2 text-sm rounded-md border border-input bg-background" placeholder="Justification for this exception…" />
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowForm(false)} className="h-8 px-3 text-xs font-semibold rounded-lg border border-border hover:bg-muted">Cancel</button>
            <button onClick={submit} className="h-8 px-3 text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700">Submit Request</button>
          </div>
        </div>
      )}

      {loading && <div className="text-sm text-muted-foreground text-center py-8">Loading…</div>}
      {!loading && exceptions.length === 0 ? (
        <div className="text-sm text-muted-foreground/70 text-center py-8">No exceptions requested for this asset.</div>
      ) : !loading && (
        <div className="space-y-2">
          {exceptions.map((ex) => (
            <div key={ex.id} className="rounded-lg border border-border p-3 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-foreground">{ex.findingTitle}</span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${statusCls[ex.status]}`}>{ex.status}</span>
              </div>
              <div className="text-xs text-muted-foreground">{ex.type} · Requested by {ex.requestedBy} · Expires {ex.expiry}</div>
              <div className="text-xs text-foreground/80">{ex.reason}</div>
            </div>
          ))}
        </div>
      )}
    </>
  )
}

const PRIORITY_TONE: Record<string, string> = {
  '1': 'bg-red-500/10 text-red-600 border-red-500/20',
  '2': 'bg-orange-500/10 text-orange-600 border-orange-500/20',
  '3': 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  '4': 'bg-blue-500/10 text-blue-600 border-blue-500/20',
}

export function AssetDetailDrawer({ asset, onClose, onEdit }: { asset: MockAsset; onClose: () => void; onEdit?: (asset: MockAsset) => void }) {
  const [tab, setTab] = useState('Summary')
  const [findings, setFindings] = useState<Finding[]>([])
  const [severityCounts, setSeverityCounts] = useState({ critical: 0, high: 0, medium: 0, low: 0 })
  const [loadingFindings, setLoadingFindings] = useState(true)
  const [expanded, setExpanded] = useState<Set<number>>(new Set())

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  useEffect(() => {
    setLoadingFindings(true)
    fetch(`/api/qualys/findings/${asset.id}`)
      .then((res) => res.json())
      .then((data) => {
        setFindings(data.findings ?? [])
        setSeverityCounts(data.severityCounts ?? { critical: 0, high: 0, medium: 0, low: 0 })
      })
      .catch((err) => console.error('failed to load findings', err))
      .finally(() => setLoadingFindings(false))
  }, [asset.id])

  const toggleExpand = (qid: number) => setExpanded((prev) => { const n = new Set(prev); n.has(qid) ? n.delete(qid) : n.add(qid); return n })

  const total = severityCounts.critical + severityCounts.high + severityCounts.medium + severityCounts.low
  const computedRisk = Math.min(100, severityCounts.critical * 20 + severityCounts.high * 10 + severityCounts.medium * 4 + severityCounts.low * 1)
  const riskLabel = computedRisk >= 75 ? 'Critical' : computedRisk >= 50 ? 'High' : computedRisk >= 25 ? 'Medium' : 'Low'

  const band =
    computedRisk >= 75 ? { label: 'Critical', cls: 'bg-red-50 border-b border-red-100 text-red-700' } :
    computedRisk >= 50 ? { label: 'High', cls: 'bg-orange-50 border-b border-orange-100 text-orange-700' } :
    computedRisk >= 25 ? { label: 'Medium', cls: 'bg-amber-50 border-b border-amber-100 text-amber-700' } :
    { label: 'Low', cls: 'bg-blue-50 border-b border-blue-100 text-blue-700' }

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="w-[805px] max-w-full bg-card shadow-2xl flex flex-col h-full overflow-hidden">
        <div className="flex items-start justify-between px-5 py-4 border-b border-border bg-muted/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
              <Server className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h3 className="font-black text-foreground text-base">{asset.hostname}</h3>
              <div className="text-xs text-muted-foreground mt-0.5">{asset.ip_address} · {asset.os} · {asset.asset_type}</div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {onEdit && (
              <button onClick={() => onEdit(asset)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-blue-600 transition-colors">
                <Pencil className="h-4 w-4" />
              </button>
            )}
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition-colors">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className={`px-5 py-2.5 flex items-center justify-between text-xs font-semibold ${band.cls}`}>
          <span>Risk Score: {computedRisk}/100 ({band.label})</span>
        </div>

        <div className="flex flex-wrap border-b border-border bg-card px-5 gap-1">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`py-2.5 px-3 text-xs font-semibold border-b-2 transition-colors ${tab === t ? 'border-blue-500 text-blue-600' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {tab === 'Summary' && (
            <>
              <Section title="Identification">
                <Grid2>
                  <KV label="Hostname" value={asset.hostname} />
                  <KV label="IPv4 Address" value={asset.ip_address} />
                  <KV label="FQDN" value={asset.fqdn} />
                  <KV label="Asset Type" value={asset.asset_type} />
                  <KV label="OS" value={asset.os} />
                </Grid2>
              </Section>

              <Section title="Classification & Ownership">
                <Grid2>
                  <KV label="Criticality Tier" value={asset.criticality} />
                  <KV label="Asset Priority" value={<span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${PRIORITY_TONE[asset.priority]}`}>P{asset.priority}</span>} />
                  <KV label="Exposure" value={asset.exposure} />
                  <KV label="Business Unit" value={asset.business_unit} />
                  <KV label="Data Center" value={asset.location} />
                  <KV label="Owner" value={asset.owner} />
                  <KV label="Coordinators" value={asset.coordinators && asset.coordinators.length > 0 ? asset.coordinators.join(', ') : '—'} />
                  <KV label="Compliance Status" value={
                    (asset as any).compliance_status ? (
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${(asset as any).compliance_status === 'Compliant' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                        {(asset as any).compliance_status}
                      </span>
                    ) : '—'
                  } />
                </Grid2>
              </Section>

              <div>
                <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Risk Assessment</h4>
                <div className="flex items-center gap-4 rounded-xl border border-border bg-muted/20 p-4">
                  <div className="text-center">
                    <div className={`text-4xl font-black ${computedRisk >= 75 ? 'text-red-600' : computedRisk >= 50 ? 'text-orange-600' : computedRisk >= 25 ? 'text-amber-600' : 'text-green-600'}`}>{computedRisk}</div>
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Risk score</div>
                  </div>
                  <div className="flex-1 grid grid-cols-2 gap-x-4 gap-y-1">
                    <KV label="Risk label" value={riskLabel} />
                    <KV label="Trend" value={loadingFindings ? '—' : total > 0 ? 'Active findings' : 'Stable'} />
                  </div>
                </div>
              </div>

              <Section title="Vulnerability Summary">
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { l: 'Critical', v: severityCounts.critical, active: severityCounts.critical > 0 },
                    { l: 'High', v: severityCounts.high, active: severityCounts.high > 0 },
                    { l: 'Medium', v: severityCounts.medium, active: severityCounts.medium > 0 },
                    { l: 'Low', v: severityCounts.low, active: severityCounts.low > 0 },
                  ].map((s) => (
                    <div key={s.l} className="text-center rounded-lg bg-muted/50 p-3">
                      <div className={`text-xl font-black ${s.active ? 'text-foreground' : 'text-muted-foreground/40'}`}>{s.v}</div>
                      <div className={`text-[10px] font-semibold mt-1 ${s.active ? 'text-muted-foreground' : 'text-muted-foreground/40'}`}>{s.l}</div>
                    </div>
                  ))}
                </div>
                <div className="text-xs text-muted-foreground mt-2">{total} total open findings</div>
              </Section>

              <Section title="Agent & Scan Status">
                <Grid2>
                  <KV label="Agent Status" value={asset.agentInstalled ? 'Installed' : 'Not Installed'} />
                  <KV label="Last Scanned" value={asset.lastScan} />
                </Grid2>
              </Section>

              <div className="space-y-3">
                <div className="text-xs font-semibold text-foreground mb-2">Applicable Frameworks</div>
                {asset.compliance_frameworks.map((fw) => (
                  <div key={fw} className="flex items-center justify-between rounded-lg border border-border p-3">
                    <span className="text-xs font-semibold text-foreground">{fw}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-semibold">In Scope</span>
                  </div>
                ))}
                {asset.compliance_frameworks.length === 0 && (
                  <div className="text-sm text-muted-foreground/70 text-center py-8">No compliance frameworks assigned.</div>
                )}
              </div>

              <div className="space-y-3">
                <div className="text-xs font-semibold text-foreground mb-2">Asset Tags</div>
                <div className="flex flex-wrap gap-2">
                  {asset.exposure === 'Internet' && (
                    <span className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border border-border bg-muted/50 text-foreground/80">Internet-Facing</span>
                  )}
                  {asset.agentInstalled && (
                    <span className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border border-border bg-muted/50 text-foreground/80">Agent-Monitored</span>
                  )}
                  <span className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border border-border bg-muted/50 text-foreground/80">{asset.asset_type}</span>
                  <span className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border border-border bg-muted/50 text-foreground/80">{asset.criticality}</span>
                  {asset.compliance_frameworks.map((fw) => (
                    <span key={fw} className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border border-border bg-muted/50 text-foreground/80">{fw}</span>
                  ))}
                </div>
              </div>
            </>
          )}

          {tab === 'Agent' && (
            <>
              <Section title="Agent Status">
                <Grid2>
                  <KV label="Agent ID" value={`agent-${asset.id}-${asset.ip_address.replace(/\./g, '')}`} />
                  <KV label="Agent Version" value={asset.agentInstalled ? '5.6.1.1837' : 'Not Installed'} />
                  <KV label="Last Check-In" value={asset.agentInstalled ? asset.lastScan : 'Never'} />
                  <KV label="Connected From" value={asset.ip_address} />
                </Grid2>
                {asset.agentInstalled && (
                  <div className="mt-3 flex items-center gap-2">
                    <span className="text-[10px] text-muted-foreground/70 font-semibold">Modules:</span>
                    {['VM', 'PC', 'SCA', 'FIM'].map((m) => (
                      <span key={m} className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">{m}</span>
                    ))}
                    <span className="ml-2 text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700">● Active</span>
                  </div>
                )}
              </Section>
              <Section title="Agent Configuration">
                <Grid2>
                  <KV label="Polling Interval" value="4 hours" />
                  <KV label="Log Level" value="Info" />
                  <KV label="Proxy" value="None" />
                  <KV label="Auto-Update" value="Enabled" />
                </Grid2>
              </Section>
            </>
          )}

          {tab === 'Vulnerabilities' && (
            <>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { l: 'Active Attacks', v: findings.filter((f) => f.has_exploit).length },
                  { l: 'CISA KEV', v: findings.filter((f) => f.is_kev).length },
                  { l: 'Public Exploit', v: findings.filter((f) => f.has_exploit).length },
                  { l: 'PCI Relevant', v: findings.filter((f) => f.pci_flag).length },
                ].map((s) => (
                  <div key={s.l} className="text-center rounded-lg bg-muted/50 p-3">
                    <div className="text-xl font-black text-foreground">{s.v}</div>
                    <div className="text-[10px] font-semibold mt-1 text-muted-foreground">{s.l}</div>
                  </div>
                ))}
              </div>

              {loadingFindings && <div className="text-sm text-muted-foreground text-center py-8">Loading findings…</div>}

              {!loadingFindings && findings.length === 0 && (
                <div className="text-sm text-muted-foreground text-center py-8">No open findings for this asset.</div>
              )}

              <div className="space-y-2">
                {findings.map((f) => {
                  const sev = SEV_LABEL[f.severity] ?? SEV_LABEL[1]
                  const isOpen = expanded.has(f.qid)
                  return (
                    <div key={f.qid} className="rounded-lg border border-border overflow-hidden">
                      <button onClick={() => toggleExpand(f.qid)} className="w-full flex items-center gap-3 p-3 text-left hover:bg-muted/30">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded shrink-0 ${sev.cls}`}>{sev.label}</span>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold text-foreground truncate">{f.title}</div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[10px] font-mono text-muted-foreground">QID-{f.qid}</span>
                            <span className="text-[10px] font-mono text-muted-foreground">{f.cve_id}</span>
                            {f.is_kev && <span className="text-[9px] font-bold px-1 py-0.5 rounded bg-red-100 text-red-700">KEV</span>}
                            {f.has_exploit && <ShieldAlert className="h-3 w-3 text-red-500" />}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-sm font-bold text-red-600">{f.cvss_score}</div>
                          <div className="text-[9px] text-muted-foreground">{f.status}</div>
                        </div>
                      </button>
                      {isOpen && (
                        <div className="border-t border-border bg-muted/20 p-3 space-y-2 text-xs">
                          <div><span className="font-semibold text-foreground">Diagnosis: </span><span className="text-muted-foreground">{f.diagnosis}</span></div>
                          <div><span className="font-semibold text-foreground">Solution: </span><span className="text-muted-foreground">{f.solution}</span></div>
                          <div className="flex items-center gap-4 text-muted-foreground pt-1">
                            <span>First found: {new Date(f.first_found).toLocaleDateString()}</span>
                            <span>Last found: {new Date(f.last_found).toLocaleDateString()}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </>
          )}

          {tab === 'History' && (
            <>
              <Section title="Scan Summary">
                <Grid2>
                  <KV label="Last Scanned" value={asset.lastScan} />
                  <KV label="Open Findings" value={total} />
                  <KV label="Agent Status" value={asset.agentInstalled ? 'Active' : 'Not Installed'} />
                  <KV label="Scan Source" value="Qualys VMDR" />
                </Grid2>
              </Section>

              <Section title="Scan &amp; Sync History">
                <div className="space-y-2">
                  {[
                    { event: 'Qualys mock sync completed', detail: `${findings.length} findings ingested`, when: asset.lastScan, icon: 'sync' },
                    { event: 'Agent check-in', detail: asset.agentInstalled ? 'Heartbeat received' : 'No agent registered', when: asset.lastScan, icon: 'agent' },
                    { event: 'Asset record created', detail: 'Added to inventory', when: asset.createdAt ? new Date(asset.createdAt).toLocaleString() : '—', icon: 'created' },
                  ].map((e, i) => (
                    <div key={i} className="flex items-start gap-3 rounded-lg border border-border p-3">
                      <div className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 shrink-0" />
                      <div className="flex-1">
                        <div className="text-sm font-medium text-foreground">{e.event}</div>
                        <div className="text-xs text-muted-foreground">{e.detail}</div>
                      </div>
                      <div className="text-xs text-muted-foreground shrink-0">{e.when}</div>
                    </div>
                  ))}
                </div>
              </Section>

              <Section title="Alert Notifications">
                {findings.filter((f) => f.is_kev || f.severity === 4).length > 0 ? (
                  <div className="space-y-2">
                    {findings.filter((f) => f.is_kev || f.severity === 4).slice(0, 3).map((f) => (
                      <div key={f.qid} className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-3">
                        <ShieldAlert className="h-4 w-4 text-red-600 mt-0.5 shrink-0" />
                        <div>
                          <div className="text-sm font-medium text-red-700">{f.is_kev ? 'CISA KEV alert' : 'Critical finding detected'}: {f.title}</div>
                          <div className="text-xs text-red-600/80">{f.cve_id} · detected {new Date(f.first_found).toLocaleDateString()}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground/70 text-center py-6">No active alerts for this asset.</div>
                )}
              </Section>
            </>
          )}

          {tab === 'Controls' && (
            <ControlsTab riskScore={computedRisk} />
          )}

          {tab === 'Exceptions' && (
            <ExceptionsTab findings={findings} assetId={asset.id} />
          )}

          {tab === 'System Info' && (
            <SystemInfoTab asset={asset} />
          )}

          {tab === 'Components' && (
            <ComponentsTab assetId={asset.id} />
          )}
        </div>
      </div>
    </div>
  )
}

function ComponentsTab({ assetId }: { assetId: number }) {
  const [components, setComponents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ component_name: '', attribute_name: '', version: '', component_owner: '' })

  const fetchComponents = () => {
    setLoading(true)
    fetch(`/api/components/asset/${assetId}`)
      .then((res) => res.json())
      .then(setComponents)
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchComponents() }, [assetId])

  const addComponent = async () => {
    if (!form.component_name.trim()) return
    await fetch('/api/components', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ asset_id: assetId, ...form }),
    })
    setForm({ component_name: '', attribute_name: '', version: '', component_owner: '' })
    fetchComponents()
  }

  const removeComponent = async (id: number) => {
    await fetch(`/api/components/${id}`, { method: 'DELETE' })
    fetchComponents()
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2">
        <input placeholder="Component Name" value={form.component_name} onChange={(e) => setForm({ ...form, component_name: e.target.value })} className="h-9 px-3 text-sm rounded-md border border-border/60 bg-background" />
        <input placeholder="Attribute" value={form.attribute_name} onChange={(e) => setForm({ ...form, attribute_name: e.target.value })} className="h-9 px-3 text-sm rounded-md border border-border/60 bg-background" />
        <input placeholder="Version" value={form.version} onChange={(e) => setForm({ ...form, version: e.target.value })} className="h-9 px-3 text-sm rounded-md border border-border/60 bg-background" />
        <input placeholder="Component Owner" value={form.component_owner} onChange={(e) => setForm({ ...form, component_owner: e.target.value })} className="h-9 px-3 text-sm rounded-md border border-border/60 bg-background" />
      </div>
      <button onClick={addComponent} className="h-8 px-3 text-xs font-semibold rounded-md bg-blue-600 text-white hover:bg-blue-700 cursor-pointer">Add Component</button>

      {loading && <div className="text-sm text-muted-foreground text-center py-6">Loading…</div>}
      {!loading && components.length === 0 && <div className="text-sm text-muted-foreground text-center py-6">No components recorded for this asset.</div>}
      {!loading && components.length > 0 && (
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/30 border-b border-border/40">
                {['Component', 'Attribute', 'Version', 'Owner', ''].map((h) => (
                  <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/20">
              {components.map((c) => (
                <tr key={c.id}>
                  <td className="px-3 py-2 font-medium text-foreground">{c.component_name}</td>
                  <td className="px-3 py-2 text-muted-foreground">{c.attribute_name || '—'}</td>
                  <td className="px-3 py-2 text-muted-foreground">{c.version || '—'}</td>
                  <td className="px-3 py-2 text-muted-foreground">{c.component_owner || '—'}</td>
                  <td className="px-3 py-2 text-right">
                    <button onClick={() => removeComponent(c.id)} className="text-red-500 hover:text-red-600 cursor-pointer text-xs">Remove</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}