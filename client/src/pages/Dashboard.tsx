import { useState, useEffect } from 'react'
import { Target, Zap } from 'lucide-react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import type { MockAsset } from '@/mock/assets'



const RISK_LEVELS = [
  { g: 'E', range: '0-19', label: 'Critical', bg: 'bg-red-600' },
  { g: 'D', range: '20-39', label: 'High', bg: 'bg-orange-600' },
  { g: 'C', range: '40-59', label: 'Medium', bg: 'bg-amber-500' },
  { g: 'B', range: '60-79', label: 'Low', bg: 'bg-green-600' },
  { g: 'A', range: '80-100', label: 'Very Low', bg: 'bg-emerald-600' },
]

function gradeFor(score: number) {
  if (score >= 80) return { g: 'A', status: 'Very Low', color: '#10b981' }
  if (score >= 60) return { g: 'B', status: 'Low', color: '#16a34a' }
  if (score >= 40) return { g: 'C', status: 'Medium', color: '#f59e0b' }
  if (score >= 20) return { g: 'D', status: 'High', color: '#f97316' }
  return { g: 'E', status: 'Critical', color: '#ef4444' }
}

export function Dashboard() {
  const [timeFilter, setTimeFilter] = useState('Last 7 Days')
  const [assets, setAssets] = useState<MockAsset[]>([])
  const [loading, setLoading] = useState(true)
  const [findingsBySeverity, setFindingsBySeverity] = useState({ critical: 0, high: 0, medium: 0, low: 0 })
  const [avgRiskScore, setAvgRiskScore] = useState(0)
  const [topVulns, setTopVulns] = useState<{ title: string; cve: string; sev: string; cvss: number; kev: boolean; priority: number }[]>([])
  const [trendData, setTrendData] = useState<{ date: string; vulns: number }[]>([])

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const res = await fetch('/api/assets')
        const data = await res.json()
        const mapped: MockAsset[] = data.map((row: any) => ({
          id: row.id,
          hostname: row.hostname,
          fqdn: row.fqdn ?? '',
          ip_address: row.ip_address ?? '',
          os: row.os ?? '',
          owner: row.owner ?? '',
          asset_type: row.asset_type ?? 'Server',
          exposure: row.exposure ?? 'Internal',
          criticality: row.criticality ?? 'Tier 3',
          priority: row.priority ?? '3',
          business_unit: row.business_unit ?? '',
          location: row.location ?? '',
          vulnCounts: { critical: 0, high: 0, medium: 0, low: 0 },
          riskScore: 0,
          riskTrend: 'down' as const,
          riskLabel: 'Low' as const,
          lastScan: row.last_seen ? new Date(row.last_seen).toLocaleDateString() : 'Never',
          agentInstalled: !!row.agent_installed,
          compliance_frameworks: row.compliance_frameworks ?? [],
        }))
        setAssets(mapped)

        const sevSum = { critical: 0, high: 0, medium: 0, low: 0 }
        const scores: number[] = []
        const allFindings: any[] = []
        await Promise.all(
          mapped.map(async (a) => {
            try {
              const fres = await fetch(`/api/qualys/findings/${a.id}`)
              const fdata = await fres.json()
              const c = fdata.severityCounts?.critical ?? 0
              const h = fdata.severityCounts?.high ?? 0
              const m = fdata.severityCounts?.medium ?? 0
              const l = fdata.severityCounts?.low ?? 0
              sevSum.critical += c
              sevSum.high += h
              sevSum.medium += m
              sevSum.low += l
              scores.push(Math.min(100, c * 20 + h * 10 + m * 4 + l * 1))
              ;(fdata.findings ?? []).forEach((f: any) => allFindings.push(f))
            } catch {}
          })
        )
        setFindingsBySeverity(sevSum)
        setAvgRiskScore(scores.length ? Math.round(scores.reduce((s, v) => s + v, 0) / scores.length) : 0)

        const sevLabel: Record<number, string> = { 4: 'Critical', 3: 'High', 2: 'Medium', 1: 'Low' }
        const ranked = allFindings
          .map((f) => ({
            title: f.title,
            cve: f.cve_id,
            sev: sevLabel[f.severity] ?? 'Low',
            cvss: parseFloat(f.cvss_score),
            kev: !!f.is_kev,
            priority: Math.round(f.severity * 20 + (f.is_kev ? 10 : 0) + (f.has_exploit ? 5 : 0)),
          }))
          .sort((a, b) => b.priority - a.priority)
          .slice(0, 5)
        setTopVulns(ranked)

        if (mapped.length > 0) {
          const total = sevSum.critical + sevSum.high + sevSum.medium + sevSum.low
          await fetch('/api/snapshots', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ total, critical: sevSum.critical, high: sevSum.high, medium: sevSum.medium, low: sevSum.low }),
          }).catch(() => {})
        }

        const snapRes = await fetch('/api/snapshots')
        const snapshots = await snapRes.json()
        setTrendData(
          snapshots.map((s: any) => ({
            date: new Date(s.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
            vulns: s.total,
          }))
        )
      } catch (err) {
        console.error('dashboard fetch failed', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const totalAssets = assets.length
  const internetFacing = assets.filter((a) => a.exposure === 'Internet').length
  const agentInstalled = assets.filter((a) => a.agentInstalled).length

  const severityTotals = findingsBySeverity
  const totalVulns = severityTotals.critical + severityTotals.high + severityTotals.medium + severityTotals.low

  const avgRisk = avgRiskScore
  const overallScore = 100 - avgRisk
  const grade = gradeFor(overallScore)

  const tierCounts = assets.reduce((acc: Record<string, number>, a) => {
    acc[a.criticality] = (acc[a.criticality] ?? 0) + 1
    return acc
  }, {})

  const keyStats = [
    { label: 'Total Assets', value: String(totalAssets), bar: 'bg-blue-500', pct: 100 },
    { label: 'Internet Facing', value: String(internetFacing), bar: 'bg-red-500', pct: totalAssets ? Math.round((internetFacing / totalAssets) * 100) : 0 },
    { label: 'Agent Installed', value: String(agentInstalled), bar: 'bg-green-500', pct: totalAssets ? Math.round((agentInstalled / totalAssets) * 100) : 0 },
    { label: 'Avg Risk Score', value: String(avgRisk), bar: 'bg-amber-500', pct: avgRisk },
  ]

  const severityRows = [
    { label: 'Total Open Vulns', bar: 'bg-blue-500', count: totalVulns },
    { label: 'Open Critical', bar: 'bg-red-500', count: severityTotals.critical },
    { label: 'Open High', bar: 'bg-orange-500', count: severityTotals.high },
    { label: 'Open Medium', bar: 'bg-yellow-500', count: severityTotals.medium },
    { label: 'Open Low', bar: 'bg-green-500', count: severityTotals.low },
  ]

  if (loading) {
    return (
      <div className="p-5">
        <div className="text-sm text-muted-foreground">Loading dashboard…</div>
      </div>
    )
  }

  return (
    <div className="p-5 space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-black tracking-tight text-foreground">RBVM Dashboard</h2>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <div className="relative w-2 h-2">
              <div className="absolute inset-0 bg-red-500 rounded-full animate-pulse" />
            </div>
            <div className="px-3 py-1 rounded-md text-white text-xs font-bold tracking-wide" style={{ background: 'linear-gradient(135deg,#ef4444,#dc2626)' }}>
              LIVE
            </div>
          </div>
          <select value={timeFilter} onChange={(e) => setTimeFilter(e.target.value)} className="text-xs h-8 px-3 rounded-lg border border-border bg-background text-foreground focus:outline-none">
            <option>Today</option>
            <option>Last 7 Days</option>
            <option>Last 30 Days</option>
            <option>Last 90 Days</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-5 gap-4">
        <div className="col-span-2 rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Target className="w-4 h-4 text-blue-600" />
            <span className="text-xs font-bold tracking-widest uppercase text-blue-700">Current Risk Rating</span>
          </div>
          <div className="flex items-center justify-center py-6">
            <div className="relative w-52 h-52 rounded-full border-2 flex items-center justify-center" style={{ borderColor: grade.color }}>
              <div className="absolute inset-0 rounded-full border-2 animate-ping" style={{ borderColor: grade.color, opacity: 0.4 }} />
              <div className="w-44 h-44 rounded-full border border-border bg-white relative flex items-center justify-center overflow-hidden">
                <div className="absolute inset-3 rounded-full" style={{ background: `radial-gradient(circle, ${grade.color}30 0%, transparent 70%)` }} />
                <div className="relative z-10 flex flex-col items-center gap-1.5">
                  <div className="text-4xl font-semibold text-foreground flex items-end leading-none">
                    {overallScore}
                    <span className="text-[10px] text-muted-foreground ml-0.5 mb-0.5">/100</span>
                  </div>
                  <div className="relative flex items-center justify-center">
                    <div className="w-10 h-10 flex items-center justify-center text-white font-bold text-lg" style={{ backgroundColor: grade.color, boxShadow: `0 0 14px ${grade.color}80` }}>
                      {grade.g}
                    </div>
                  </div>
                  <div className="text-xs font-bold px-3 py-0.5 rounded-full" style={{ background: `${grade.color}22`, color: grade.color }}>
                    {grade.status} Risk
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="col-span-3 grid grid-cols-2 gap-3">
          {keyStats.map((s) => (
            <div key={s.label} className="rounded-xl border border-border bg-card p-4 flex flex-col gap-1.5 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">{s.label}</span>
                <div className={`w-2.5 h-2.5 rounded-full ${s.bar}`} />
              </div>
              <span className="text-xl font-bold text-foreground">{s.value}</span>
              <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                <div className={`h-1.5 rounded-full ${s.bar}`} style={{ width: `${s.pct}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card px-5 py-3 flex items-center justify-between shadow-sm">
        <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Risk Scale</span>
        {RISK_LEVELS.map((l) => (
          <div key={l.g} className="flex items-center gap-1.5">
            <div className={`w-6 h-6 rounded ${l.bg} text-white font-bold text-[10px] flex items-center justify-center`}>{l.g}</div>
            <span className="text-xs text-muted-foreground">
              {l.range} <span className="text-muted-foreground/70">({l.label})</span>
            </span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-5 gap-3">
        {severityRows.map((item) => (
          <div key={item.label} className="rounded-xl border border-border bg-card p-4 flex flex-col gap-1 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">{item.label}</span>
              <div className={`w-3 h-3 rounded-full ${item.bar}`} />
            </div>
            <div className="text-2xl font-bold text-foreground">{item.count}</div>
            <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden mt-1">
              <div className={`h-1.5 rounded-full ${item.bar}`} style={{ width: totalVulns ? `${(item.count / totalVulns) * 100}%` : '0%' }} />
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
        <h3 className="text-sm font-bold text-foreground mb-3">Assets by Criticality Tier</h3>
        <div className="grid grid-cols-5 gap-3">
          {['Tier 0', 'Tier 1', 'Tier 2', 'Tier 3', 'Tier 4'].map((tier) => (
            <div key={tier} className="text-center rounded-lg bg-muted/50 p-3">
              <div className="text-xl font-black text-foreground">{tierCounts[tier] ?? 0}</div>
              <div className="text-[10px] font-semibold mt-1 text-muted-foreground">{tier}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
        <h3 className="text-sm font-bold text-blue-700 mb-3 flex items-center gap-1.5">
          <span className="text-blue-500">↗</span> Vulnerability Discovery Trend
        </h3>
        {trendData.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">No trend data available yet — historical tracking begins once scans are recorded over time.</div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={trendData}>
              <defs>
                <linearGradient id="vulnGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="#94a3b8" />
              <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" />
              <Tooltip />
              <Area type="monotone" dataKey="vulns" stroke="#3b82f6" strokeWidth={2} fill="url(#vulnGradient)" dot={{ r: 4 }} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-border/40 bg-muted/30 flex items-center gap-2">
          <Zap className="h-4 w-4 text-amber-500" />
          <h3 className="text-sm font-bold text-amber-700">Top Prioritized Vulnerabilities</h3>
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">{totalVulns} open</span>
        </div>
        {totalAssets === 0 || topVulns.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">No vulnerability data available.</div>
        ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/40">
              <th className="h-9 px-4 text-left text-xs font-semibold text-muted-foreground uppercase">Vulnerability</th>
              <th className="h-9 px-4 text-left text-xs font-semibold text-muted-foreground uppercase">Sev</th>
              <th className="h-9 px-4 text-left text-xs font-semibold text-muted-foreground uppercase">CVSS</th>
              <th className="h-9 px-4 text-left text-xs font-semibold text-muted-foreground uppercase">Priority</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/30">
            {topVulns.map((v) => (
              <tr key={v.cve} className="hover:bg-muted/40">
                <td className="px-4 py-2.5">
                  <div className="font-medium text-foreground">{v.title}</div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-xs text-muted-foreground font-mono">{v.cve}</span>
                    {v.kev && <span className="text-[9px] font-bold px-1 py-0.5 rounded bg-red-100 text-red-700">KEV</span>}
                  </div>
                </td>
                <td className="px-4 py-2.5">
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-500 text-white">{v.sev}</span>
                </td>
                <td className="px-4 py-2.5 font-semibold text-red-600">{v.cvss}</td>
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
                      <div className="h-full bg-orange-500" style={{ width: `${v.priority}%` }} />
                    </div>
                    <span className="text-xs font-semibold">{v.priority}</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        )}
      </div>
    </div>
  )
}