import { useState, useMemo } from 'react'
import { toast } from 'sonner'
import { Eye, Pencil, Trash2, TrendingDown, TrendingUp, Minus, ArrowUp, ArrowDown, ArrowUpDown, Server, Wifi, AlertTriangle, ChevronDown } from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'
import { AddAssetForm } from '@/components/AddAssetForm'
import { AssetDetailDrawer } from '@/components/AssetDetailDrawer'
import { ScrollLock } from '@/components/ScrollLock'
import { useEffect } from 'react'
import type { MockAsset } from '@/mock/assets'
import { cn } from '@/lib/utils'

const TYPE_BADGE: Record<string, string> = {
  Server: 'bg-blue-500/10 text-blue-700 border-blue-200',
  'Network Device': 'bg-cyan-500/10 text-cyan-700 border-cyan-200',
  Workstation: 'bg-indigo-500/10 text-indigo-700 border-indigo-200',
  'Cloud Instance': 'bg-purple-500/10 text-purple-700 border-purple-200',
}

const EXPOSURE_BADGE: Record<string, string> = {
  Internet: 'bg-red-500/10 text-red-600 border-red-200',
  Internal: 'bg-blue-500/10 text-blue-600 border-blue-200',
  DMZ: 'bg-amber-500/10 text-amber-600 border-amber-200',
  Cloud: 'bg-purple-500/10 text-purple-600 border-purple-200',
}

const TIER_BADGE: Record<string, string> = {
  'Tier 0': 'bg-red-100 text-red-700 border-red-200',
  'Tier 1': 'bg-orange-100 text-orange-700 border-orange-200',
  'Tier 2': 'bg-amber-100 text-amber-700 border-amber-200',
  'Tier 3': 'bg-blue-100 text-blue-700 border-blue-200',
  'Tier 4': 'bg-slate-100 text-slate-600 border-slate-200',
}

const PRIORITY_BADGE: Record<string, string> = {
  '1': 'bg-red-100 text-red-700 border-red-200',
  '2': 'bg-orange-100 text-orange-700 border-orange-200',
  '3': 'bg-amber-100 text-amber-700 border-amber-200',
  '4': 'bg-slate-100 text-slate-600 border-slate-200',
}

function riskColor(score: number) {
  if (score >= 75) return '#ef4444'
  if (score >= 50) return '#f97316'
  if (score >= 25) return '#f59e0b'
  return '#22c55e'
}

