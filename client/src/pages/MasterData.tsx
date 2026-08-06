import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { Database, Plus, Pencil, Trash2 } from 'lucide-react'

const MASTER_TYPES = [
  { key: 'asset_domain', label: 'Asset Domain' },
  { key: 'asset_class', label: 'Asset Class' },
  { key: 'asset_type', label: 'Asset Type' },
  { key: 'asset_environment', label: 'Asset Environment' },
  { key: 'asset_tier', label: 'Asset Tier' },
  { key: 'asset_status', label: 'Asset Status' },
  { key: 'department', label: 'Department' },
  { key: 'business_unit', label: 'Business Unit' },
  { key: 'location', label: 'Location / DC' },
  { key: 'asset_group', label: 'Asset Group' },
  { key: 'regulatory_config', label: 'Compliance Framework' },
  { key: 'controls', label: 'Compensating Controls' },
  { key: 'tags', label: 'Tags' },
]

interface MasterValue {
  id: number
  value: string
  is_active: boolean
  created_at: string
}

export function MasterData() {
  const [activeTab, setActiveTab] = useState(MASTER_TYPES[0].key)
  const [values, setValues] = useState<MasterValue[]>([])
  const [filter, setFilter] = useState('')
  const [loading, setLoading] = useState(true)

  const [showNewDialog, setShowNewDialog] = useState(false)
  const [newValue, setNewValue] = useState('')

  const [editingValue, setEditingValue] = useState<MasterValue | null>(null)

  const [deletingValue, setDeletingValue] = useState<MasterValue | null>(null)

  const fetchValues = () => {
    setLoading(true)
    fetch(`http://localhost:4001/api/masters/${activeTab}`)
      .then((res) => res.json())
      .then((data) => setValues(data))
      .catch(() => toast.error('Failed to load values'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchValues()
    setFilter('')
  }, [activeTab])

  const filteredValues = values.filter((v) => v.value.toLowerCase().includes(filter.toLowerCase()))

  const handleCreate = async () => {
    if (!newValue.trim()) return
    try {
      await fetch(`http://localhost:4001/api/masters/${activeTab}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: newValue.trim() }),
      })
      toast.success(`"${newValue}" added`)
      setNewValue('')
      setShowNewDialog(false)
      fetchValues()
    } catch {
      toast.error('Failed to add value')
    }
  }

  const handleRename = async () => {
    if (!editingValue || !editingValue.value.trim()) return
    try {
      // Rename = add the new value, deactivate the old one (masters table has no PUT-by-id rename route yet)
      await fetch(`http://localhost:4001/api/masters/${activeTab}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: editingValue.value.trim() }),
      })
      await fetch(`http://localhost:4001/api/masters/${activeTab}/${editingValue.id}`, { method: 'DELETE' })
      toast.success('Value updated')
      setEditingValue(null)
      fetchValues()
    } catch {
      toast.error('Failed to update value')
    }
  }

  const confirmDelete = async () => {
    if (!deletingValue) return
    try {
      await fetch(`http://localhost:4001/api/masters/${activeTab}/${deletingValue.id}`, { method: 'DELETE' })
      toast.success(`"${deletingValue.value}" removed`)
      setDeletingValue(null)
      fetchValues()
    } catch {
      toast.error('Failed to remove value')
    }
  }

  const activeLabel = MASTER_TYPES.find((m) => m.key === activeTab)?.label

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg shadow-md">
          <Database className="h-5 w-5 text-white" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-foreground">Masters</h2>
          <p className="text-sm text-muted-foreground">Configure master data used across the Assets module</p>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        <div className="border-b border-border bg-muted/20 overflow-x-auto">
          <div className="flex gap-0 min-w-max">
            {MASTER_TYPES.map((t) => (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                className={`px-4 py-3 text-xs font-medium border-b-2 transition-colors whitespace-nowrap cursor-pointer ${
                  activeTab === t.key ? 'border-blue-500 text-blue-600 bg-background' : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="p-5">
          <div className="flex items-center justify-between py-2 mb-3">
            <input
              placeholder={`Filter ${activeLabel?.toLowerCase()}...`}
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="max-w-sm h-9 px-3 text-sm rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            />
            <button
              onClick={() => setShowNewDialog(true)}
              className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-md bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 cursor-pointer"
            >
              <Plus className="h-4 w-4" /> New {activeLabel}
            </button>
          </div>

          <div className="rounded-md border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="h-10 px-4 text-left text-xs font-semibold text-muted-foreground uppercase">ID</th>
                  <th className="h-10 px-4 text-left text-xs font-semibold text-muted-foreground uppercase">{activeLabel}</th>
                  <th className="h-10 px-4 text-left text-xs font-semibold text-muted-foreground uppercase">Active Status</th>
                  <th className="h-10 px-4 text-right text-xs font-semibold text-muted-foreground uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {loading && (
                  <tr><td colSpan={4} className="h-24 text-center text-sm text-muted-foreground">Loading…</td></tr>
                )}
                {!loading && filteredValues.length === 0 && (
                  <tr><td colSpan={4} className="h-24 text-center text-sm text-muted-foreground">No results.</td></tr>
                )}
                {!loading && filteredValues.map((v, index) => (
                  <tr key={v.id} className="hover:bg-muted/40">
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">{index + 1}</td>
                    <td className="px-4 py-2.5 font-medium text-foreground">{v.value}</td>
                    <td className="px-4 py-2.5">
                      <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-green-500/10 text-green-700 border border-green-500/20">
                        Active
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => setEditingValue({ ...v })} className="h-8 w-8 flex items-center justify-center rounded text-blue-500 hover:text-blue-600 hover:bg-blue-50 cursor-pointer">
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button onClick={() => setDeletingValue(v)} className="h-8 w-8 flex items-center justify-center rounded text-red-500 hover:text-red-600 hover:bg-red-50 cursor-pointer">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {showNewDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowNewDialog(false)}>
          <div className="bg-card rounded-2xl shadow-2xl w-[380px]" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-border">
              <h3 className="font-bold text-foreground text-sm">New {activeLabel}</h3>
            </div>
            <div className="p-5 space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">Value</label>
              <input
                autoFocus
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                className="w-full h-9 px-3 text-sm rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              />
            </div>
            <div className="px-5 py-4 border-t border-border flex justify-end gap-2">
              <button onClick={() => setShowNewDialog(false)} className="h-8 px-3 text-xs font-semibold rounded-lg border border-border hover:bg-muted">Cancel</button>
              <button onClick={handleCreate} className="h-8 px-3 text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700">Create</button>
            </div>
          </div>
        </div>
      )}

      {editingValue && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setEditingValue(null)}>
          <div className="bg-card rounded-2xl shadow-2xl w-[380px]" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-border">
              <h3 className="font-bold text-foreground text-sm">Edit {activeLabel}</h3>
            </div>
            <div className="p-5 space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">Value</label>
              <input
                autoFocus
                value={editingValue.value}
                onChange={(e) => setEditingValue({ ...editingValue, value: e.target.value })}
                onKeyDown={(e) => e.key === 'Enter' && handleRename()}
                className="w-full h-9 px-3 text-sm rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              />
            </div>
            <div className="px-5 py-4 border-t border-border flex justify-end gap-2">
              <button onClick={() => setEditingValue(null)} className="h-8 px-3 text-xs font-semibold rounded-lg border border-border hover:bg-muted">Cancel</button>
              <button onClick={handleRename} className="h-8 px-3 text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700">Save</button>
            </div>
          </div>
        </div>
      )}

      {deletingValue && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setDeletingValue(null)}>
          <div className="bg-card rounded-2xl shadow-2xl w-[380px]" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-border">
              <h3 className="font-bold text-foreground text-sm">Confirm Deletion</h3>
            </div>
            <div className="p-5">
              <p className="text-sm text-muted-foreground">Are you sure you want to delete "{deletingValue.value}"? This action cannot be undone.</p>
            </div>
            <div className="px-5 py-4 border-t border-border flex justify-end gap-2">
              <button onClick={() => setDeletingValue(null)} className="h-8 px-3 text-xs font-semibold rounded-lg border border-border hover:bg-muted">Cancel</button>
              <button onClick={confirmDelete} className="h-8 px-3 text-xs font-semibold rounded-lg bg-red-600 text-white hover:bg-red-700">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}