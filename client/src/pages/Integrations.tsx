import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { Bug, CheckCircle, RefreshCw, Search, Plus, Trash2, Key, Code, Settings, Plug } from 'lucide-react'

const API_ENDPOINTS = [
  { m: 'GET', p: '/api/assets', d: 'List all assets' },
  { m: 'GET', p: '/api/assets/:id', d: 'Get a single asset' },
  { m: 'POST', p: '/api/assets', d: 'Create an asset' },
  { m: 'PUT', p: '/api/assets/:id', d: 'Update an asset' },
  { m: 'DELETE', p: '/api/assets/:id', d: 'Delete an asset' },
  { m: 'POST', p: '/api/import/validate', d: 'Validate a CSV import' },
  { m: 'POST', p: '/api/import/commit', d: 'Commit a validated import' },
  { m: 'POST', p: '/api/qualys/sync', d: 'Run Qualys mock sync' },
]

type Tab = 'catalog' | 'keys' | 'api'

export function Integrations() {
  const [tab, setTab] = useState<Tab>('catalog')
  const [search, setSearch] = useState('')
  const [connected, setConnected] = useState(false)
  const [loadingConfig, setLoadingConfig] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [lastSync, setLastSync] = useState<string | null>(null)
  const [manageOpen, setManageOpen] = useState(false)
  const [addIntegrationOpen, setAddIntegrationOpen] = useState(false)
  const [newIntegrationName, setNewIntegrationName] = useState('Tenable Nessus')
  const [otherIntegrations, setOtherIntegrations] = useState<{ name: string; connected: boolean }[]>([])
  const [allConnectors, setAllConnectors] = useState<any[]>([])
  const [connectorStatus, setConnectorStatus] = useState<Record<string, boolean>>({})
  const [manageConnector, setManageConnector] = useState<string | null>(null)
  const [genTestStatus, setGenTestStatus] = useState<'idle' | 'success' | 'fail'>('idle')
  const [genTestMsg, setGenTestMsg] = useState('')
  const [genEndpoint, setGenEndpoint] = useState('')
  const [genUsername, setGenUsername] = useState('')
  const [genPassword, setGenPassword] = useState('')
  const [genAccessKey, setGenAccessKey] = useState('')
  const [genSecretKey, setGenSecretKey] = useState('')
  const [genSyncing, setGenSyncing] = useState<string | null>(null)

  const fetchConnectors = () => {
    fetch('/api/connectors').then((r) => r.json()).then(setAllConnectors).catch(() => {})
    fetch('/api/integrations').then((r) => r.json()).then((data: any[]) => {
      const status: Record<string, boolean> = {}
      data.forEach((d) => { status[d.name] = d.connected })
      setConnectorStatus(status)
    }).catch(() => {})
  }

  useEffect(() => { fetchConnectors() }, [])

  const buildConnectPayload = () => {
    if (manageConnector === 'tenable') {
      return { endpoint: 'https://cloud.tenable.com', extra_fields: { access_key: genAccessKey, secret_key: genSecretKey } }
    }
    return { endpoint: genEndpoint, username: genUsername, password: genPassword }
  }

  const genTestConnection = async () => {
    if (!manageConnector) return
    if (manageConnector === 'tenable' && (!genAccessKey.trim() || !genSecretKey.trim())) {
      setGenTestStatus('fail')
      setGenTestMsg('Access Key and Secret Key are required')
      return
    }
    try {
      const res = await fetch(`/api/connectors/${manageConnector}/test`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildConnectPayload()),
      })
      const data = await res.json()
      setGenTestStatus(data.success ? 'success' : 'fail')
      setGenTestMsg(data.message)
    } catch {
      setGenTestStatus('fail')
      setGenTestMsg('Connection test failed')
    }
  }

  const genSaveConnect = async () => {
    if (!manageConnector) return
    await fetch(`/api/integrations/${manageConnector}/connect`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildConnectPayload()),
    })
    toast.success(`${manageConnector} connected`)
    setManageConnector(null)
    setGenTestStatus('idle')
    fetchConnectors()
  }

  const genSync = async (name: string) => {
    setGenSyncing(name)
    try {
      const res = await fetch(`/api/connectors/${name}/sync`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error || 'Sync failed'); return }
      toast.success(data.details || `Sync complete — ${data.assetsFound} assets found`)
      fetchConnectors()
    } catch {
      toast.error('Sync failed')
    } finally {
      setGenSyncing(null)
    }
  }

  const fetchOtherIntegrations = () => {
    fetch('/api/integrations')
      .then((res) => res.json())
      .then((data) => setOtherIntegrations(data.filter((i: any) => i.name !== 'qualys')))
      .catch(() => {})
  }

  useEffect(() => {
    fetchOtherIntegrations()
  }, [])
  const [configUserId, setConfigUserId] = useState('')
  const [configPassword, setConfigPassword] = useState('')
  const [configValue, setConfigValue] = useState('')
  const [testMsg, setTestMsg] = useState('')
  const [testStatus, setTestStatus] = useState<'idle' | 'success' | 'fail'>('idle')

  useEffect(() => {
    fetch('/api/integrations/qualys')
      .then((res) => res.json())
      .then((data) => {
        setConnected(!!data.connected)
        if (data.endpoint) setConfigValue(data.endpoint)
        if (data.username) setConfigUserId(data.username)
      })
      .catch((err) => console.error('failed to load integration config', err))
      .finally(() => setLoadingConfig(false))
  }, [])
  const [keys, setKeys] = useState<{ id: number; name: string; key: string; created: string }[]>([
    { id: 1, name: 'Local Dev', key: 'rbvm_sk_••••••••demo01', created: new Date().toLocaleDateString() },
  ])
  const [newKeyName, setNewKeyName] = useState('')

  const runSync = async () => {
    if (!connected) {
      toast.error('Connect to Qualys VMDR before syncing')
      return
    }
    setSyncing(true)
    try {
      const res = await fetch('/api/qualys/sync', { method: 'POST' })
      const data = await res.json()
      setLastSync(new Date().toLocaleString())
      toast.success(data.synced > 0 ? `Sync complete — ${data.synced} new assets added` : 'Sync complete — no new assets found')
    } catch (err) {
      console.error(err)
      toast.error('Sync failed')
    } finally {
      setSyncing(false)
    }
  }

  const addKey = () => {
    if (!newKeyName.trim()) return
    setKeys((prev) => [...prev, { id: Date.now(), name: newKeyName, key: `rbvm_sk_${Math.random().toString(36).slice(2, 10)}`, created: new Date().toLocaleDateString() }])
    setNewKeyName('')
  }

  const matches = 'qualys vmdr'.includes(search.toLowerCase()) || search === ''

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Integrations</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Connect RBVM to your security scanning stack</p>
      </div>

      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Integrations', value: 1, cls: 'bg-blue-50 border-blue-200 text-blue-600' },
          { label: 'Connected', value: connected ? 1 : 0, cls: 'bg-green-50 border-green-200 text-green-600' },
          { label: 'Categories', value: 1, cls: 'bg-purple-50 border-purple-200 text-purple-600' },
          { label: 'API Keys', value: keys.length, cls: 'bg-amber-50 border-amber-200 text-amber-600' },
        ].map((k) => {
          const [bg, text] = [k.cls.split(' ').slice(0, 2).join(' '), k.cls.split(' ')[2]]
          return (
            <div key={k.label} className={`rounded-xl border ${bg} p-4 flex flex-col gap-2 shadow-sm`}>
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{k.label}</span>
              <span className={`text-3xl font-black ${text}`}>{k.value}</span>
            </div>
          )
        })}
      </div>

      <div className="flex items-center justify-between border-b border-border">
        <div className="flex gap-1">
        {([['catalog', 'Catalog'], ['keys', 'API Keys'], ['api', 'API & Webhooks']] as const).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id as Tab)}
            className={`pb-2.5 px-4 text-sm font-semibold border-b-2 transition-colors ${tab === id ? 'border-blue-500 text-blue-600' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
          >
            {label}
          </button>
        ))}
        </div>
        {tab === 'catalog' && (
          <button onClick={() => setAddIntegrationOpen(true)} className="mb-2 flex items-center gap-1.5 h-8 px-3 text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700">
            <Plus className="h-3.5 w-3.5" /> Add Integration
          </button>
        )}
      </div>

      {tab === 'catalog' && (
        <>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative flex-1 min-w-[260px] max-w-md">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search integrations..."
                className="w-full h-9 pl-8 pr-3 text-sm border border-border/60 rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
              />
            </div>
            <span className="ml-auto text-sm text-muted-foreground">{matches ? 1 : 0} of 1</span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button className="inline-flex items-center gap-2 h-8 px-3 text-xs font-semibold rounded-full border bg-blue-600 text-white border-blue-600">
              Vulnerability Scanners
              <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold bg-white/20 text-white">1</span>
            </button>
          </div>

          <div className="grid grid-cols-3 gap-4">
            {allConnectors.filter((c) => c.name !== 'qualys').map((c) => {
              const connected = connectorStatus[c.name]
              return (
                <div key={c.name} className="rounded-xl border border-border bg-card shadow-sm p-4 flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                        <Plug className="h-4 w-4 text-foreground/70" />
                      </div>
                      <div className="min-w-0">
                        <span className="text-sm font-bold text-foreground leading-snug block truncate">{c.display_name}</span>
                        <span className="text-[10px] text-muted-foreground">{c.category}</span>
                      </div>
                    </div>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${connected ? 'bg-green-50 text-green-700 border-green-200' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                      {connected ? 'Connected' : 'Not Connected'}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed flex-1">{c.description}</p>
                  <div className="flex gap-2">
                    {connected ? (
                      <button onClick={() => genSync(c.name)} disabled={genSyncing === c.name} className="flex-1 h-8 text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60 cursor-pointer">
                        {genSyncing === c.name ? 'Syncing…' : 'Sync Now'}
                      </button>
                    ) : (
                      <button onClick={() => { setManageConnector(c.name); setGenEndpoint(''); setGenUsername(''); setGenPassword(''); setGenAccessKey(''); setGenSecretKey(''); setGenTestStatus('idle') }} className="flex-1 h-8 text-xs font-semibold rounded-lg border border-border hover:bg-muted cursor-pointer">
                        Connect
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
            {matches && (
              <div className="rounded-xl border border-border bg-card shadow-sm p-4 flex flex-col gap-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                      <Bug className="h-4 w-4 text-foreground/70" />
                    </div>
                    <span className="text-sm font-bold text-foreground leading-snug">Qualys VMDR</span>
                  </div>
                  {connected && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-green-500/10 text-green-700 border border-green-500/20">
                      <CheckCircle className="h-3 w-3" /> Connected
                    </span>
                  )}
                </div>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full self-start bg-red-100 text-red-700">Vulnerability Scanners</span>
                <p className="text-xs text-muted-foreground leading-relaxed flex-1">
                  Qualys VMDR — authenticated host & infrastructure VM. Import QID/CVE findings.
                </p>
                {lastSync && <p className="text-xs text-muted-foreground">Last sync: {lastSync}</p>}
                <button
                  onClick={runSync}
                  disabled={syncing}
                  className="inline-flex items-center justify-center gap-1.5 h-8 text-xs font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${syncing ? 'animate-spin' : ''}`} />
                  {syncing ? 'Syncing…' : 'Mock API Sync'}
                </button>
                <div className="flex gap-2">
                  {connected ? (
                    <>
                      <button onClick={() => setManageOpen(true)} className="flex-1 h-8 text-xs font-semibold rounded-lg border border-border text-foreground/80 hover:bg-muted">Manage</button>
                      <button
                        onClick={async () => {
                          try {
                            await fetch('/api/integrations/qualys/disconnect', { method: 'POST' })
                            setConnected(false)
                            toast.success('Disconnected from Qualys VMDR')
                          } catch (err) {
                            toast.error('Failed to disconnect')
                          }
                        }}
                        className="h-8 px-3 text-xs font-semibold rounded-lg border border-border text-red-600 hover:bg-red-50"
                      >
                        Disconnect
                      </button>
                    </>
                  ) : (
                    <button onClick={() => setManageOpen(true)} className="flex-1 h-8 text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700">Connect</button>
                  )}
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {manageOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40" onClick={() => setManageOpen(false)}>
          <div className="bg-card rounded-2xl shadow-2xl w-[440px] max-w-full" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-border flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Settings className="h-4 w-4 text-blue-600" />
                <h3 className="font-bold text-foreground text-sm">Configure Qualys VMDR</h3>
              </div>
              {testStatus !== 'idle' && (
                <span className="flex items-center gap-1.5">
                  <span className={`w-2.5 h-2.5 rounded-full ${testStatus === 'success' ? 'bg-green-500' : 'bg-red-500'}`} />
                  <span className={`text-[11px] font-semibold ${testStatus === 'success' ? 'text-green-600' : 'text-red-600'}`}>
                    {testStatus === 'success' ? 'Successfully connected' : 'Connection failed'}
                  </span>
                </span>
              )}
            </div>
            <div className="p-5 space-y-3">
              <p className="text-xs text-muted-foreground">
                Qualys VMDR — authenticated host & infrastructure VM. Import QID/CVE findings.
              </p>
              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">Endpoint / API URL</label>
                <input
                  value={configValue}
                  onChange={(e) => { setConfigValue(e.target.value); setTestStatus('idle') }}
                  placeholder="https://qualysapi.qg1.apps.qualys.in"
                  className="w-full h-9 px-3 text-sm rounded-md border border-border/60 bg-background focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">User ID</label>
                <input
                  value={configUserId}
                  onChange={(e) => { setConfigUserId(e.target.value); setTestStatus('idle') }}
                  placeholder="Qualys username"
                  className="w-full h-9 px-3 text-sm rounded-md border border-border/60 bg-background focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">Password</label>
                <input
                  type="password"
                  value={configPassword}
                  onChange={(e) => { setConfigPassword(e.target.value); setTestStatus('idle') }}
                  placeholder="••••••••"
                  className="w-full h-9 px-3 text-sm rounded-md border border-border/60 bg-background focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                />
              </div>
              <button
                onClick={async () => {
                  if (!/^https?:\/\/.+/.test(configValue.trim())) {
                    setTestStatus('fail')
                    setTestMsg('Endpoint must be a valid URL (e.g. https://qualysapi.qg1.apps.qualys.in)')
                    return
                  }
                  if (!configUserId.trim() || !configPassword.trim()) {
                    setTestStatus('fail')
                    setTestMsg('User ID and password are required')
                    return
                  }
                  setTestStatus('success')
                  setTestMsg('Test to Qualys VMDR succeeded ✓')
                }}
                className="h-8 px-3 text-xs font-semibold rounded-md border border-border text-foreground/80 hover:bg-muted"
              >
                Test Connection
              </button>
              {testMsg && (
                <p className={`text-xs ${testStatus === 'success' ? 'text-green-600' : testStatus === 'fail' ? 'text-red-600' : 'text-muted-foreground'}`}>{testMsg}</p>
              )}
            </div>
            <div className="px-5 py-4 border-t border-border flex justify-end gap-2">
              <button onClick={() => setManageOpen(false)} className="h-9 px-4 text-sm font-semibold rounded-lg border border-border hover:bg-muted/50">Cancel</button>
              <button
                disabled={testStatus !== 'success'}
                onClick={async () => {
                  try {
                    const res = await fetch('/api/integrations/qualys/connect', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ endpoint: configValue, username: configUserId, password: configPassword }),
                    })
                    if (!res.ok) throw new Error('connect failed')
                    setConnected(true)
                    setManageOpen(false)
                    setTestMsg('')
                    setTestStatus('idle')
                    toast.success('Qualys VMDR connected')
                  } catch (err) {
                    console.error(err)
                    toast.error('Failed to save connection')
                  }
                }}
                className="h-9 px-4 text-sm font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:bg-muted disabled:text-muted-foreground disabled:cursor-not-allowed"
              >
                Save &amp; Connect
              </button>
            </div>
          </div>
        </div>
      )}

      {tab === 'keys' && (
        <div className="space-y-4">
          <div className="flex items-end gap-2">
            <div className="flex-1 max-w-sm">
              <label className="text-xs font-semibold text-muted-foreground block mb-1">New key name</label>
              <input
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                placeholder="e.g. CI/CD pipeline"
                className="w-full h-9 px-3 text-sm rounded-md border border-border/60 bg-background focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              />
            </div>
            <button onClick={addKey} className="flex items-center gap-1.5 h-9 px-4 text-sm rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700">
              <Plus className="h-3.5 w-3.5" /> Generate Key
            </button>
          </div>
          <div className="bg-card border border-border shadow-sm overflow-hidden rounded-xl">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/40 bg-muted/30">
                  {['Name', 'Key', 'Created', ''].map((h) => (
                    <th key={h} className="h-11 px-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {keys.map((k) => (
                  <tr key={k.id} className="hover:bg-muted/50">
                    <td className="px-4 py-3 text-sm font-semibold text-foreground">
                      <span className="inline-flex items-center gap-2"><Key className="h-3.5 w-3.5 text-muted-foreground" />{k.name}</span>
                    </td>
                    <td className="px-4 py-3 text-sm font-mono text-muted-foreground">{k.key}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{k.created}</td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => setKeys((prev) => prev.filter((x) => x.id !== k.id))} className="inline-flex items-center gap-1 px-2.5 h-7 rounded-md text-xs font-semibold text-red-600 hover:bg-red-50">
                        <Trash2 className="h-3.5 w-3.5" /> Revoke
                      </button>
                    </td>
                  </tr>
                ))}
                {keys.length === 0 && <tr><td colSpan={4} className="py-10 text-center text-sm text-muted-foreground">No API keys.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {addIntegrationOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40" onClick={() => setAddIntegrationOpen(false)}>
          <div className="bg-card rounded-2xl shadow-2xl w-[420px] max-w-full" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-border flex items-center gap-2">
              <Plus className="h-4 w-4 text-blue-600" />
              <h3 className="font-bold text-foreground text-sm">Add Integration</h3>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">Scanner / Tool</label>
                <select value={newIntegrationName} onChange={(e) => setNewIntegrationName(e.target.value)} className="w-full h-9 px-2 text-sm rounded-md border border-border/60 bg-background">
                  <option>Tenable Nessus</option>
                  <option>Rapid7 InsightVM</option>
                  <option>ServiceNow CMDB</option>
                  <option>Custom CMDB Connector</option>
                  <option>OpenText</option>
                  <option>Burp Suite</option>
                  <option>Fortify</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      )}

      {manageConnector && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40" onClick={() => setManageConnector(null)}>
          <div className="bg-card rounded-2xl shadow-2xl w-[440px] max-w-full" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-border flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Settings className="h-4 w-4 text-blue-600" />
                <h3 className="font-bold text-foreground text-sm">Configure {allConnectors.find((c) => c.name === manageConnector)?.display_name}</h3>
              </div>
              {genTestStatus !== 'idle' && (
                <span className="flex items-center gap-1.5">
                  <span className={`w-2.5 h-2.5 rounded-full ${genTestStatus === 'success' ? 'bg-green-500' : 'bg-red-500'}`} />
                  <span className={`text-[11px] font-semibold ${genTestStatus === 'success' ? 'text-green-600' : 'text-red-600'}`}>
                    {genTestStatus === 'success' ? 'Successfully connected' : 'Connection failed'}
                  </span>
                </span>
              )}
            </div>
            <div className="p-5 space-y-3">
              <p className="text-xs text-muted-foreground">
                {allConnectors.find((c) => c.name === manageConnector)?.description}
              </p>
              {manageConnector === 'qualys' && (
                <p className="text-[11px] text-blue-600 bg-blue-50 border border-blue-100 rounded-md px-2.5 py-1.5">
                  Output format: XML (native, matches HOST_LIST_VM_DETECTION_OUTPUT DTD) or JSON
                </p>
              )}
              {manageConnector === 'tenable' && (
                <p className="text-[11px] text-blue-600 bg-blue-50 border border-blue-100 rounded-md px-2.5 py-1.5">
                  Output format: .nessus (native XML format) or CSV export
                </p>
              )}
              {manageConnector === 'tenable' ? (
                <>
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground block mb-1">Tenable API Base URL</label>
                    <input
                      value="https://cloud.tenable.com"
                      readOnly
                      className="w-full h-9 px-3 text-sm rounded-md border border-border/60 bg-muted text-muted-foreground cursor-not-allowed"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground block mb-1">Access Key</label>
                    <input
                      value={genAccessKey}
                      onChange={(e) => { setGenAccessKey(e.target.value); setGenTestStatus('idle') }}
                      placeholder="Enter Tenable access key"
                      className="w-full h-9 px-3 text-sm rounded-md border border-border/60 bg-background focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground block mb-1">Secret Key</label>
                    <input
                      type="password"
                      value={genSecretKey}
                      onChange={(e) => { setGenSecretKey(e.target.value); setGenTestStatus('idle') }}
                      placeholder="Enter Tenable secret key"
                      className="w-full h-9 px-3 text-sm rounded-md border border-border/60 bg-background focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                    />
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground block mb-1">Endpoint / API URL</label>
                    <input
                      value={genEndpoint}
                      onChange={(e) => { setGenEndpoint(e.target.value); setGenTestStatus('idle') }}
                      placeholder="https://..."
                      className="w-full h-9 px-3 text-sm rounded-md border border-border/60 bg-background focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground block mb-1">User ID</label>
                    <input
                      value={genUsername}
                      onChange={(e) => { setGenUsername(e.target.value); setGenTestStatus('idle') }}
                      placeholder="Username"
                      className="w-full h-9 px-3 text-sm rounded-md border border-border/60 bg-background focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground block mb-1">Password</label>
                    <input
                      type="password"
                      value={genPassword}
                      onChange={(e) => { setGenPassword(e.target.value); setGenTestStatus('idle') }}
                      placeholder="••••••••"
                      className="w-full h-9 px-3 text-sm rounded-md border border-border/60 bg-background focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                    />
                  </div>
                </>
              )}
              <button
                onClick={genTestConnection}
                className="h-8 px-3 text-xs font-semibold rounded-md border border-border text-foreground/80 hover:bg-muted cursor-pointer"
              >
                Test Connection
              </button>
              {genTestMsg && (
                <p className={`text-xs ${genTestStatus === 'success' ? 'text-green-600' : genTestStatus === 'fail' ? 'text-red-600' : 'text-muted-foreground'}`}>{genTestMsg}</p>
              )}
            </div>
            <div className="px-5 py-4 border-t border-border flex justify-end gap-2">
              <button onClick={() => setManageConnector(null)} className="h-9 px-4 text-sm font-semibold rounded-lg border border-border hover:bg-muted/50 cursor-pointer">Cancel</button>
              <button onClick={genSaveConnect} disabled={genTestStatus !== 'success'} className="h-9 px-4 text-sm font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:bg-muted disabled:text-muted-foreground disabled:cursor-not-allowed cursor-pointer">Save & Connect</button>
            </div>
          </div>
        </div>
      )}

      {tab === 'api' && (
        <div className="bg-card border border-border shadow-sm overflow-hidden rounded-xl">
          <div className="px-4 py-3 border-b border-border/40 bg-muted/30 text-sm font-bold text-foreground/80 flex items-center gap-2">
            <Code className="h-4 w-4" /> REST API
          </div>
          <table className="w-full text-sm">
            <tbody className="divide-y divide-border/30">
              {API_ENDPOINTS.map((e) => (
                <tr key={e.m + e.p} className="hover:bg-muted/50">
                  <td className="px-4 py-2.5 w-16">
                    <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${e.m === 'GET' ? 'bg-green-100 text-green-700' : e.m === 'POST' ? 'bg-blue-100 text-blue-700' : e.m === 'PUT' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>{e.m}</span>
                  </td>
                  <td className="px-2 py-2.5 font-mono text-xs text-foreground">{e.p}</td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground">{e.d}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-4 py-3 border-t border-border/40 bg-muted/20 text-xs text-muted-foreground">
            Base URL <span className="font-mono text-foreground/80"></span>
          </div>
        </div>
      )}
    </div>
  )
}