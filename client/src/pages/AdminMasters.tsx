import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { Database, Plus, Pencil, Trash2 } from 'lucide-react'

const TOP_TABS = ['Tenants / Workspaces', 'Masters', 'Integrations', 'Data Management', 'Regulatory SLA', 'Exception Policy', 'Communication', 'Automation & Response', 'Pipeline Gates', 'Compliance Regulations', 'App Inventory', 'Workflow', 'Templates', 'News Sync', 'Audit Log', 'Logs', 'Diagnostics']

const FUNCTIONAL_TABS = [
  { key: 'asset_domain', label: 'Asset Domain' },
  { key: 'asset_class', label: 'Asset Class' },
  { key: 'asset_type', label: 'Asset Type' },
  { key: 'asset_environment', label: 'Asset Environment' },
  { key: 'asset_tier', label: 'Asset Tier' },
  { key: 'asset_status', label: 'Asset Status' },
  { key: 'department', label: 'Department' },
  { key: 'location', label: 'Location / DC' },
  { key: 'regulatory_config', label: 'Regulatory Config' },
  { key: 'asset_group', label: 'Asset Groups' },
  { key: 'controls', label: 'Controls' },
  { key: 'business_unit', label: 'Business Units' },
  { key: 'tags', label: 'Tags' },
]

const ROADMAP_TABS = ['Risk Rating (FAIR)', 'Asset Priority', 'IP ↔ Application Correlation', 'Vuln → Pentest', 'NXVM Agent', 'Integrations', 'Prioritization Rules']
const APP_MASTER_TAB = 'Applications'
const OUT_OF_SCOPE_TABS = ['Organisation', 'Users & Vendors', 'Members', 'My Profile', 'Settings']
const FUNCTIONAL_EXTRA_TABS = ['Users & Vendors']

const MASTER_GROUP_TABS = [...FUNCTIONAL_TABS.map((t) => t.label), APP_MASTER_TAB, ...ROADMAP_TABS, ...OUT_OF_SCOPE_TABS]

function Placeholder({ label, roadmap }: { label: string; roadmap: boolean }) {
  return (
    <div className="rounded-lg border border-dashed border-border bg-muted/20 p-8 text-center">
      <p className="text-sm font-medium text-foreground">{label}</p>
      <p className="text-sm text-muted-foreground mt-1.5">
        {roadmap
          ? 'This module is planned for a future phase of RBVM development and is not yet available.'
          : 'This functionality is outside the current RBVM scope.'}
      </p>
    </div>
  )
}

