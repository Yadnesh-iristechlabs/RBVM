import { useState } from 'react'
import { toast } from 'sonner'
import { RefreshCw, Plug, Database, ArrowUpFromLine, Clock, CheckCircle, ArrowDownToLine, ChevronRight, ChevronDown, GitCompareArrows, X, Plus, Minus, RotateCcw, Play } from 'lucide-react'
import { LaunchScanModal } from '@/components/LaunchScanModal'
import { LaunchAssessmentScanModal } from '@/components/LaunchAssessmentScanModal'

import { RequestAssessmentTab } from '@/components/RequestAssessmentTab'

const SCAN_TABS = ['Sync', 'Scans', 'Assessments', 'Maps', 'Schedules', 'Appliances', 'Option Profiles', 'Authentication', 'Search Lists', 'Setup']

interface SevBreakdown { Critical: number; High: number; Medium: number; Low: number }
interface DriftItem { title: string; vulnId: string; severity: keyof SevBreakdown }
interface AssetDrift { assetId: string; hostname: string; added: DriftItem[]; closed: DriftItem[]; reopened: DriftItem[] }
interface SyncJob {
  id: string
  timestamp: string
  connector: string
  scanned: number
  added: number
  closed: number
  reopened: number
  updated: number
  totalAfter: number
  addedBySev: SevBreakdown
  closedBySev: SevBreakdown
  drift: AssetDrift[]
}

const HOSTS = ['web-app-01.corp.apexbank.in', 'db-core-02.corp.apexbank.in', 'win-dc-01.corp.apexbank.in', 'fw-perimeter-01', 'app-payments-03.corp.apexbank.in']
const SAMPLE_FINDINGS = [
  { title: 'Sweet32 TLS Cipher Weakness', vulnId: 'QID-38657' },
  { title: 'Apache Log4j2 RCE (Log4Shell)', vulnId: 'QID-84598' },
  { title: 'SMBv1 Remote Code Execution', vulnId: 'QID-91345' },
  { title: 'OpenSSL Heartbeat Disclosure', vulnId: 'QID-42012' },
  { title: 'RDP BlueKeep Vulnerability', vulnId: 'QID-77812' },
]

function randSev(): keyof SevBreakdown {
  return (['Critical', 'High', 'Medium', 'Low'] as const)[Math.floor(Math.random() * 4)]
}

function randomDrift(kind: 'added' | 'closed' | 'reopened', count: number): DriftItem[] {
  const items: DriftItem[] = []
  for (let i = 0; i < count; i++) {
    const f = SAMPLE_FINDINGS[Math.floor(Math.random() * SAMPLE_FINDINGS.length)]
    items.push({ ...f, severity: randSev() })
  }
  return items
}

async function generateRealJob(connector: string): Promise<SyncJob> {
  const assetsRes = await fetch('/api/assets')
  const assets: { id: number; hostname: string }[] = await assetsRes.json()

  const drift: AssetDrift[] = []
  const addedBySev: SevBreakdown = { Critical: 0, High: 0, Medium: 0, Low: 0 }
  let totalFindings = 0

  await Promise.all(
    assets.map(async (a) => {
      try {
        const fres = await fetch(`/api/qualys/findings/${a.id}`)
        const fdata = await fres.json()
        const findings = (fdata.findings ?? []).map((f: any) => ({
          title: f.title,
          vulnId: `QID-${f.qid}`,
          severity: (['Low', 'Medium', 'High', 'Critical'][f.severity - 1] ?? 'Low') as keyof SevBreakdown,
        }))
        findings.forEach((f: DriftItem) => addedBySev[f.severity]++)
        totalFindings += findings.length
        drift.push({ assetId: String(a.id), hostname: a.hostname, added: findings, closed: [], reopened: [] })
      } catch {}
    })
  )

  return {
    id: `SYNC-${Date.now().toString(36).toUpperCase()}`,
    timestamp: new Date().toLocaleString(),
    connector,
    scanned: assets.length,
    added: totalFindings,
    closed: 0,
    reopened: 0,
    updated: assets.length,
    totalAfter: totalFindings,
    addedBySev,
    closedBySev: { Critical: 0, High: 0, Medium: 0, Low: 0 },
    drift,
  }
}

