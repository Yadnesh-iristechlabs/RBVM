import { useState, useMemo, useEffect } from 'react'
import { ArrowUp, ArrowDown, ArrowUpDown, Eye } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface VulnRow {
  discovery_id: number
  master_vuln_id: number
  title: string
  severity: 'Critical' | 'High' | 'Medium' | 'Low' | 'Info'
  cvss_score: number | string | null
  ticket_status: string
  assignment_status: string
  assigned_owner: string | null
  compliance_status: 'Compliant' | 'Non-Compliant' | 'Overdue' | null
  compliance_expiry_date: string | null
  reopen_count: number
  verdict_l1_status: string
  discovered_at: string
  cve_id: string | null
  vrn: string | null
  source_type: 'G' | 'S' | 'M'
  category: string | null
  risk_score: number | string | null
  inherent_risk: 'Critical' | 'High' | 'Medium' | 'Low' | null
  residual_risk: string | null
  cisa_kev: boolean
  exploit_available: boolean
  occurrence_count: number
  asset_id: number
  hostname: string
  asset_tier: string
  exposure: string
  app_name: string | null
}

const SEVERITY_BADGE: Record<string, string> = {
  Critical: 'bg-red-100 text-red-700 border-red-200',
  High: 'bg-orange-100 text-orange-700 border-orange-200',
  Medium: 'bg-amber-100 text-amber-700 border-amber-200',
  Low: 'bg-blue-100 text-blue-700 border-blue-200',
  Info: 'bg-slate-100 text-slate-600 border-slate-200',
}

const TICKET_STATUS_BADGE: Record<string, string> = {
  None: 'bg-slate-100 text-slate-600 border-slate-200',
  Open: 'bg-red-100 text-red-700 border-red-200',
  'In Process': 'bg-blue-100 text-blue-700 border-blue-200',
  'In Exception': 'bg-purple-100 text-purple-700 border-purple-200',
  'UAT Remediated': 'bg-cyan-100 text-cyan-700 border-cyan-200',
  'Pending Verification': 'bg-amber-100 text-amber-700 border-amber-200',
  Closed: 'bg-green-100 text-green-700 border-green-200',
  Reopened: 'bg-red-100 text-red-700 border-red-200',
}

const COMPLIANCE_BADGE: Record<string, string> = {
  Compliant: 'bg-green-100 text-green-700 border-green-200',
  'Non-Compliant': 'bg-amber-100 text-amber-700 border-amber-200',
  Overdue: 'bg-red-100 text-red-700 border-red-200',
}

const SOURCE_LABEL: Record<string, string> = { G: 'Global', S: 'Scanner', M: 'Manual' }

function Badge({ text, cls }: { text: string; cls: string }) {
  return <span className={cn('inline-flex items-center px-2 py-0.5 rounded-md border text-xs font-medium whitespace-nowrap', cls)}>{text}</span>
}

function RiskScoreCell({ score, rating }: { score: number | string | null; rating: string | null }) {
  const num = score == null ? null : Number(score)
  if (num == null || Number.isNaN(num)) return <span className="text-muted-foreground text-xs">—</span>
  const color = rating === 'Critical' ? '#ef4444' : rating === 'High' ? '#f97316' : rating === 'Medium' ? '#f59e0b' : '#22c55e'
  return (
    <div className="flex items-center gap-2">
      <div className="w-14 h-1.5 bg-muted rounded-full overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${Math.min(num, 100)}%`, backgroundColor: color }} />
      </div>
      <span className="text-xs font-bold" style={{ color }}>{Math.round(num)}</span>
    </div>
  )
}

function ageDays(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  return Math.floor(diff / (1000 * 60 * 60 * 24))
}

type SortKey = 'severity' | 'risk_score' | 'discovered_at' | 'ticket_status' | 'hostname'
type SortDir = 'asc' | 'desc'
const SEVERITY_ORDER: Record<string, number> = { Critical: 4, High: 3, Medium: 2, Low: 1, Info: 0 }

function SortableTh({ label, sortKey, activeKey, dir, onSort, className }: { label: string; sortKey: SortKey; activeKey: SortKey | null; dir: SortDir; onSort: (k: SortKey) => void; className?: string }) {
  const isActive = activeKey === sortKey
  return (
    <th className={cn('h-10 px-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap', className)}>
      <button onClick={() => onSort(sortKey)} className="inline-flex items-center gap-1 hover:text-foreground transition-colors cursor-pointer">
        {label}
        {isActive ? (dir === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />) : <ArrowUpDown size={12} className="opacity-50" />}
      </button>
    </th>
  )
}

const PAGE_SIZES = [10, 25, 50, 100]