function MastersTable({ masterKey, label }: { masterKey: string; label: string }) {
  const [values, setValues] = useState<{ id: number; value: string; created_at?: string }[]>([])
  const [filter, setFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [showNewDialog, setShowNewDialog] = useState(false)
  const [newValue, setNewValue] = useState('')
  const [editingValue, setEditingValue] = useState<{ id: number; value: string } | null>(null)
  const [deletingValue, setDeletingValue] = useState<{ id: number; value: string } | null>(null)

  const fetchValues = () => {
    setLoading(true)
    fetch(`http://localhost:4001/api/masters/${masterKey}`)
      .then((res) => res.json())
      .then(setValues)
      .catch(() => toast.error('Failed to load values'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchValues(); setFilter('') }, [masterKey])

  const filteredValues = values.filter((v) => v.value.toLowerCase().includes(filter.toLowerCase()))

  const handleCreate = async () => {
    if (!newValue.trim()) return
    await fetch(`http://localhost:4001/api/masters/${masterKey}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ value: newValue.trim() }),
    })
    toast.success(`"${newValue}" added`)
    setNewValue(''); setShowNewDialog(false); fetchValues()
  }

  const handleRename = async () => {
    if (!editingValue?.value.trim()) return
    await fetch(`http://localhost:4001/api/masters/${masterKey}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ value: editingValue.value.trim() }),
    })
    await fetch(`http://localhost:4001/api/masters/${masterKey}/${editingValue.id}`, { method: 'DELETE' })
    toast.success('Value updated'); setEditingValue(null); fetchValues()
  }

  const confirmDelete = async () => {
    if (!deletingValue) return
    await fetch(`http://localhost:4001/api/masters/${masterKey}/${deletingValue.id}`, { method: 'DELETE' })
    toast.success(`"${deletingValue.value}" removed`); setDeletingValue(null); fetchValues()
  }

  return (
    <div className="bg-card border border-border rounded-xl shadow-sm p-5 min-h-[420px]">
      <div className="flex items-center justify-between py-2 mb-3">
        <input
          placeholder={`Filter ${label.toLowerCase()}...`}
          value={filter} onChange={(e) => setFilter(e.target.value)}
          className="max-w-sm h-9 px-3 text-sm rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-blue-500/30"
        />
        <button onClick={() => setShowNewDialog(true)} className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-md bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 cursor-pointer">
          <Plus className="h-4 w-4" /> New {label}
        </button>
      </div>
      <div className="rounded-md border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="h-10 px-4 text-left text-xs font-semibold text-muted-foreground uppercase">ID</th>
              <th className="h-10 px-4 text-left text-xs font-semibold text-muted-foreground uppercase">{label}</th>
              <th className="h-10 px-4 text-left text-xs font-semibold text-muted-foreground uppercase">Active Status</th>
              <th className="h-10 px-4 text-left text-xs font-semibold text-muted-foreground uppercase">Created On</th>
              <th className="h-10 px-4 text-right text-xs font-semibold text-muted-foreground uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/30">
            {loading && <tr><td colSpan={5} className="h-24 text-center text-sm text-muted-foreground">Loading…</td></tr>}
            {!loading && filteredValues.length === 0 && <tr><td colSpan={5} className="h-24 text-center text-sm text-muted-foreground">No results.</td></tr>}
            {!loading && filteredValues.map((v: any, i) => (
              <tr key={v.id} className="hover:bg-muted/40">
                <td className="px-4 py-2.5 text-xs text-muted-foreground">{i + 1}</td>
                <td className="px-4 py-2.5 font-medium text-foreground">{v.value}</td>
                <td className="px-4 py-2.5">
                  <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-green-500/10 text-green-700 border border-green-500/20">Active</span>
                </td>
                <td className="px-4 py-2.5 text-xs text-muted-foreground">{v.created_at ? new Date(v.created_at).toLocaleDateString() : '—'}</td>
                <td className="px-4 py-2.5">
                  <div className="flex items-center justify-end gap-1">
                    <button onClick={() => setEditingValue({ ...v })} className="h-8 w-8 flex items-center justify-center rounded text-blue-500 hover:text-blue-600 hover:bg-blue-50 cursor-pointer"><Pencil className="h-4 w-4" /></button>
                    <button onClick={() => setDeletingValue(v)} className="h-8 w-8 flex items-center justify-center rounded text-red-500 hover:text-red-600 hover:bg-red-50 cursor-pointer"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showNewDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowNewDialog(false)}>
          <div className="bg-card rounded-2xl shadow-2xl w-[380px]" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-border"><h3 className="font-bold text-foreground text-sm">New {label}</h3></div>
            <div className="p-5 space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">Value</label>
              <input autoFocus value={newValue} onChange={(e) => setNewValue(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleCreate()} className="w-full h-9 px-3 text-sm rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
            </div>
            <div className="px-5 py-4 border-t border-border flex justify-end gap-2">
              <button onClick={() => setShowNewDialog(false)} className="h-8 px-3 text-xs font-semibold rounded-lg border border-border hover:bg-muted cursor-pointer">Cancel</button>
              <button onClick={handleCreate} className="h-8 px-3 text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 cursor-pointer">Create</button>
            </div>
          </div>
        </div>
      )}
      {editingValue && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setEditingValue(null)}>
          <div className="bg-card rounded-2xl shadow-2xl w-[380px]" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-border"><h3 className="font-bold text-foreground text-sm">Edit {label}</h3></div>
            <div className="p-5 space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">Value</label>
              <input autoFocus value={editingValue.value} onChange={(e) => setEditingValue({ ...editingValue, value: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && handleRename()} className="w-full h-9 px-3 text-sm rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
            </div>
            <div className="px-5 py-4 border-t border-border flex justify-end gap-2">
              <button onClick={() => setEditingValue(null)} className="h-8 px-3 text-xs font-semibold rounded-lg border border-border hover:bg-muted cursor-pointer">Cancel</button>
              <button onClick={handleRename} className="h-8 px-3 text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 cursor-pointer">Save</button>
            </div>
          </div>
        </div>
      )}
      {deletingValue && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setDeletingValue(null)}>
          <div className="bg-card rounded-2xl shadow-2xl w-[380px]" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-border"><h3 className="font-bold text-foreground text-sm">Confirm Deletion</h3></div>
            <div className="p-5"><p className="text-sm text-muted-foreground">Are you sure you want to delete "{deletingValue.value}"? This action cannot be undone.</p></div>
            <div className="px-5 py-4 border-t border-border flex justify-end gap-2">
              <button onClick={() => setDeletingValue(null)} className="h-8 px-3 text-xs font-semibold rounded-lg border border-border hover:bg-muted cursor-pointer">Cancel</button>
              <button onClick={confirmDelete} className="h-8 px-3 text-xs font-semibold rounded-lg bg-red-600 text-white hover:bg-red-700 cursor-pointer">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function UsersTable() {
  const [users, setUsers] = useState<{ id: number; name: string; email: string; role: string | null }[]>([])
  const [filter, setFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [showNewDialog, setShowNewDialog] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', role: '', user_type: 'Internal', is_tester: false, is_reviewer: false, is_approver: false })
  const [editingUser, setEditingUser] = useState<{ id: number; name: string; email: string; role: string | null } | null>(null)
  const [deletingUser, setDeletingUser] = useState<{ id: number; name: string } | null>(null)

  const fetchUsers = () => {
    setLoading(true)
    fetch('http://localhost:4001/api/users')
      .then((res) => res.json())
      .then(setUsers)
      .catch(() => toast.error('Failed to load users'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchUsers() }, [])

  const filteredUsers = users.filter((u) => u.name.toLowerCase().includes(filter.toLowerCase()) || u.email.toLowerCase().includes(filter.toLowerCase()))

  const handleCreate = async () => {
    if (!form.name.trim() || !form.email.trim()) return
    const res = await fetch('http://localhost:4001/api/users', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
    })
    if (!res.ok) { const d = await res.json(); toast.error(d.error || 'Failed to add user'); return }
    toast.success(`"${form.name}" added`)
    setForm({ name: '', email: '', role: '', user_type: 'Internal', is_tester: false, is_reviewer: false, is_approver: false }); setShowNewDialog(false); fetchUsers()
  }

  const handleSaveEdit = async () => {
    if (!editingUser) return
    const res = await fetch(`http://localhost:4001/api/users/${editingUser.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: editingUser.name, email: editingUser.email, role: editingUser.role }),
    })
    if (!res.ok) { const d = await res.json(); toast.error(d.error || 'Failed to update user'); return }
    toast.success('User updated'); setEditingUser(null); fetchUsers()
  }

  const confirmDelete = async () => {
    if (!deletingUser) return
    await fetch(`http://localhost:4001/api/users/${deletingUser.id}`, { method: 'DELETE' })
    toast.success(`"${deletingUser.name}" removed`); setDeletingUser(null); fetchUsers()
  }

  return (
    <div className="bg-card border border-border rounded-xl shadow-sm p-5 min-h-[420px]">
      <div className="flex items-center justify-between py-2 mb-3">
        <input
          placeholder="Filter users..."
          value={filter} onChange={(e) => setFilter(e.target.value)}
          className="max-w-sm h-9 px-3 text-sm rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-blue-500/30"
        />
        <button onClick={() => setShowNewDialog(true)} className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-md bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 cursor-pointer">
          <Plus className="h-4 w-4" /> New User
        </button>
      </div>
      <div className="rounded-md border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="h-10 px-4 text-left text-xs font-semibold text-muted-foreground uppercase">ID</th>
              <th className="h-10 px-4 text-left text-xs font-semibold text-muted-foreground uppercase">Name</th>
              <th className="h-10 px-4 text-left text-xs font-semibold text-muted-foreground uppercase">Email</th>
              <th className="h-10 px-4 text-left text-xs font-semibold text-muted-foreground uppercase">Role</th>
              <th className="h-10 px-4 text-left text-xs font-semibold text-muted-foreground uppercase">User Type</th>
              <th className="h-10 px-4 text-left text-xs font-semibold text-muted-foreground uppercase">Active Status</th>
              <th className="h-10 px-4 text-right text-xs font-semibold text-muted-foreground uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/30">
            {loading && <tr><td colSpan={7} className="h-24 text-center text-sm text-muted-foreground">Loading…</td></tr>}
            {!loading && filteredUsers.length === 0 && <tr><td colSpan={7} className="h-24 text-center text-sm text-muted-foreground">No users yet.</td></tr>}
            {!loading && filteredUsers.map((u, i) => (
              <tr key={u.id} className="hover:bg-muted/40">
                <td className="px-4 py-2.5 text-xs text-muted-foreground">{i + 1}</td>
                <td className="px-4 py-2.5 font-medium text-foreground">{u.name}</td>
                <td className="px-4 py-2.5 text-muted-foreground">{u.email}</td>
                <td className="px-4 py-2.5 text-muted-foreground">{u.role || '—'}</td>
                <td className="px-4 py-2.5">
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${(u as any).user_type === 'External' ? 'bg-amber-500/10 text-amber-700 border border-amber-500/20' : 'bg-blue-500/10 text-blue-700 border border-blue-500/20'}`}>{(u as any).user_type || 'Internal'}</span>
                </td>
                <td className="px-4 py-2.5">
                  <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-green-500/10 text-green-700 border border-green-500/20">Active</span>
                </td>
                <td className="px-4 py-2.5">
                  <div className="flex items-center justify-end gap-1">
                    <button onClick={() => setEditingUser({ ...u })} className="h-8 w-8 flex items-center justify-center rounded text-blue-500 hover:text-blue-600 hover:bg-blue-50 cursor-pointer"><Pencil className="h-4 w-4" /></button>
                    <button onClick={() => setDeletingUser(u)} className="h-8 w-8 flex items-center justify-center rounded text-red-500 hover:text-red-600 hover:bg-red-50 cursor-pointer"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showNewDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowNewDialog(false)}>
          <div className="bg-card rounded-2xl shadow-2xl w-[400px]" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-border"><h3 className="font-bold text-foreground text-sm">New User</h3></div>
            <div className="p-5 space-y-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Name</label>
                <input autoFocus value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full h-9 px-3 text-sm rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Email</label>
                <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full h-9 px-3 text-sm rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Role</label>
                <input value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} placeholder="e.g. Security Analyst" className="w-full h-9 px-3 text-sm rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">User Type</label>
                <div className="flex gap-2">
                  {(['Internal', 'External'] as const).map((t) => (
                    <button key={t} type="button" onClick={() => setForm({ ...form, user_type: t })} className={`flex-1 h-9 text-sm font-medium rounded-md border cursor-pointer ${form.user_type === t ? 'bg-blue-600 text-white border-blue-600' : 'border-input text-muted-foreground hover:bg-secondary'}`}>{t}</button>
                  ))}
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Assessment Roles</label>
                <div className="flex gap-3">
                  {(['is_tester', 'is_reviewer', 'is_approver'] as const).map((key) => (
                    <label key={key} className="flex items-center gap-1.5 text-xs cursor-pointer">
                      <input type="checkbox" checked={(form as any)[key]} onChange={(e) => setForm({ ...form, [key]: e.target.checked })} className="cursor-pointer" />
                      {key === 'is_tester' ? 'Tester' : key === 'is_reviewer' ? 'Reviewer' : 'Approver'}
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <div className="px-5 py-4 border-t border-border flex justify-end gap-2">
              <button onClick={() => setShowNewDialog(false)} className="h-8 px-3 text-xs font-semibold rounded-lg border border-border hover:bg-muted cursor-pointer">Cancel</button>
              <button onClick={handleCreate} className="h-8 px-3 text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 cursor-pointer">Create</button>
            </div>
          </div>
        </div>
      )}

      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setEditingUser(null)}>
          <div className="bg-card rounded-2xl shadow-2xl w-[400px]" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-border"><h3 className="font-bold text-foreground text-sm">Edit User</h3></div>
            <div className="p-5 space-y-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Name</label>
                <input value={editingUser.name} onChange={(e) => setEditingUser({ ...editingUser, name: e.target.value })} className="w-full h-9 px-3 text-sm rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Email</label>
                <input value={editingUser.email} onChange={(e) => setEditingUser({ ...editingUser, email: e.target.value })} className="w-full h-9 px-3 text-sm rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Role</label>
                <input value={editingUser.role || ''} onChange={(e) => setEditingUser({ ...editingUser, role: e.target.value })} className="w-full h-9 px-3 text-sm rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
              </div>
            </div>
            <div className="px-5 py-4 border-t border-border flex justify-end gap-2">
              <button onClick={() => setEditingUser(null)} className="h-8 px-3 text-xs font-semibold rounded-lg border border-border hover:bg-muted cursor-pointer">Cancel</button>
              <button onClick={handleSaveEdit} className="h-8 px-3 text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 cursor-pointer">Save</button>
            </div>
          </div>
        </div>
      )}

      {deletingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setDeletingUser(null)}>
          <div className="bg-card rounded-2xl shadow-2xl w-[380px]" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-border"><h3 className="font-bold text-foreground text-sm">Confirm Deletion</h3></div>
            <div className="p-5"><p className="text-sm text-muted-foreground">Remove "{deletingUser.name}" from the User Master? This action cannot be undone.</p></div>
            <div className="px-5 py-4 border-t border-border flex justify-end gap-2">
              <button onClick={() => setDeletingUser(null)} className="h-8 px-3 text-xs font-semibold rounded-lg border border-border hover:bg-muted cursor-pointer">Cancel</button>
              <button onClick={confirmDelete} className="h-8 px-3 text-xs font-semibold rounded-lg bg-red-600 text-white hover:bg-red-700 cursor-pointer">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function ApplicationsTable() {
  const [apps, setApps] = useState<any[]>([])
  const [appTypeOptions, setAppTypeOptions] = useState<{ id: number; value: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [showNewDialog, setShowNewDialog] = useState(false)
  const emptyForm = { app_name: '', description: '', app_type: '', primary_owner: '', secondary_owner: '', business_owner: '', technology_owner: '', team_lead: '', team_head: '' }
  const [form, setForm] = useState(emptyForm)
  const [editingApp, setEditingApp] = useState<any | null>(null)
  const [deletingApp, setDeletingApp] = useState<any | null>(null)

  const fetchApps = () => {
    setLoading(true)
    fetch('http://localhost:4001/api/applications').then((r) => r.json()).then(setApps).catch(() => toast.error('Failed to load applications')).finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchApps()
    fetch('http://localhost:4001/api/masters/application_type').then((r) => r.json()).then(setAppTypeOptions).catch(() => {})
  }, [])

  const handleCreate = async () => {
    if (!form.app_name.trim()) return
    const res = await fetch('http://localhost:4001/api/applications', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
    if (!res.ok) { toast.error('Failed to create application'); return }
    toast.success(`"${form.app_name}" added`)
    setForm(emptyForm); setShowNewDialog(false); fetchApps()
  }

  const handleSaveEdit = async () => {
    if (!editingApp) return
    const res = await fetch(`http://localhost:4001/api/applications/${editingApp.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editingApp) })
    if (!res.ok) { toast.error('Failed to update application'); return }
    toast.success('Application updated'); setEditingApp(null); fetchApps()
  }

  const confirmDelete = async () => {
    if (!deletingApp) return
    await fetch(`http://localhost:4001/api/applications/${deletingApp.id}`, { method: 'DELETE' })
    toast.success(`"${deletingApp.app_name}" removed`); setDeletingApp(null); fetchApps()
  }

  return (
    <div className="bg-card border border-border rounded-xl shadow-sm p-5 min-h-[420px]">
      <div className="flex items-center justify-between py-2 mb-3">
        <h3 className="text-sm font-bold text-foreground">Application Master</h3>
        <button onClick={() => setShowNewDialog(true)} className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-md bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 cursor-pointer">
          <Plus className="h-4 w-4" /> New Application
        </button>
      </div>
      <div className="rounded-md border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="h-10 px-4 text-left text-xs font-semibold text-muted-foreground uppercase">App Code</th>
              <th className="h-10 px-4 text-left text-xs font-semibold text-muted-foreground uppercase">Name</th>
              <th className="h-10 px-4 text-left text-xs font-semibold text-muted-foreground uppercase">Type</th>
              <th className="h-10 px-4 text-left text-xs font-semibold text-muted-foreground uppercase">Business Owner</th>
              <th className="h-10 px-4 text-left text-xs font-semibold text-muted-foreground uppercase">Technology Owner</th>
              <th className="h-10 px-4 text-right text-xs font-semibold text-muted-foreground uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/30">
            {loading && <tr><td colSpan={6} className="h-24 text-center text-sm text-muted-foreground">Loading…</td></tr>}
            {!loading && apps.length === 0 && <tr><td colSpan={6} className="h-24 text-center text-sm text-muted-foreground">No applications yet.</td></tr>}
            {!loading && apps.map((a) => (
              <tr key={a.id} className="hover:bg-muted/40">
                <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">{a.app_code}</td>
                <td className="px-4 py-2.5 font-medium text-foreground">{a.app_name}</td>
                <td className="px-4 py-2.5 text-muted-foreground">{a.app_type || '—'}</td>
                <td className="px-4 py-2.5 text-muted-foreground">{a.business_owner || '—'}</td>
                <td className="px-4 py-2.5 text-muted-foreground">{a.technology_owner || '—'}</td>
                <td className="px-4 py-2.5">
                  <div className="flex items-center justify-end gap-1">
                    <button onClick={() => setEditingApp({ ...a })} className="h-8 w-8 flex items-center justify-center rounded text-blue-500 hover:text-blue-600 hover:bg-blue-50 cursor-pointer"><Pencil className="h-4 w-4" /></button>
                    <button onClick={() => setDeletingApp(a)} className="h-8 w-8 flex items-center justify-center rounded text-red-500 hover:text-red-600 hover:bg-red-50 cursor-pointer"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    {showNewDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowNewDialog(false)}>
          <div className="bg-card rounded-2xl shadow-2xl w-[520px] max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-border sticky top-0 bg-card"><h3 className="font-bold text-foreground text-sm">New Application</h3></div>
            <div className="p-5 space-y-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Application Name</label>
                <input autoFocus value={form.app_name} onChange={(e) => setForm({ ...form, app_name: e.target.value })} className="w-full h-9 px-3 text-sm rounded-md border border-input bg-background" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Description</label>
                <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} className="w-full px-3 py-2 text-sm rounded-md border border-input bg-background" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Application Type</label>
                <select value={form.app_type} onChange={(e) => setForm({ ...form, app_type: e.target.value })} className="w-full h-9 px-2 text-sm rounded-md border border-input bg-background">
                  <option value="">— Select —</option>
                  {appTypeOptions.map((t) => <option key={t.id} value={t.value}>{t.value}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {[
                  ['primary_owner', 'Primary Owner'], ['secondary_owner', 'Secondary Owner'],
                  ['business_owner', 'Business Owner'], ['technology_owner', 'Technology Owner'],
                  ['team_lead', 'Team Lead'], ['team_head', 'Team Head'],
                ].map(([key, label]) => (
                  <div key={key} className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground">{label}</label>
                    <input value={(form as any)[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} className="w-full h-9 px-3 text-sm rounded-md border border-input bg-background" />
                  </div>
                ))}
              </div>
            </div>
            <div className="px-5 py-4 border-t border-border flex justify-end gap-2 sticky bottom-0 bg-card">
              <button onClick={() => setShowNewDialog(false)} className="h-8 px-3 text-xs font-semibold rounded-lg border border-border hover:bg-muted cursor-pointer">Cancel</button>
              <button onClick={handleCreate} className="h-8 px-3 text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 cursor-pointer">Create</button>
            </div>
          </div>
        </div>
      )}

      {editingApp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setEditingApp(null)}>
          <div className="bg-card rounded-2xl shadow-2xl w-[520px] max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-border sticky top-0 bg-card"><h3 className="font-bold text-foreground text-sm">Edit Application</h3></div>
            <div className="p-5 space-y-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Application Name</label>
                <input value={editingApp.app_name} onChange={(e) => setEditingApp({ ...editingApp, app_name: e.target.value })} className="w-full h-9 px-3 text-sm rounded-md border border-input bg-background" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Description</label>
                <textarea value={editingApp.description || ''} onChange={(e) => setEditingApp({ ...editingApp, description: e.target.value })} rows={2} className="w-full px-3 py-2 text-sm rounded-md border border-input bg-background" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Application Type</label>
                <select value={editingApp.app_type || ''} onChange={(e) => setEditingApp({ ...editingApp, app_type: e.target.value })} className="w-full h-9 px-2 text-sm rounded-md border border-input bg-background">
                  <option value="">— Select —</option>
                  {appTypeOptions.map((t) => <option key={t.id} value={t.value}>{t.value}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {[
                  ['primary_owner', 'Primary Owner'], ['secondary_owner', 'Secondary Owner'],
                  ['business_owner', 'Business Owner'], ['technology_owner', 'Technology Owner'],
                  ['team_lead', 'Team Lead'], ['team_head', 'Team Head'],
                ].map(([key, label]) => (
                  <div key={key} className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground">{label}</label>
                    <input value={editingApp[key] || ''} onChange={(e) => setEditingApp({ ...editingApp, [key]: e.target.value })} className="w-full h-9 px-3 text-sm rounded-md border border-input bg-background" />
                  </div>
                ))}
              </div>
            </div>
            <div className="px-5 py-4 border-t border-border flex justify-end gap-2 sticky bottom-0 bg-card">
              <button onClick={() => setEditingApp(null)} className="h-8 px-3 text-xs font-semibold rounded-lg border border-border hover:bg-muted cursor-pointer">Cancel</button>
              <button onClick={handleSaveEdit} className="h-8 px-3 text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 cursor-pointer">Save</button>
            </div>
          </div>
        </div>
      )}

      {deletingApp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setDeletingApp(null)}>
          <div className="bg-card rounded-2xl shadow-2xl w-[380px]" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-border"><h3 className="font-bold text-foreground text-sm">Confirm Deletion</h3></div>
            <div className="p-5"><p className="text-sm text-muted-foreground">Remove "{deletingApp.app_name}"? This action cannot be undone.</p></div>
            <div className="px-5 py-4 border-t border-border flex justify-end gap-2">
              <button onClick={() => setDeletingApp(null)} className="h-8 px-3 text-xs font-semibold rounded-lg border border-border hover:bg-muted cursor-pointer">Cancel</button>
              <button onClick={confirmDelete} className="h-8 px-3 text-xs font-semibold rounded-lg bg-red-600 text-white hover:bg-red-700 cursor-pointer">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function MastersSection() {
  const [group, setGroup] = useState<'platform' | 'grc'>('platform')
  const [activeTab, setActiveTab] = useState(MASTER_GROUP_TABS[0])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <button
          onClick={() => setGroup('platform')}
          className={`w-[420px] text-left px-4 py-3 rounded-lg border cursor-pointer transition-colors ${group === 'platform' ? 'bg-blue-600 border-blue-600 text-white' : 'bg-card border-border text-foreground hover:bg-muted/50'}`}
        >
          <div className="flex items-center gap-2 text-sm font-bold whitespace-nowrap"><Database className="h-4 w-4" /> Platform & RBVM</div>
          <div className={`text-xs mt-0.5 ${group === 'platform' ? 'text-blue-100' : 'text-muted-foreground'}`}>Organisation, risk config, assets, tags, members, prioritization rules</div>
        </button>
        <button
          onClick={() => setGroup('grc')}
          className={`w-[420px] text-left px-4 py-3 rounded-lg border cursor-pointer transition-colors ${group === 'grc' ? 'bg-blue-600 border-blue-600 text-white' : 'bg-card border-border text-foreground hover:bg-muted/50'}`}
        >
          <div className="flex items-center gap-2 text-sm font-bold">GRC & Workflow</div>
          <div className={`text-xs mt-0.5 ${group === 'grc' ? 'text-blue-100' : 'text-muted-foreground'}`}>Task/priority/frequency, KPIs, compliance standards, frameworks, templates</div>
        </button>
      </div>

      {group === 'platform' ? (
        <>
          <div>
            <h2 className="text-lg font-bold text-foreground">Masters & Configuration</h2>
            <p className="text-sm text-muted-foreground">Risk rating & quantification · regulatory SLA · asset groups · business units · integrations</p>
          </div>
          <div className="flex flex-wrap gap-1.5 border-b border-border pb-2">
            {MASTER_GROUP_TABS.map((label) => (
              <button
                key={label}
                onClick={() => setActiveTab(label)}
                className={`text-sm font-medium px-3 py-1.5 rounded-md transition-colors cursor-pointer whitespace-nowrap border ${activeTab === label ? 'bg-blue-600 text-white border-blue-600 shadow-sm' : 'bg-muted/50 text-foreground/70 border-border hover:bg-muted hover:text-foreground'}`}
              >
                {label}
              </button>
            ))}
          </div>

          {FUNCTIONAL_TABS.filter((t) => t.label === activeTab).map((t) => <MastersTable key={t.key} masterKey={t.key} label={t.label} />)}
          {activeTab === 'Users & Vendors' && <UsersTable />}
          {activeTab === APP_MASTER_TAB && <ApplicationsTable />}
          {ROADMAP_TABS.includes(activeTab) && <Placeholder label={activeTab} roadmap />}
          {OUT_OF_SCOPE_TABS.filter((t) => t !== 'Users & Vendors').includes(activeTab) && <Placeholder label={activeTab} roadmap={false} />}
        </>
      ) : (
        <Placeholder label="GRC & Workflow Masters" roadmap={false} />
      )}
    </div>
  )
}

export function AdminMasters() {
  const [topTab, setTopTab] = useState('Masters')

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-xl font-bold text-foreground">CTEM Admin & Settings</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Unified platform settings, risk configuration, and master data management for RBVM.</p>
      </div>

      <div className="flex flex-wrap gap-1.5 border-b border-border pb-2">
        {TOP_TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTopTab(t)}
            className={`text-sm font-medium px-3 py-1.5 rounded-md transition-colors cursor-pointer whitespace-nowrap border ${topTab === t ? 'bg-blue-600 text-white border-blue-600 shadow-sm' : 'bg-muted/50 text-foreground/70 border-border hover:bg-muted hover:text-foreground'}`}
          >
            {t}
          </button>
        ))}
      </div>

      {topTab === 'Masters' ? <MastersSection /> : <Placeholder label={topTab} roadmap={false} />}
    </div>
  )
}