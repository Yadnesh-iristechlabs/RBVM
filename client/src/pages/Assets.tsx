import { useState, useRef, useEffect } from 'react'
import { Plus, Search, RefreshCw, Upload, Download, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { AssetsTable, EMPTY_ADV_FILTERS } from '@/components/AssetsTable'
import { ApplicationsView } from '@/components/ApplicationsView'
import type { AdvancedFilters } from '@/components/AssetsTable'
import { AdvancedFilterPanel } from '@/components/AdvancedFilterPanel'
import { AddAssetForm } from '@/components/AddAssetForm'
import { ImportAssetsModal } from '@/components/ImportAssetsModal'

export function Assets() {
  const [addOpen, setAddOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const bumpRefresh = () => setRefreshKey((k) => k + 1)

  const [exportMenuOpen, setExportMenuOpen] = useState(false)
  const [viewMode, setViewMode] = useState<'infra' | 'app'>('infra')
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [filteredIds, setFilteredIds] = useState<number[]>([])
  const [advFilters, setAdvFilters] = useState<AdvancedFilters>(EMPTY_ADV_FILTERS)
  const [showAdvPanel, setShowAdvPanel] = useState(false)
  const exportMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) setExportMenuOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const downloadBlob = (content: BlobPart, mime: string, filename: string) => {
    const blob = new Blob([content], { type: mime })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  const buildCsvString = (data: Record<string, any>[]) => {
    const headers = Object.keys(data[0])
    const rows = [
      headers.join(','),
      ...data.map((row) =>
        headers.map((h) => {
          const val = row[h]
          if (val === null || val === undefined) return ''
          const str = Array.isArray(val) ? val.join(';') : String(val)
          return str.includes(',') ? `"${str}"` : str
        }).join(',')
      ),
    ]
    return rows.join('\n')
  }

  const handleExport = async (format: 'csv' | 'xlsx' | 'xml', scope: 'all' | 'filtered' | 'selected' = 'all') => {
    setExportMenuOpen(false)
    try {
      const res = await fetch('/api/assets')
      let data = await res.json()

      if (scope === 'selected') {
        data = data.filter((a: any) => selectedIds.includes(a.id))
      } else if (scope === 'filtered') {
        data = data.filter((a: any) => filteredIds.includes(a.id))
      }
      if (data.length === 0) return
      const dateStr = new Date().toISOString().split('T')[0]

      if (format === 'csv') {
        downloadBlob(buildCsvString(data), 'text/csv;charset=utf-8;', `rbvm_assets_export_${dateStr}.csv`)
      }

      if (format === 'xlsx') {
        const XLSX = await import('xlsx')
        const ws = XLSX.utils.json_to_sheet(data)
        const wb = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(wb, ws, 'Assets')
        XLSX.writeFile(wb, `rbvm_assets_export_${dateStr}.xlsx`)
      }

      if (format === 'xml') {
        const escapeXml = (s: any) => String(s ?? '').replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c] || c))
        const items = data.map((row: Record<string, any>) => {
          const fields = Object.entries(row).map(([k, v]) => `    <${k}>${escapeXml(Array.isArray(v) ? v.join(';') : v)}</${k}>`).join('\n')
          return `  <asset>\n${fields}\n  </asset>`
        }).join('\n')
        const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<assets>\n${items}\n</assets>`
        downloadBlob(xml, 'application/xml;charset=utf-8;', `rbvm_assets_export_${dateStr}.xml`)
      }
    } catch (err) {
      console.error('export failed', err)
    }
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Asset Inventory</h1>
          <p className="text-sm text-muted-foreground">Manage and monitor all assets across your organization</p>
        </div>
        <div className="flex items-center gap-15">
          <div className="flex items-center h-10 rounded-md border border-input overflow-hidden">
            <button onClick={() => setViewMode('infra')} className={`h-full px-3 text-sm font-medium cursor-pointer ${viewMode === 'infra' ? 'bg-blue-600 text-white' : 'text-muted-foreground hover:bg-muted'}`}>Infrastructure View</button>
            <button onClick={() => setViewMode('app')} className={`h-full px-3 text-sm font-medium cursor-pointer ${viewMode === 'app' ? 'bg-purple-600 text-white' : 'text-muted-foreground hover:bg-muted'}`}>Application View</button>
          </div>
          <Button onClick={() => setAddOpen(true)}>
            <Plus size={16} className="mr-1" />
            Add Asset
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <div className="relative w-80">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search hostname, IP, FQDN, OS, owner..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        </div>

      <div className="flex items-center gap-2 justify-between">
        <div className="flex items-center gap-2">
          <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="All Assets" />
          </SelectTrigger>
          <SelectContent position="popper" sideOffset={4}>
            <SelectItem value="all">All Assets</SelectItem>
            <SelectItem value="favourites">My Favourites</SelectItem>
            <SelectItem value="critical">Critical assets</SelectItem>
            <SelectItem value="internet">Internet Facing</SelectItem>
            <SelectItem value="high-risk">High risk assets</SelectItem>
            <SelectItem value="cloud">Cloud assets</SelectItem>
            <SelectItem value="not-scanned">Not scanned 30d</SelectItem>
            <SelectItem value="compliance">Compliance</SelectItem>
            <SelectItem value="network">Network assets</SelectItem>
          </SelectContent>
        </Select>
          <button
            onClick={() => setShowAdvPanel((s) => !s)}
            className={`px-3 py-2 rounded-md border text-sm font-medium cursor-pointer transition-colors ${showAdvPanel ? 'bg-blue-600 text-white border-blue-600' : 'border-input text-foreground hover:bg-muted'}`}
          >
            Advanced Filters {Object.entries(advFilters).filter(([, v]) => Array.isArray(v) ? v.length > 0 : v && v !== 'any').length > 0 && `(${Object.entries(advFilters).filter(([, v]) => Array.isArray(v) ? v.length > 0 : v && v !== 'any').length})`}
          </button>
        </div>

        <div className="flex items-center gap-3 text-sm">
          <button onClick={bumpRefresh} className="p-2 rounded-md border border-input text-muted-foreground hover:bg-slate-800 hover:text-white transition-colors active:rotate-180" style={{ transition: 'transform 0.3s' }}>
            <RefreshCw size={14} />
          </button>
          <button onClick={() => setImportOpen(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-md border border-input text-sm text-foreground hover:bg-slate-800 hover:text-white transition-colors">
            <Upload size={14} />
            Import
          </button>
          <div className="relative" ref={exportMenuRef}>
            <button onClick={() => setExportMenuOpen((o) => !o)} className="flex items-center gap-1.5 px-3 py-2 rounded-md border border-input text-sm text-foreground hover:bg-slate-800 hover:text-white transition-colors">
              <Download size={14} />
              Export
              <ChevronDown size={12} />
            </button>
            {exportMenuOpen && (
              <div className="absolute right-0 mt-1 w-56 rounded-md border border-border bg-card shadow-lg z-20 py-1">
                {(['all', 'filtered', 'selected'] as const).map((scope) => (
                  <div key={scope} className="px-3 py-1.5">
                    <div className="text-[10px] font-semibold uppercase text-muted-foreground mb-1">
                      {scope === 'all' ? 'All Assets' : scope === 'filtered' ? `Filtered View (${filteredIds.length})` : `Selected (${selectedIds.length})`}
                    </div>
                    <div className="flex gap-1">
                      {(['csv', 'xlsx', 'xml'] as const).map((fmt) => (
                        <button
                          key={fmt}
                          disabled={scope === 'selected' && selectedIds.length === 0}
                          onClick={() => handleExport(fmt, scope)}
                          className="flex-1 text-xs px-2 py-1 rounded border border-border text-foreground hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                        >
                          {fmt.toUpperCase()}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {viewMode === 'infra' ? (
        <>
          {showAdvPanel && <AdvancedFilterPanel value={advFilters} onChange={setAdvFilters} onClose={() => setShowAdvPanel(false)} />}
          <AssetsTable refreshKey={refreshKey} search={search} filter={filter} advFilters={advFilters} onSelectionChange={setSelectedIds} onFilteredChange={setFilteredIds} />
        </>
      ) : (
        <ApplicationsView />
      )}
      <AddAssetForm open={addOpen} onOpenChange={setAddOpen} onSaved={bumpRefresh} />
      <ImportAssetsModal open={importOpen} onOpenChange={setImportOpen} onImported={bumpRefresh} />
    </div>
  )
}