function SevBadge({ s }: { s: keyof SevBreakdown }) {
  const cls = { Critical: 'bg-red-500 text-white', High: 'bg-orange-500 text-white', Medium: 'bg-amber-400 text-black', Low: 'bg-blue-400 text-white' }[s]
  return <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${cls}`}>{s}</span>
}

function SevBreakdownRow({ label, data, tone }: { label: string; data: SevBreakdown; tone: 'green' | 'blue' }) {
  const entries = (Object.keys(data) as (keyof SevBreakdown)[]).filter((k) => data[k] > 0)
  const total = entries.reduce((s, k) => s + data[k], 0)
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className={`text-xs font-semibold w-16 ${tone === 'green' ? 'text-green-600' : 'text-blue-600'}`}>{label}</span>
      <span className="text-sm font-bold text-foreground">{total}</span>
      <div className="flex items-center gap-1 flex-wrap">
        {entries.map((k) => (
          <span key={k} className="inline-flex items-center gap-1"><SevBadge s={k} /><span className="text-xs text-muted-foreground">{data[k]}</span></span>
        ))}
        {total === 0 && <span className="text-xs text-muted-foreground">—</span>}
      </div>
    </div>
  )
}

function JobSummary({ job }: { job: SyncJob }) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-5 gap-3">
        {[
          { label: 'Assets Scanned', value: job.scanned, cls: 'bg-blue-50 text-blue-600' },
          { label: 'New Findings', value: job.added, cls: 'bg-orange-50 text-orange-600' },
          { label: 'Closed', value: job.closed, cls: 'bg-green-50 text-green-600' },
          { label: 'Reopened', value: job.reopened, cls: 'bg-amber-50 text-amber-600' },
          { label: 'Refreshed', value: job.updated, cls: 'bg-slate-100 text-slate-600' },
        ].map((k) => (
          <div key={k.label} className={`rounded-lg p-3 ${k.cls}`}>
            <div className="text-2xl font-black">{k.value}</div>
            <div className="text-[10px] font-medium mt-0.5">{k.label}</div>
          </div>
        ))}
      </div>
      <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-2">
        <SevBreakdownRow label="Added" data={job.addedBySev} tone="green" />
        <SevBreakdownRow label="Closed" data={job.closedBySev} tone="blue" />
      </div>
    </div>
  )
}

function DriftView({ job }: { job: SyncJob }) {
  const [open, setOpen] = useState<Set<string>>(new Set())
  const toggle = (id: string) => setOpen((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })

  if (job.drift.every((d) => d.added.length === 0 && d.closed.length === 0 && d.reopened.length === 0)) {
    return <p className="text-sm text-muted-foreground text-center py-8">No per-asset changes in this sync.</p>
  }

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-muted/30 border-b border-border/40">
            <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Asset</th>
            <th className="px-3 py-2 text-center text-xs font-semibold text-muted-foreground">Added</th>
            <th className="px-3 py-2 text-center text-xs font-semibold text-muted-foreground">Closed</th>
            <th className="px-3 py-2 text-center text-xs font-semibold text-muted-foreground">Reopened</th>
            <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Net</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/30">
          {job.drift.map((d) => {
            const isOpen = open.has(d.assetId)
            const net = d.added.length - d.closed.length
            return (
              <>
                <tr key={d.assetId} onClick={() => toggle(d.assetId)} className="cursor-pointer hover:bg-muted/40">
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1.5">
                      {isOpen ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
                      <span className="text-sm font-semibold text-foreground">{d.hostname}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-center"><span className={`text-sm font-bold ${d.added.length ? 'text-green-600' : 'text-muted-foreground'}`}>+{d.added.length}</span></td>
                  <td className="px-3 py-2 text-center"><span className={`text-sm font-bold ${d.closed.length ? 'text-blue-600' : 'text-muted-foreground'}`}>−{d.closed.length}</span></td>
                  <td className="px-3 py-2 text-center"><span className={`text-sm font-bold ${d.reopened.length ? 'text-amber-600' : 'text-muted-foreground'}`}>{d.reopened.length}</span></td>
                  <td className="px-3 py-2"><span className={`text-sm font-semibold ${net > 0 ? 'text-red-600' : net < 0 ? 'text-green-600' : 'text-muted-foreground'}`}>{net > 0 ? `+${net}` : net}</span></td>
                </tr>
                {isOpen && (
                  <tr>
                    <td colSpan={5} className="px-4 py-2 bg-muted/10">
                      <div className="space-y-1">
                        {[...d.added.map((c) => ['added', c] as const), ...d.reopened.map((c) => ['reopened', c] as const), ...d.closed.map((c) => ['closed', c] as const)].map(([kind, c], i) => (
                          <div key={i} className="flex items-center gap-2 text-xs">
                            {kind === 'added' ? <Plus className="h-3 w-3 text-green-600 shrink-0" /> : kind === 'closed' ? <Minus className="h-3 w-3 text-blue-600 shrink-0" /> : <RotateCcw className="h-3 w-3 text-amber-600 shrink-0" />}
                            <SevBadge s={c.severity} />
                            <span className="text-foreground/90 truncate">{c.title}</span>
                            <span className="text-muted-foreground font-mono ml-auto shrink-0">{c.vulnId}</span>
                          </div>
                        ))}
                        {d.added.length === 0 && d.closed.length === 0 && d.reopened.length === 0 && (
                          <div className="text-xs text-muted-foreground">No changes for this asset.</div>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function JobDrawer({ job, onClose }: { job: SyncJob; onClose: () => void }) {
  const [tab, setTab] = useState<'summary' | 'drift'>('summary')
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-3xl bg-card border border-border rounded-2xl shadow-2xl max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-border flex items-center gap-3 shrink-0">
          <GitCompareArrows className="h-5 w-5 text-blue-600" />
          <div>
            <h3 className="font-bold text-foreground text-sm">{job.id} · {job.connector}</h3>
            <p className="text-xs text-muted-foreground">{job.timestamp} · {job.totalAfter.toLocaleString()} findings after sync</p>
          </div>
          <button onClick={onClose} className="ml-auto text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>
        <div className="px-6 py-3 border-b border-border/50 flex items-center gap-2 shrink-0">
          {(['summary', 'drift'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-full h-8 px-4 text-sm font-semibold border transition-colors ${tab === t ? 'bg-blue-600 text-white border-blue-600' : 'border-border text-muted-foreground hover:border-blue-400'}`}
            >
              {t === 'summary' ? 'Summary' : `Per-Asset Findings (${job.drift.length})`}
            </button>
          ))}
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {tab === 'summary' ? <JobSummary job={job} /> : <DriftView job={job} />}
        </div>
      </div>
    </div>
  )
}

