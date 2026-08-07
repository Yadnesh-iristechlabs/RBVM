import { useState, useEffect } from 'react'
import { Eye, X, Pencil } from 'lucide-react'

interface AppRow {
  id: number
  app_code: string
  app_name: string
  app_type: string | null
  business_owner: string | null
  technology_owner: string | null
  created_at: string
  assetCount: number
  riskScore: number
}

export function ApplicationsView() {
  const [rows, setRows] = useState<AppRow[]>([])
  const [loading, setLoading] = useState(true)
  const [viewingApp, setViewingApp] = useState<AppRow | null>(null)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const [appsRes, assetsRes] = await Promise.all([
          fetch('/api/applications').then((r) => r.json()),
          fetch('/api/assets').then((r) => r.json()),
        ])
        const enriched = appsRes.map((a: any) => {
          const linkedAssets = assetsRes.filter((as: any) => as.application_id === a.id)
          return { ...a, assetCount: linkedAssets.length, linkedAssets }
        })
        setRows(enriched)
      } catch (err) {
        console.error('failed to load applications view', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  if (loading) return <div className="bg-card border border-border rounded-xl p-8 text-center text-sm text-muted-foreground">Loading applications…</div>

  if (rows.length === 0) {
    return (
      <div className="bg-card border border-border rounded-xl p-8 text-center">
        <p className="text-sm font-medium text-foreground">No applications registered yet</p>
        <p className="text-sm text-muted-foreground mt-1">Add applications via Admin → Masters → Applications</p>
      </div>
    )
  }

  return (
    <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="h-11 px-4 text-left text-xs font-semibold text-muted-foreground uppercase">App Code</th>
              <th className="h-11 px-4 text-left text-xs font-semibold text-muted-foreground uppercase">Application Name</th>
              <th className="h-11 px-4 text-left text-xs font-semibold text-muted-foreground uppercase">Type</th>
              <th className="h-11 px-4 text-left text-xs font-semibold text-muted-foreground uppercase">Business Owner</th>
              <th className="h-11 px-4 text-left text-xs font-semibold text-muted-foreground uppercase">Technology Owner</th>
              <th className="h-11 px-4 text-left text-xs font-semibold text-muted-foreground uppercase">Assessments</th>
              <th className="h-11 px-4 text-left text-xs font-semibold text-muted-foreground uppercase">Last Assessment</th>
              <th className="h-11 px-4 text-left text-xs font-semibold text-muted-foreground uppercase">Linked Assets</th>
              <th className="h-11 px-4 text-right text-xs font-semibold text-muted-foreground uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/30">
            {rows.map((a) => (
              <tr key={a.id} className="hover:bg-muted/40">
                <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{a.app_code}</td>
                <td className="px-4 py-3 font-semibold text-foreground">{a.app_name}</td>
                <td className="px-4 py-3 text-muted-foreground">{a.app_type || '—'}</td>
                <td className="px-4 py-3 text-muted-foreground">{a.business_owner || '—'}</td>
                <td className="px-4 py-3 text-muted-foreground">{a.technology_owner || '—'}</td>
                <td className="px-4 py-3 text-muted-foreground">— <span className="text-[10px] italic">(not yet built)</span></td>
                <td className="px-4 py-3 text-muted-foreground">— <span className="text-[10px] italic">(not yet built)</span></td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-blue-500/10 text-blue-700 border border-blue-500/20">{a.assetCount} asset{a.assetCount !== 1 ? 's' : ''}</span>
                </td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => setViewingApp(a)} className="h-8 w-8 inline-flex items-center justify-center rounded text-muted-foreground hover:text-blue-600 hover:bg-blue-50 cursor-pointer"><Eye className="h-4 w-4" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {viewingApp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setViewingApp(null)}>
          <div className="bg-card rounded-2xl shadow-2xl w-[500px] max-w-full max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-border flex items-center justify-between sticky top-0 bg-card">
              <div>
                <h3 className="font-bold text-foreground text-sm">{viewingApp.app_name}</h3>
                <p className="text-xs text-muted-foreground font-mono">{viewingApp.app_code}</p>
              </div>
              <button onClick={() => setViewingApp(null)} className="text-muted-foreground hover:text-foreground cursor-pointer"><X className="h-4 w-4" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <div className="text-[10px] font-semibold text-muted-foreground uppercase mb-1">Description</div>
                <p className="text-sm text-foreground">{(viewingApp as any).description || '—'}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-[10px] font-semibold text-muted-foreground uppercase mb-1">Application Type</div>
                  <p className="text-sm text-foreground">{viewingApp.app_type || '—'}</p>
                </div>
                <div>
                  <div className="text-[10px] font-semibold text-muted-foreground uppercase mb-1">Registered On</div>
                  <p className="text-sm text-foreground">{new Date(viewingApp.created_at).toLocaleDateString()}</p>
                </div>
                <div>
                  <div className="text-[10px] font-semibold text-muted-foreground uppercase mb-1">Primary Owner</div>
                  <p className="text-sm text-foreground">{(viewingApp as any).primary_owner || '—'}</p>
                </div>
                <div>
                  <div className="text-[10px] font-semibold text-muted-foreground uppercase mb-1">Secondary Owner</div>
                  <p className="text-sm text-foreground">{(viewingApp as any).secondary_owner || '—'}</p>
                </div>
                <div>
                  <div className="text-[10px] font-semibold text-muted-foreground uppercase mb-1">Business Owner</div>
                  <p className="text-sm text-foreground">{viewingApp.business_owner || '—'}</p>
                </div>
                <div>
                  <div className="text-[10px] font-semibold text-muted-foreground uppercase mb-1">Technology Owner</div>
                  <p className="text-sm text-foreground">{viewingApp.technology_owner || '—'}</p>
                </div>
                <div>
                  <div className="text-[10px] font-semibold text-muted-foreground uppercase mb-1">Team Lead</div>
                  <p className="text-sm text-foreground">{(viewingApp as any).team_lead || '—'}</p>
                </div>
                <div>
                  <div className="text-[10px] font-semibold text-muted-foreground uppercase mb-1">Team Head</div>
                  <p className="text-sm text-foreground">{(viewingApp as any).team_head || '—'}</p>
                </div>
              </div>
              <div>
                <div className="text-[10px] font-semibold text-muted-foreground uppercase mb-2">Linked Assets ({viewingApp.assetCount})</div>
                {(viewingApp as any).linkedAssets?.length > 0 ? (
                  <div className="space-y-1.5">
                    {(viewingApp as any).linkedAssets.map((a: any) => (
                      <div key={a.id} className="flex items-center justify-between px-3 py-2 rounded-md border border-border text-sm">
                        <span className="text-foreground">{a.hostname}</span>
                        <span className="text-xs text-muted-foreground font-mono">{a.asset_code || '—'}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No assets currently linked to this application.</p>
                )}
              </div>
            </div>
            <div className="px-5 py-4 border-t border-border flex justify-end">
              <button onClick={() => setViewingApp(null)} className="h-9 px-4 text-sm font-semibold rounded-lg border border-border hover:bg-muted/50 cursor-pointer">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}