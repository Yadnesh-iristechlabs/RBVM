import { useState } from 'react'
import { Search, RefreshCw, Calculator } from 'lucide-react'
import { toast } from 'sonner'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { VulnerabilitiesTable, type VulnRow } from '@/components/VulnerabilitiesTable'
import { VulnerabilityDetailDrawer } from '@/components/VulnerabilityDetailDrawer'
import { PunchVulnerabilityForm } from '@/components/PunchVulnerabilityForm'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'

const TABS = [
  { key: 'open', label: 'Open' },
  { key: 'exception', label: 'Exceptions' },
  { key: 'closed', label: 'Closed' },
  { key: 'all', label: 'All' },
]

export function Vulnerabilities() {
  const [refreshKey, setRefreshKey] = useState(0)
  const [search, setSearch] = useState('')
  const [severityFilter, setSeverityFilter] = useState('all')
  const [statusTab, setStatusTab] = useState('open')
  const [selectedRow, setSelectedRow] = useState<VulnRow | null>(null)
  const [punchOpen, setPunchOpen] = useState(false)
  const [recalculating, setRecalculating] = useState(false)
  const bumpRefresh = () => setRefreshKey((k) => k + 1)

  const handleRecalculate = async () => {
    setRecalculating(true)
    try {
      await fetch('/api/vulnerabilities/sync-threat-intel', { method: 'POST' })
      const res = await fetch('/api/vulnerabilities/recalculate-risk', { method: 'POST' })
      const data = await res.json()
      toast.success(`Risk scores recalculated: ${data.updated} updated${data.failed ? `, ${data.failed} failed` : ''}`)
      bumpRefresh()
    } catch (err) {
      toast.error('Failed to recalculate risk scores')
    } finally {
      setRecalculating(false)
    }
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Vulnerabilities</h1>
          <p className="text-sm text-muted-foreground">Risk-based findings across all connected sources</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleRecalculate} disabled={recalculating}>
            <Calculator size={16} className="mr-1" />
            {recalculating ? 'Recalculating...' : 'Recalculate Scores'}
          </Button>
          <Button onClick={() => setPunchOpen(true)}>
            <Plus size={16} className="mr-1" />
            Punch Vulnerability
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-1 border-b border-border">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setStatusTab(tab.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px cursor-pointer transition-colors ${statusTab === tab.key ? 'border-blue-600 text-blue-600' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2 justify-between">
        <div className="flex items-center gap-2">
          <div className="relative w-80">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search CVE, VRN, title, hostname..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select value={severityFilter} onValueChange={setSeverityFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="All Severities" />
            </SelectTrigger>
            <SelectContent position="popper" sideOffset={4}>
              <SelectItem value="all">All Severities</SelectItem>
              <SelectItem value="Critical">Critical</SelectItem>
              <SelectItem value="High">High</SelectItem>
              <SelectItem value="Medium">Medium</SelectItem>
              <SelectItem value="Low">Low</SelectItem>
              <SelectItem value="Info">Info</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <button onClick={bumpRefresh} className="p-2 rounded-md border border-input text-muted-foreground hover:bg-slate-800 hover:text-white transition-colors active:rotate-180" style={{ transition: 'transform 0.3s' }}>
          <RefreshCw size={14} />
        </button>
      </div>

      <VulnerabilitiesTable refreshKey={refreshKey} search={search} severityFilter={severityFilter} statusTab={statusTab} onRowClick={setSelectedRow} />
      {selectedRow && <VulnerabilityDetailDrawer discoveryId={selectedRow.discovery_id} onClose={() => setSelectedRow(null)} />}
      <PunchVulnerabilityForm open={punchOpen} onOpenChange={setPunchOpen} onSaved={bumpRefresh} />
    </div>
  )
}