export function VulnerabilitiesTable({ refreshKey, search = '', severityFilter = 'all', statusTab = 'open', onRowClick }: { refreshKey?: number; search?: string; severityFilter?: string; statusTab?: string; onRowClick?: (row: VulnRow) => void }) {
  const [rows, setRows] = useState<VulnRow[]>([])
  const [loading, setLoading] = useState(true)
  const [sortKey, setSortKey] = useState<SortKey | null>('discovered_at')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)

  const fetchRows = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/vulnerabilities')
      const data = await res.json()
      setRows(data)
    } catch (err) {
      console.error('failed to fetch vulnerabilities', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchRows() }, [refreshKey])

  const OPEN_STATUSES = ['None', 'Open', 'Open Accepted', 'Open Rejected', 'In Process', 'In Process Accepted', 'In Process Rejected', 'In Exception', 'Remediation In Progress', 'Remediated', 'UAT Remediated', 'Production Remediated', 'Pending Verification', 'Review', 'Review Accepted', 'Review Rejected', 'Reopened']

  const filtered = useMemo(() => {
    let out = rows
    const CLOSED_STATUSES = ['Closed', 'Duplicate', 'False Positive', 'Compensating Control Applied']
    if (statusTab === 'open') out = out.filter((r) => OPEN_STATUSES.includes(r.ticket_status))
    else if (statusTab === 'closed') out = out.filter((r) => CLOSED_STATUSES.includes(r.ticket_status))
    else if (statusTab === 'exception') out = out.filter((r) => r.ticket_status === 'In Exception')

    if (severityFilter !== 'all') out = out.filter((r) => r.severity === severityFilter)
    if (search.trim()) {
      const q = search.toLowerCase()
      out = out.filter((r) => r.title.toLowerCase().includes(q) || r.cve_id?.toLowerCase().includes(q) || r.vrn?.toLowerCase().includes(q) || r.hostname.toLowerCase().includes(q))
    }
    return out
  }, [rows, statusTab, severityFilter, search])

  const sorted = useMemo(() => {
    if (!sortKey) return filtered
    const out = [...filtered]
    out.sort((a, b) => {
      let cmp = 0
      if (sortKey === 'severity') cmp = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]
      else if (sortKey === 'risk_score') cmp = Number(a.risk_score ?? 0) - Number(b.risk_score ?? 0)
      else if (sortKey === 'discovered_at') cmp = new Date(a.discovered_at).getTime() - new Date(b.discovered_at).getTime()
      else if (sortKey === 'ticket_status') cmp = a.ticket_status.localeCompare(b.ticket_status)
      else if (sortKey === 'hostname') cmp = a.hostname.localeCompare(b.hostname)
      return sortDir === 'asc' ? cmp : -cmp
    })
    return out
  }, [filtered, sortKey, sortDir])

  const paged = useMemo(() => sorted.slice((page - 1) * pageSize, page * pageSize), [sorted, page, pageSize])
  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize))

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortKey(key); setSortDir('desc') }
  }

  if (loading) return <div className="py-16 text-center text-sm text-muted-foreground">Loading vulnerabilities...</div>

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full table-auto">
          <thead className="bg-muted/50 border-b border-border">
            <tr>
              <SortableTh label="Vulnerability" sortKey="severity" activeKey={sortKey} dir={sortDir} onSort={handleSort} className="w-[28%]" />
              <th className="h-10 px-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide w-[10%]">CVE / VRN</th>
              <SortableTh label="Asset" sortKey="hostname" activeKey={sortKey} dir={sortDir} onSort={handleSort} className="w-[12%]" />
              <th className="h-10 px-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide w-[8%]">Source</th>
              <SortableTh label="Risk Score" sortKey="risk_score" activeKey={sortKey} dir={sortDir} onSort={handleSort} className="w-[10%]" />
              <th className="h-10 px-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide w-[10%]">Compliance</th>
              <SortableTh label="Status" sortKey="ticket_status" activeKey={sortKey} dir={sortDir} onSort={handleSort} className="w-[10%]" />
              <th className="h-10 px-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide w-[10%]">Owner</th>
              <SortableTh label="Age" sortKey="discovered_at" activeKey={sortKey} dir={sortDir} onSort={handleSort} className="w-[6%]" />
              <th className="h-10 px-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide w-[6%]">Actions</th>
            </tr>
          </thead>
          <tbody>
            {paged.length === 0 ? (
              <tr><td colSpan={10} className="py-10 text-center text-sm text-muted-foreground">No vulnerabilities found</td></tr>
            ) : (
              paged.map((row) => (
                <tr key={row.discovery_id} className="border-b border-border last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <Badge text={row.severity} cls={SEVERITY_BADGE[row.severity]} />
                      <span className="text-sm font-medium truncate">{row.title}</span>
                      {row.cisa_kev && <Badge text="KEV" cls="bg-red-600 text-white border-red-600" />}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground truncate max-w-[140px]">{row.cve_id || row.vrn || '—'}</td>
                  <td className="px-4 py-3 text-sm truncate max-w-[160px]">{row.hostname}<div className="text-xs text-muted-foreground">{row.asset_tier}</div></td>
                  <td className="px-4 py-3"><Badge text={SOURCE_LABEL[row.source_type]} cls="bg-slate-100 text-slate-600 border-slate-200" /></td>
                  <td className="px-4 py-3"><RiskScoreCell score={row.risk_score} rating={row.inherent_risk} /></td>
                  <td className="px-4 py-3">{row.compliance_status ? <Badge text={row.compliance_status} cls={COMPLIANCE_BADGE[row.compliance_status]} /> : <span className="text-xs text-muted-foreground">—</span>}</td>
                  <td className="px-4 py-3"><Badge text={row.ticket_status} cls={TICKET_STATUS_BADGE[row.ticket_status] || TICKET_STATUS_BADGE.None} /></td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{row.assigned_owner || '—'}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{ageDays(row.discovered_at)}d</td>
                  <td className="px-4 py-3">
                    <button onClick={() => onRowClick?.(row)} className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer">
                      <Eye size={14} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between px-4 py-3 border-t border-border text-sm">
        <div className="flex items-center gap-2 text-muted-foreground">
          <span>Rows per page</span>
          <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1) }} className="border border-input rounded-md px-2 py-1 bg-background">
            {PAGE_SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <span className="ml-2">{sorted.length} results</span>
        </div>
        <div className="flex items-center gap-2">
          <button disabled={page === 1} onClick={() => setPage((p) => p - 1)} className="px-2 py-1 rounded-md border border-input disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed">Prev</button>
          <span className="text-muted-foreground">{page} / {totalPages}</span>
          <button disabled={page === totalPages} onClick={() => setPage((p) => p + 1)} className="px-2 py-1 rounded-md border border-input disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed">Next</button>
        </div>
      </div>
    </div>
  )
}