function RiskBar({ score }: { score: number }) {
  const color = riskColor(score)
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${score}%`, backgroundColor: color }} />
      </div>
      <span className="text-xs font-bold" style={{ color }}>{score}</span>
    </div>
  )
}

function RiskTrend({ trend }: { trend: 'up' | 'down' }) {
  if (trend === 'down') return <TrendingDown className="h-3 w-3 text-green-600" />
  if (trend === 'up') return <TrendingUp className="h-3 w-3 text-red-600" />
  return <Minus className="h-3 w-3 text-muted-foreground/50" />
}

type SortKey = 'id' | 'hostname' | 'asset_type' | 'exposure' | 'criticality' | 'priority' | 'business_unit' | 'riskScore' | 'lastScan'
type SortDir = 'asc' | 'desc'

function SortableTh({ label, sortKey, activeKey, dir, onSort }: { label: string; sortKey: SortKey; activeKey: SortKey | null; dir: SortDir; onSort: (k: SortKey) => void }) {
  const isActive = activeKey === sortKey
  return (
    <th className="h-10 px-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">
      <button onClick={() => onSort(sortKey)} className="inline-flex items-center gap-1 hover:text-foreground transition-colors">
        {label}
        {isActive ? (dir === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />) : <ArrowUpDown size={12} className="opacity-50" />}
      </button>
    </th>
  )
}

const PAGE_SIZES = [10, 25, 50, 100]

export interface AdvancedFilters {
  assetTypes: string[]
  tiers: string[]
  owner: string
  department: string
  businessUnit: string
  exposure: string[]
  location: string
  compliance: string[]
  agentStatus: 'any' | 'installed' | 'not-installed'
  scanStatus: 'any' | 'scanned' | 'never'
}

export const EMPTY_ADV_FILTERS: AdvancedFilters = {
  assetTypes: [], tiers: [], owner: '', department: '', businessUnit: '',
  exposure: [], location: '', compliance: [], agentStatus: 'any', scanStatus: 'any',
}

export function AssetsTable({ refreshKey, search = '', filter = 'all', advFilters = EMPTY_ADV_FILTERS, onSelectionChange, onFilteredChange }: { refreshKey?: number; search?: string; filter?: string; advFilters?: AdvancedFilters; onSelectionChange?: (ids: number[]) => void; onFilteredChange?: (ids: number[]) => void } = {}) {
  const [assets, setAssets] = useState<MockAsset[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [sortKey, setSortKey] = useState<SortKey | null>('id')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [deleteTarget, setDeleteTarget] = useState<MockAsset | null>(null)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [editTarget, setEditTarget] = useState<MockAsset | null>(null)
  const [viewTarget, setViewTarget] = useState<MockAsset | null>(null)

  const fetchAssets = async () => {
    setLoading(true)
    try {
      const res = await fetch('http://localhost:4001/api/assets')
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
        riskTrend: 'down',
        riskLabel: 'Low',
        lastScan: row.last_seen ? new Date(row.last_seen).toLocaleDateString() : 'Never',
        agentInstalled: !!row.agent_installed,
        compliance_frameworks: row.compliance_frameworks ?? [],
        coordinators: row.coordinators ?? [],
        asset_code: row.asset_code,
        compliance_status: row.compliance_status,
        createdAt: row.created_at,
        cloud_provider: row.cloud_provider ?? '',
      }))
      setAssets(mapped)
    } catch (err) {
      console.error('failed to fetch assets', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAssets()
  }, [refreshKey])

  useEffect(() => {
    setPage(1)
  }, [pageSize, assets.length])

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortKey(key); setSortDir('asc') }
  }

  const filteredAssets = useMemo(() => {
    let result = assets

    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter((a) =>
        a.hostname.toLowerCase().includes(q) ||
        a.ip_address.toLowerCase().includes(q) ||
        a.fqdn?.toLowerCase().includes(q) ||
        a.os.toLowerCase().includes(q) ||
        a.owner.toLowerCase().includes(q)
      )
    }

    if (filter === 'critical') result = result.filter((a) => a.criticality === 'Tier 0' || a.criticality === 'Tier 1')
    if (filter === 'internet') result = result.filter((a) => a.exposure === 'Internet')
    if (filter === 'high-risk') result = result.filter((a) => a.riskScore >= 50)
    if (filter === 'cloud') result = result.filter((a) => a.asset_type === 'Cloud Instance' || !!a.cloud_provider)
    if (filter === 'not-scanned') result = result.filter((a) => a.lastScan === 'Never')
    if (filter === 'compliance') result = result.filter((a) => a.compliance_frameworks.length > 0)
    if (filter === 'network') result = result.filter((a) => a.asset_type === 'Network Device' || a.asset_type === 'Firewall')

    if (advFilters.assetTypes.length) result = result.filter((a) => advFilters.assetTypes.includes(a.asset_type))
    if (advFilters.tiers.length) result = result.filter((a) => advFilters.tiers.includes(a.criticality))
    if (advFilters.owner.trim()) result = result.filter((a) => a.owner?.toLowerCase().includes(advFilters.owner.toLowerCase()))
    if (advFilters.department.trim()) result = result.filter((a: any) => a.department?.toLowerCase().includes(advFilters.department.toLowerCase()))
    if (advFilters.businessUnit.trim()) result = result.filter((a) => a.business_unit?.toLowerCase().includes(advFilters.businessUnit.toLowerCase()))
    if (advFilters.exposure.length) result = result.filter((a) => advFilters.exposure.includes(a.exposure))
    if (advFilters.location.trim()) result = result.filter((a: any) => a.location?.toLowerCase().includes(advFilters.location.toLowerCase()))
    if (advFilters.compliance.length) result = result.filter((a) => advFilters.compliance.some((c) => a.compliance_frameworks.includes(c)))
    if (advFilters.agentStatus !== 'any') result = result.filter((a) => advFilters.agentStatus === 'installed' ? a.agentInstalled : !a.agentInstalled)
    if (advFilters.scanStatus !== 'any') result = result.filter((a) => advFilters.scanStatus === 'never' ? a.lastScan === 'Never' : a.lastScan !== 'Never')

    return result
  }, [assets, search, filter, advFilters])

  const sortedAssets = useMemo(() => {
    if (!sortKey) return filteredAssets
    const copy = [...filteredAssets]
    copy.sort((a, b) => {
      const aVal = sortKey === 'riskScore' || sortKey === 'id' ? (a as MockAsset)[sortKey] : String((a as MockAsset)[sortKey as keyof MockAsset])
      const bVal = sortKey === 'riskScore' || sortKey === 'id' ? (b as MockAsset)[sortKey] : String((b as MockAsset)[sortKey as keyof MockAsset])
      if (aVal < bVal) return sortDir === 'asc' ? -1 : 1
      if (aVal > bVal) return sortDir === 'asc' ? 1 : -1
      return 0
    })
    return copy
  }, [filteredAssets, sortKey, sortDir])

  const totalPages = Math.max(1, Math.ceil(sortedAssets.length / pageSize))
  const paginatedAssets = useMemo(() => {
    const start = (page - 1) * pageSize
    return sortedAssets.slice(start, start + pageSize)
  }, [sortedAssets, page, pageSize])

  const allSelected = assets.length > 0 && selected.size === assets.length
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(assets.map((a) => a.id)))
  const toggleOne = (id: number) => setSelected((prev) => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next })

  useEffect(() => { onSelectionChange?.(Array.from(selected)) }, [selected])
  useEffect(() => { onFilteredChange?.(filteredAssets.map((a) => a.id)) }, [filteredAssets])
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)
  const [bulkDeleting, setBulkDeleting] = useState(false)
  const [bulkDeleteConfirmText, setBulkDeleteConfirmText] = useState('')
  const [bulkOwnerOpen, setBulkOwnerOpen] = useState(false)
  const [bulkOwnerValue, setBulkOwnerValue] = useState('')
  const [bulkOwnerSaving, setBulkOwnerSaving] = useState(false)
  const [ownerList, setOwnerList] = useState<{ id: number; name: string; email: string }[]>([])
  const [ownerDropdownOpen, setOwnerDropdownOpen] = useState(false)

  const [bulkCoordOpen, setBulkCoordOpen] = useState(false)
  const [coordMode, setCoordMode] = useState<'append' | 'replace' | 'remove'>('append')
  const [coordInput, setCoordInput] = useState('')
  const [coordList, setCoordList] = useState<string[]>([])
  const [coordSaving, setCoordSaving] = useState(false)
  const [coordUserList, setCoordUserList] = useState<{ id: number; name: string; email: string }[]>([])
  const [coordDropdownOpen, setCoordDropdownOpen] = useState(false)

  const [bulkMastersOpen, setBulkMastersOpen] = useState(false)
  const [bulkMastersSaving, setBulkMastersSaving] = useState(false)
  const [masterFields, setMasterFields] = useState<Record<string, string>>({})
  const [masterOptions, setMasterOptions] = useState<Record<string, { id: number; value: string }[]>>({})

  const BULK_MASTER_FIELDS = [
    { key: 'department', label: 'Department', type: 'department' },
    { key: 'business_unit', label: 'Business Unit', type: 'business_unit' },
    { key: 'asset_tier', label: 'Criticality Tier', type: 'asset_tier' },
    { key: 'asset_environment', label: 'Environment', type: 'asset_environment' },
    { key: 'asset_status', label: 'Status', type: 'asset_status' },
    { key: 'location', label: 'Location', type: 'location' },
  ]

  useEffect(() => {
    if (bulkMastersOpen) {
      BULK_MASTER_FIELDS.forEach((f) => {
        fetch(`http://localhost:4001/api/masters/${f.type}`)
          .then((res) => res.json())
          .then((data) => setMasterOptions((prev) => ({ ...prev, [f.key]: data })))
          .catch(() => {})
      })
    }
  }, [bulkMastersOpen])

  const applyBulkMasters = async () => {
    const fields = Object.fromEntries(Object.entries(masterFields).filter(([, v]) => v))
    if (Object.keys(fields).length === 0) return
    setBulkMastersSaving(true)
    try {
      await fetch('http://localhost:4001/api/assets/bulk/masters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selected), fields }),
      })
      toast.success(`Updated ${Object.keys(fields).length} field(s) on ${selected.size} assets`)
      setBulkMastersOpen(false)
      setMasterFields({})
      setSelected(new Set())
      fetchAssets()
    } catch (err) {
      console.error('bulk masters update failed', err)
      toast.error('Failed to update fields')
    } finally {
      setBulkMastersSaving(false)
    }
  }

  useEffect(() => {
    if (bulkCoordOpen) {
      fetch('http://localhost:4001/api/users')
        .then((res) => res.json())
        .then(setCoordUserList)
        .catch(() => {})
    }
  }, [bulkCoordOpen])

  const addCoord = (email: string) => {
    if (email.trim() && !coordList.includes(email.trim())) {
      setCoordList([...coordList, email.trim()])
      setCoordInput('')
    }
  }

  const applyBulkCoordinators = async () => {
    if (coordList.length === 0) return
    setCoordSaving(true)
    try {
      await fetch('http://localhost:4001/api/assets/bulk/coordinators', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selected), coordinators: coordList, mode: coordMode }),
      })
      toast.success(`Coordinators ${coordMode === 'append' ? 'added to' : coordMode === 'remove' ? 'removed from' : 'replaced on'} ${selected.size} assets`)
      setBulkCoordOpen(false)
      setCoordList([])
      setSelected(new Set())
      fetchAssets()
    } catch (err) {
      console.error('bulk coordinators update failed', err)
      toast.error('Failed to update coordinators')
    } finally {
      setCoordSaving(false)
    }
  }

  useEffect(() => {
    if (bulkOwnerOpen) {
      fetch('http://localhost:4001/api/users')
        .then((res) => res.json())
        .then(setOwnerList)
        .catch(() => {})
    }
  }, [bulkOwnerOpen])

  const applyBulkOwner = async () => {
    if (!bulkOwnerValue.trim()) return
    setBulkOwnerSaving(true)
    try {
      await fetch('http://localhost:4001/api/assets/bulk/owner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selected), owner: bulkOwnerValue.trim() }),
      })
      toast.success(`Owner updated for ${selected.size} assets`)
      setBulkOwnerOpen(false)
      setBulkOwnerValue('')
      setSelected(new Set())
      fetchAssets()
    } catch (err) {
      console.error('bulk owner update failed', err)
      toast.error('Failed to update owner')
    } finally {
      setBulkOwnerSaving(false)
    }
  }

  const bulkDelete = async () => {
    setBulkDeleting(true)
    const count = selected.size
    try {
      await Promise.all(Array.from(selected).map((id) => fetch(`http://localhost:4001/api/assets/${id}`, { method: 'DELETE' })))
      toast.success(`${count} assets deleted`)
      setSelected(new Set())
      setBulkDeleteOpen(false)
      setBulkDeleteConfirmText('')
      fetchAssets()
    } catch (err) {
      console.error('bulk delete failed', err)
      toast.error('Bulk delete failed')
    } finally {
      setBulkDeleting(false)
    }
  }

  return (
    <div className="bg-card border border-border shadow-sm overflow-hidden rounded-xl">
      {selected.size > 0 && (
        <div className="flex items-center justify-between px-4 py-2.5 bg-blue-50 border-b border-blue-100">
          <span className="text-sm font-semibold text-blue-700">{selected.size} selected</span>
          <div className="flex items-center gap-2">
            <button onClick={() => setSelected(new Set())} className="text-xs text-blue-600 hover:underline cursor-pointer">Clear selection</button>
            <button onClick={() => setBulkOwnerOpen(true)} className="h-8 px-3 text-xs font-semibold rounded-md border border-blue-300 text-blue-700 hover:bg-blue-100 cursor-pointer">
              Update Owner
            </button>
            <button onClick={() => setBulkCoordOpen(true)} className="h-8 px-3 text-xs font-semibold rounded-md border border-blue-300 text-blue-700 hover:bg-blue-100 cursor-pointer">
              Update Coordinators
            </button>
            <button onClick={() => setBulkMastersOpen(true)} className="h-8 px-3 text-xs font-semibold rounded-md border border-blue-300 text-blue-700 hover:bg-blue-100 cursor-pointer">
              Update Master Fields
            </button>
            <button onClick={() => setBulkDeleteOpen(true)} className="h-8 px-3 text-xs font-semibold rounded-md bg-red-600 text-white hover:bg-red-700 cursor-pointer">
              Delete Selected
            </button>
          </div>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm table-auto">
          <thead>
            <tr className="border-b border-border/40 bg-muted/30">
              <th className="h-10 px-4 text-left w-10">
                <Checkbox checked={allSelected} onCheckedChange={toggleAll} className="border-slate-400" />
              </th>
              <SortableTh label="Asset" sortKey="hostname" activeKey={sortKey} dir={sortDir} onSort={handleSort} />
              <SortableTh label="Type" sortKey="asset_type" activeKey={sortKey} dir={sortDir} onSort={handleSort} />
              <SortableTh label="Exposure" sortKey="exposure" activeKey={sortKey} dir={sortDir} onSort={handleSort} />
              <SortableTh label="Tier" sortKey="criticality" activeKey={sortKey} dir={sortDir} onSort={handleSort} />
              <th className="h-10 px-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">Priority</th>
              <th className="h-10 px-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">BU / Data Center</th>
              <th className="h-10 px-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">Vulnerabilities</th>
              <SortableTh label="Risk Score" sortKey="riskScore" activeKey={sortKey} dir={sortDir} onSort={handleSort} />
              <SortableTh label="Last Scan" sortKey="lastScan" activeKey={sortKey} dir={sortDir} onSort={handleSort} />
              <th className="h-10 px-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">Frameworks</th>
              <th className="h-10 px-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/30">
            {paginatedAssets.map((asset) => {
              const totalVulns = asset.vulnCounts.critical + asset.vulnCounts.high + asset.vulnCounts.medium + asset.vulnCounts.low
              const Icon = asset.asset_type === 'Network Device' ? Wifi : Server
              return (
                <tr key={asset.id} className={cn('transition-colors hover:bg-muted/50 group align-top', selected.has(asset.id) && 'bg-blue-50/60')}>
                  <td className="px-4 py-3 align-top">
                    <Checkbox checked={selected.has(asset.id)} onCheckedChange={() => toggleOne(asset.id)} className="border-slate-400" />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                        <Icon className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold text-sm text-foreground truncate">{asset.hostname}</div>
                        <div className="text-[10px] text-muted-foreground/60 truncate">{asset.fqdn}</div>
                        <div className="text-xs text-muted-foreground font-mono">{asset.ip_address}</div>
                        <div className="text-xs text-muted-foreground truncate">{asset.os}</div>
                        <div className="text-[10px] text-muted-foreground/60 truncate">Owned by: {asset.owner}</div>
                        {(asset as any).asset_code && (
                          <div className="text-[10px] font-mono text-foreground/50 truncate mt-0.5">{(asset as any).asset_code}</div>
                        )}
                        {asset.createdAt && (
                          <div className="text-[10px] text-blue-500/70 truncate mt-0.5">Added {new Date(asset.createdAt).toLocaleString()}</div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full border w-fit inline-block', TYPE_BADGE[asset.asset_type] ?? 'bg-muted text-foreground border-border')}>{asset.asset_type}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full border', EXPOSURE_BADGE[asset.exposure] ?? 'bg-muted text-foreground border-border')}>{asset.exposure}</span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className={cn('text-xs font-bold px-2 py-0.5 rounded-full border whitespace-nowrap', TIER_BADGE[asset.criticality] ?? 'bg-slate-100 text-slate-600 border-slate-200')}>{asset.criticality}</span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className={cn('text-xs font-bold px-2 py-0.5 rounded-full border whitespace-nowrap', PRIORITY_BADGE[asset.priority] ?? 'bg-slate-100 text-slate-600 border-slate-200')}>P{asset.priority}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-xs text-foreground/80 truncate max-w-[130px]">{asset.business_unit}</div>
                    <div className="text-xs text-muted-foreground/70">{asset.location}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-0.5 flex-wrap">
                      {asset.vulnCounts.critical > 0 && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-500 text-white">{asset.vulnCounts.critical}</span>}
                      {asset.vulnCounts.high > 0 && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-orange-500 text-white">{asset.vulnCounts.high}</span>}
                      {asset.vulnCounts.medium > 0 && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-400 text-black">{asset.vulnCounts.medium}</span>}
                      {asset.vulnCounts.low > 0 && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-400 text-white">{asset.vulnCounts.low}</span>}
                    </div>
                    {totalVulns > 0 && <div className="text-xs text-muted-foreground/70 mt-0.5">{totalVulns} total</div>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <RiskBar score={asset.riskScore} />
                      <RiskTrend trend={asset.riskTrend} />
                    </div>
                    <div className="text-xs text-muted-foreground/70 mt-0.5">{asset.riskLabel}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-xs font-medium text-muted-foreground">{asset.lastScan}</div>
                    <div className="flex items-center gap-1 mt-0.5">
                      <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', asset.agentInstalled ? 'bg-green-500' : 'bg-muted-foreground/30')} />
                      <span className={cn('text-xs', asset.agentInstalled ? 'text-green-600' : 'text-muted-foreground/50')}>{asset.agentInstalled ? 'Agent' : 'No Agent'}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {asset.compliance_frameworks.map((f) => (
                        <span key={f} className="text-[10px] font-medium px-1.5 py-0.5 rounded-full border bg-violet-500/10 text-violet-700 border-violet-200">{f}</span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-0.5">
                      <button onClick={() => setViewTarget(asset)} className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-blue-600 transition-all"><Eye className="h-4 w-4" /></button>
                      <button onClick={() => setEditTarget(asset)} className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-blue-600 transition-all"><Pencil className="h-4 w-4" /></button>
                      <button onClick={() => setDeleteTarget(asset)} className="p-1.5 rounded hover:bg-red-50 text-muted-foreground hover:text-red-600 transition-all"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between px-4 py-3 border-t border-border/40 text-sm">
        <div className="flex items-center gap-2 text-muted-foreground">
          <span>Rows per page:</span>
          <select
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value))}
            className="h-8 px-2 rounded-md border border-input bg-background text-foreground text-sm"
          >
            {PAGE_SIZES.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
          <span className="ml-2">
            {sortedAssets.length === 0 ? '0 of 0' : `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, sortedAssets.length)} of ${sortedAssets.length}`}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="h-8 px-3 rounded-md border border-input text-muted-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Previous
          </button>
          <span className="px-2 text-muted-foreground">Page {page} of {totalPages}</span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="h-8 px-3 rounded-md border border-input text-muted-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
      </div>

      {deleteTarget && (
        <ScrollLock />
      )}
      {deleteTarget && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40" onClick={() => { setDeleteTarget(null); setDeleteConfirmText('') }}>
          <div className="bg-card rounded-2xl shadow-2xl w-[400px] max-w-full" onClick={(e) => e.stopPropagation()}>
            <div className="p-5 space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                  <AlertTriangle className="h-4 w-4 text-red-600" />
                </div>
                <h3 className="font-bold text-foreground text-sm">Delete Asset</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                Are you sure you want to delete <span className="font-semibold text-foreground">{deleteTarget.hostname}</span>? This action cannot be undone.
              </p>
              <div className="space-y-2">
                <label className="text-xs font-semibold text-muted-foreground block">Type <span className="font-mono text-foreground">DELETE</span> to confirm</label>
                <input
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder="DELETE"
                  className="w-full h-9 px-3 text-sm rounded-md border border-border/60 bg-background focus:outline-none focus:ring-2 focus:ring-red-500/30 font-mono"
                />
              </div>
            </div>
            <div className="px-5 py-4 border-t border-border flex justify-end gap-2">
              <button onClick={() => { setDeleteTarget(null); setDeleteConfirmText('') }} className="h-9 px-4 text-sm font-semibold rounded-lg border border-border hover:bg-muted/50">Cancel</button>
              <button
                disabled={deleteConfirmText !== 'DELETE'}
                onClick={async () => {
                  try {
                    await fetch(`http://localhost:4001/api/assets/${deleteTarget.id}`, { method: 'DELETE' })
                    toast.success(`${deleteTarget.hostname} deleted`)
                    setDeleteTarget(null)
                    setDeleteConfirmText('')
                    fetchAssets()
                  } catch (err) {
                    console.error('delete failed', err)
                    toast.error('Failed to delete asset')
                  }
                }}
                className="h-9 px-4 text-sm font-semibold rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {bulkOwnerOpen && (
        <>
          <ScrollLock />
          <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40" onClick={() => setBulkOwnerOpen(false)}>
            <div className="bg-card rounded-2xl shadow-2xl w-[400px] max-w-full" onClick={(e) => e.stopPropagation()}>
              <div className="p-5 space-y-3">
                <h3 className="font-bold text-foreground text-sm">Update Owner for {selected.size} Assets</h3>
                <div className="space-y-1.5 relative">
                  <label className="text-xs font-semibold text-muted-foreground">New Owner</label>
                  <div className="relative">
                    <input
                      value={bulkOwnerValue}
                      onChange={(e) => { setBulkOwnerValue(e.target.value); setOwnerDropdownOpen(true) }}
                      onFocus={() => setOwnerDropdownOpen(true)}
                      onBlur={() => setTimeout(() => setOwnerDropdownOpen(false), 150)}
                      placeholder="Search or select an existing owner..."
                      className="w-full h-9 pl-3 pr-9 text-sm rounded-md border border-border/60 bg-background focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                    />
                    <button
                      type="button"
                      tabIndex={-1}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => setOwnerDropdownOpen((o) => !o)}
                      className="absolute right-0 top-0 h-9 w-9 flex items-center justify-center text-muted-foreground cursor-pointer"
                    >
                      <ChevronDown size={15} className={`transition-transform ${ownerDropdownOpen ? 'rotate-180' : ''}`} />
                    </button>
                  </div>
                  {ownerDropdownOpen && (
                    <div className="absolute z-10 mt-1 w-full max-h-48 overflow-y-auto rounded-md border border-border bg-card shadow-lg">
                      {ownerList.filter((o) => o.name.toLowerCase().includes(bulkOwnerValue.toLowerCase()) || o.email.toLowerCase().includes(bulkOwnerValue.toLowerCase())).length === 0 ? (
                        <div className="px-3 py-2 text-sm text-muted-foreground">No matching users found in the User Master</div>
                      ) : (
                        ownerList.filter((o) => o.name.toLowerCase().includes(bulkOwnerValue.toLowerCase()) || o.email.toLowerCase().includes(bulkOwnerValue.toLowerCase())).map((o) => (
                          <button
                            key={o.id}
                            type="button"
                            onMouseDown={() => { setBulkOwnerValue(o.email); setOwnerDropdownOpen(false) }}
                            className="w-full text-left px-3 py-2 text-sm hover:bg-muted cursor-pointer"
                          >
                            <div className="font-medium text-foreground">{o.name}</div>
                            <div className="text-xs text-muted-foreground">{o.email}</div>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>
              <div className="px-5 py-4 border-t border-border flex justify-end gap-2">
                <button onClick={() => setBulkOwnerOpen(false)} className="h-9 px-4 text-sm font-semibold rounded-lg border border-border hover:bg-muted/50 cursor-pointer">Cancel</button>
                <button
                  onClick={applyBulkOwner}
                  disabled={bulkOwnerSaving || !bulkOwnerValue.trim()}
                  className="h-9 px-4 text-sm font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  {bulkOwnerSaving ? 'Updating…' : 'Update Owner'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {bulkCoordOpen && (
        <>
          <ScrollLock />
          <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40" onClick={() => setBulkCoordOpen(false)}>
            <div className="bg-card rounded-2xl shadow-2xl w-[420px] max-w-full" onClick={(e) => e.stopPropagation()}>
              <div className="p-5 space-y-4">
                <h3 className="font-bold text-foreground text-sm">Update Coordinators for {selected.size} Assets</h3>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">Update Mode</label>
                  <div className="flex gap-2">
                    {(['append', 'replace', 'remove'] as const).map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setCoordMode(m)}
                        className={`flex-1 h-9 text-xs font-semibold rounded-md border capitalize cursor-pointer transition-colors ${
                          coordMode === m ? 'bg-blue-600 text-white border-blue-600' : 'border-border text-muted-foreground hover:bg-muted'
                        }`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    {coordMode === 'append' && 'Adds these coordinators while keeping existing ones.'}
                    {coordMode === 'replace' && 'Overwrites all current coordinators with this list.'}
                    {coordMode === 'remove' && 'Removes only these coordinators from the assets.'}
                  </p>
                </div>

                <div className="space-y-1.5 relative">
                  <label className="text-xs font-semibold text-muted-foreground">Coordinators</label>
                  <div className="relative">
                    <input
                      value={coordInput}
                      onChange={(e) => { setCoordInput(e.target.value); setCoordDropdownOpen(true) }}
                      onFocus={() => setCoordDropdownOpen(true)}
                      onBlur={() => setTimeout(() => setCoordDropdownOpen(false), 150)}
                      placeholder="Search users to add as coordinators..."
                      className="w-full h-9 px-3 text-sm rounded-md border border-border/60 bg-background focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                    />
                  </div>
                  {coordDropdownOpen && (
                    <div className="absolute z-10 mt-1 w-full max-h-40 overflow-y-auto rounded-md border border-border bg-card shadow-lg">
                      {coordUserList.filter((u) => u.name.toLowerCase().includes(coordInput.toLowerCase()) || u.email.toLowerCase().includes(coordInput.toLowerCase())).length === 0 ? (
                        <div className="px-3 py-2 text-sm text-muted-foreground">No matching users found in the User Master</div>
                      ) : (
                        coordUserList.filter((u) => u.name.toLowerCase().includes(coordInput.toLowerCase()) || u.email.toLowerCase().includes(coordInput.toLowerCase())).map((u) => (
                          <button
                            key={u.id}
                            type="button"
                            onMouseDown={() => { addCoord(u.email); setCoordDropdownOpen(false) }}
                            className="w-full text-left px-3 py-2 text-sm hover:bg-muted cursor-pointer"
                          >
                            <div className="font-medium text-foreground">{u.name}</div>
                            <div className="text-xs text-muted-foreground">{u.email}</div>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                  {coordList.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {coordList.map((c) => (
                        <span key={c} className="flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-secondary">
                          {c}
                          <button type="button" onClick={() => setCoordList(coordList.filter((x) => x !== c))} className="cursor-pointer">×</button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="px-5 py-4 border-t border-border flex justify-end gap-2">
                <button onClick={() => setBulkCoordOpen(false)} className="h-9 px-4 text-sm font-semibold rounded-lg border border-border hover:bg-muted/50 cursor-pointer">Cancel</button>
                <button
                  onClick={applyBulkCoordinators}
                  disabled={coordSaving || coordList.length === 0}
                  className="h-9 px-4 text-sm font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  {coordSaving ? 'Updating…' : 'Apply'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {bulkMastersOpen && (
        <>
          <ScrollLock />
          <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40" onClick={() => setBulkMastersOpen(false)}>
            <div className="bg-card rounded-2xl shadow-2xl w-[440px] max-w-full" onClick={(e) => e.stopPropagation()}>
              <div className="p-5 space-y-3">
                <h3 className="font-bold text-foreground text-sm">Update Master Fields for {selected.size} Assets</h3>
                <p className="text-xs text-muted-foreground">Only fields you set below will be updated — leave others blank to keep them unchanged.</p>
                <div className="grid grid-cols-2 gap-3 pt-1">
                  {BULK_MASTER_FIELDS.map((f) => (
                    <div key={f.key} className="space-y-1">
                      <label className="text-xs font-semibold text-muted-foreground">{f.label}</label>
                      <select
                        value={masterFields[f.key] || ''}
                        onChange={(e) => setMasterFields({ ...masterFields, [f.key]: e.target.value })}
                        className="w-full h-9 px-2 text-sm rounded-md border border-border/60 bg-background focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                      >
                        <option value="">— No change —</option>
                        {(masterOptions[f.key] || []).map((o) => (
                          <option key={o.id} value={o.value}>{o.value}</option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </div>
              <div className="px-5 py-4 border-t border-border flex justify-end gap-2">
                <button onClick={() => setBulkMastersOpen(false)} className="h-9 px-4 text-sm font-semibold rounded-lg border border-border hover:bg-muted/50 cursor-pointer">Cancel</button>
                <button
                  onClick={applyBulkMasters}
                  disabled={bulkMastersSaving || Object.values(masterFields).every((v) => !v)}
                  className="h-9 px-4 text-sm font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  {bulkMastersSaving ? 'Updating…' : 'Apply Changes'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {bulkDeleteOpen && (
        <>
          <ScrollLock />
          <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40" onClick={() => { setBulkDeleteOpen(false); setBulkDeleteConfirmText('') }}>
            <div className="bg-card rounded-2xl shadow-2xl w-[400px] max-w-full" onClick={(e) => e.stopPropagation()}>
              <div className="p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                    <AlertTriangle className="h-4 w-4 text-red-600" />
                  </div>
                  <h3 className="font-bold text-foreground text-sm">Delete {selected.size} Assets</h3>
                </div>
                <p className="text-sm text-muted-foreground">
                  Are you sure you want to delete {selected.size} selected assets? This action cannot be undone.
                </p>
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-muted-foreground block">Type <span className="font-mono text-foreground">DELETE</span> to confirm</label>
                  <input
                    value={bulkDeleteConfirmText}
                    onChange={(e) => setBulkDeleteConfirmText(e.target.value)}
                    placeholder="DELETE"
                    className="w-full h-9 px-3 text-sm rounded-md border border-border/60 bg-background focus:outline-none focus:ring-2 focus:ring-red-500/30 font-mono"
                  />
                </div>
              </div>
              <div className="px-5 py-4 border-t border-border flex justify-end gap-2">
                <button onClick={() => { setBulkDeleteOpen(false); setBulkDeleteConfirmText('') }} className="h-9 px-4 text-sm font-semibold rounded-lg border border-border hover:bg-muted/50">Cancel</button>
                <button
                  onClick={bulkDelete}
                  disabled={bulkDeleting || bulkDeleteConfirmText !== 'DELETE'}
                  className="h-9 px-4 text-sm font-semibold rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {bulkDeleting ? 'Deleting…' : 'Confirm Delete'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {editTarget && <AddAssetForm open={!!editTarget} onOpenChange={(v) => !v && setEditTarget(null)} asset={editTarget} onSaved={fetchAssets} />}
      {viewTarget && <AssetDetailDrawer asset={viewTarget} onClose={() => setViewTarget(null)} onEdit={(a) => { setViewTarget(null); setEditTarget(a) }} />}
    </div>
  )
}