export function Scans() {
  const [activeTab, setActiveTab] = useState('Sync')
  const [showAssessmentScanModal, setShowAssessmentScanModal] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [jobs, setJobs] = useState<SyncJob[]>([])
  const [selectedJob, setSelectedJob] = useState<SyncJob | null>(null)
  const [lastSync, setLastSync] = useState<string | null>(null)
  const [showLaunchModal, setShowLaunchModal] = useState(false)

  const totalFindings = 1247 + jobs.reduce((s, j) => s + j.added - j.closed, 0)
  const open = Math.round(totalFindings * 0.62)
  const kev = 38 + jobs.reduce((s, j) => s + j.addedBySev.Critical, 0)
  const remediated = 412 + jobs.reduce((s, j) => s + j.closed, 0)

  const runSync = async () => {
    setSyncing(true)
    try {
      await fetch('/api/qualys/sync', { method: 'POST' })
      const job = await generateRealJob('Qualys VMDR')
      setJobs((prev) => [job, ...prev])
      setLastSync(new Date().toLocaleString())
      toast.success(`Sync complete — scanned ${job.scanned} assets, ${job.added} findings`)
    } catch (err) {
      console.error(err)
      toast.error('Sync failed')
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Scans</h1>
        <button
          onClick={() => activeTab === 'Assessments' ? setShowAssessmentScanModal(true) : setShowLaunchModal(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 shadow-sm cursor-pointer"
        >
          <Play className="h-3.5 w-3.5" /> Launch Scan
        </button>
      </div>

      <div className="flex items-center gap-1 border-b border-border overflow-x-auto">
        {SCAN_TABS.map((t) => (
          <button
            key={t}
            onClick={() => setActiveTab(t)}
            className={`pb-2.5 px-3 text-sm font-semibold border-b-2 whitespace-nowrap transition-colors cursor-pointer ${activeTab === t ? 'border-blue-500 text-blue-600' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
          >
            {t}
          </button>
        ))}
      </div>

      {activeTab === 'Assessments' && <RequestAssessmentTab />}

      {activeTab !== 'Sync' && activeTab !== 'Assessments' && (
        <div className="py-16 text-center text-sm text-muted-foreground">
          {activeTab} view is not part of this demo's scope.
        </div>
      )}

      {activeTab === 'Sync' && (
      <>
      <div>
        <h2 className="text-sm font-bold text-foreground">Scanner Sync</h2>
        <p className="text-xs text-muted-foreground mt-0.5">Pull asset vulnerabilities from connected scanners. Each sync closes remediated findings and ingests newly-discovered ones — open any job to see the per-asset drift.</p>
      </div>

      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Total Findings', value: totalFindings.toLocaleString(), cls: 'bg-blue-50 border-blue-200 text-blue-600', icon: Database },
          { label: 'Open', value: open.toLocaleString(), cls: 'bg-orange-50 border-orange-200 text-orange-600', icon: ArrowUpFromLine },
          { label: 'CISA KEV (open)', value: kev.toLocaleString(), cls: 'bg-purple-50 border-purple-200 text-purple-600', icon: Clock },
          { label: 'Remediated', value: remediated.toLocaleString(), cls: 'bg-green-50 border-green-200 text-green-600', icon: CheckCircle },
        ].map((k) => {
          const [bg, text] = [k.cls.split(' ').slice(0, 2).join(' '), k.cls.split(' ')[2]]
          const Icon = k.icon
          return (
            <div key={k.label} className={`rounded-xl border ${bg} p-4 flex items-center gap-3 shadow-sm`}>
              <Icon className={`h-5 w-5 ${text} shrink-0`} />
              <div>
                <div className={`text-2xl font-black ${text}`}>{k.value}</div>
                <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mt-0.5">{k.label}</div>
              </div>
            </div>
          )
        })}
      </div>

      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Connectors</span>
        <button onClick={runSync} disabled={syncing} className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-60">
          <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} /> Sync All
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-blue-500/10 flex items-center justify-center"><Plug className="h-4 w-4 text-blue-600" /></div>
            <div className="min-w-0">
              <div className="text-sm font-bold text-foreground truncate">Qualys VMDR</div>
              <div className="text-xs text-muted-foreground truncate">Qualys Inc.</div>
            </div>
          </div>
          <div className="text-xs text-muted-foreground">Host & infrastructure vulnerability management</div>
          <div className="flex items-center justify-between mt-1">
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-green-500/10 text-green-700 border border-green-500/20">Connected</span>
            <span className="text-xs text-muted-foreground">Last sync: {lastSync ?? 'never'}</span>
          </div>
          <button onClick={runSync} disabled={syncing} className="mt-1 inline-flex items-center justify-center gap-1.5 h-8 rounded-md border border-border/60 text-sm font-medium hover:bg-muted disabled:opacity-60">
            <RefreshCw className={`h-3.5 w-3.5 ${syncing ? 'animate-spin' : ''}`} /> {syncing ? 'Syncing…' : 'Run Sync'}
          </button>
        </div>
      </div>

      <div><span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Sync Jobs</span></div>
      <div className="bg-card border border-border shadow-sm overflow-hidden rounded-xl">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/40 bg-muted/30">
              <th className="h-10 px-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Job</th>
              <th className="h-10 px-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">When</th>
              <th className="h-10 px-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Connector</th>
              <th className="h-10 px-4 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wide">Scanned</th>
              <th className="h-10 px-4 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wide">New</th>
              <th className="h-10 px-4 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wide">Closed</th>
              <th className="h-10 px-4 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wide">Reopened</th>
              <th className="h-10 px-4 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide">Total After</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/30">
            {jobs.length === 0 && (
              <tr><td colSpan={8} className="py-10 text-center text-sm text-muted-foreground">No syncs yet — run a connector to ingest changes.</td></tr>
            )}
            {jobs.map((job) => (
              <tr key={job.id} onClick={() => setSelectedJob(job)} className="cursor-pointer hover:bg-muted/50">
                <td className="px-4 py-3 font-mono text-sm font-semibold text-foreground">
                  {job.id}
                  {job.id.startsWith('SCHEDULED') && <span className="ml-2 text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">DEMO PLACEHOLDER</span>}
                </td>
                <td className="px-4 py-3 text-sm text-foreground/90">{job.timestamp}</td>
                <td className="px-4 py-3 text-sm text-foreground/90">{job.connector}</td>
                <td className="px-4 py-3 text-center text-sm text-foreground/90">{job.scanned}</td>
                <td className="px-4 py-3 text-center"><span className="inline-flex items-center gap-1 text-sm font-semibold text-green-600"><ArrowDownToLine className="h-3 w-3" />{job.added}</span></td>
                <td className="px-4 py-3 text-center text-sm font-semibold text-blue-600">{job.closed}</td>
                <td className="px-4 py-3 text-center text-sm font-semibold text-amber-600">{job.reopened}</td>
                <td className="px-4 py-3 text-right font-mono text-sm text-foreground/90">{job.totalAfter.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedJob && <JobDrawer job={selectedJob} onClose={() => setSelectedJob(null)} />}
      </>
      )}
      {showLaunchModal && (
        <LaunchScanModal
          onClose={() => setShowLaunchModal(false)}
          onScheduled={(title) => {
            setJobs((prev) => [
              {
                id: `SCHEDULED-${Date.now().toString(36).toUpperCase()}`,
                timestamp: new Date().toLocaleString(),
                connector: `Manual Launch — ${title}`,
                scanned: 0,
                added: 0,
                closed: 0,
                reopened: 0,
                updated: 0,
                totalAfter: prev[0]?.totalAfter ?? totalFindings,
                addedBySev: { Critical: 0, High: 0, Medium: 0, Low: 0 },
                closedBySev: { Critical: 0, High: 0, Medium: 0, Low: 0 },
                drift: [],
              },
              ...prev,
            ])
          }}
        />
      )}

      {showAssessmentScanModal && (
        <LaunchAssessmentScanModal onClose={() => setShowAssessmentScanModal(false)} />
      )}
    </div>
  )
}