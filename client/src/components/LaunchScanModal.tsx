import { useState } from 'react'
import { toast } from 'sonner'

const SCAN_TYPES = ['Network', 'Web Application', 'Cloud', 'Container', 'Compliance', 'Discovery']
const OPTION_PROFILES = ['Full Vulnerability Scan', 'External Vulnerability Scan', 'OWASP Top 10 Scan', 'SEBI CSCRF Compliance Profile']
const SCANNERS = ['On-Prem Scanner 01', 'Cloud Scanner 01']
const ASSET_GROUPS = ['Web Servers', 'Database Servers', 'Firewalls', 'Kubernetes Cluster']

import { useEffect } from 'react'

export function LaunchScanModal({ onClose, onScheduled }: { onClose: () => void; onScheduled?: (title: string) => void }) {
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  const [form, setForm] = useState({
    title: '',
    type: 'Network',
    profile: OPTION_PROFILES[0],
    scanner: SCANNERS[0],
    targets: '',
    assetGroup: '',
    owner: '',
    notify: '',
  })

  const launch = () => {
    if (!form.title.trim()) {
      toast.error('Scan title is required')
      return
    }
    console.log('launching scan', form)
    onScheduled?.(form.title)
    toast.success(`"${form.title}" scheduled — this is a demo placeholder, no real scan runs`)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-card rounded-2xl shadow-2xl w-[560px] max-h-[85vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-border bg-muted/50 flex items-center justify-between rounded-t-2xl">
          <h3 className="font-black text-foreground">Launch Vulnerability Scan</h3>
          <button onClick={onClose} className="text-muted-foreground/70 hover:text-foreground/80 text-xl leading-none">×</button>
        </div>
        <div className="p-6 space-y-5">
          <div>
            <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-4">General Information</div>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-foreground/80 block mb-1">Scan Title *</label>
                <input
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  className="w-full h-9 px-3 text-sm rounded-md border border-border/60 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                  placeholder="Enter scan name"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-foreground/80 block mb-1">Scan Type</label>
                  <select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))} className="w-full h-9 px-2 text-sm rounded-md border border-border/60 bg-white focus:outline-none">
                    {SCAN_TYPES.map((t) => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-foreground/80 block mb-1">Option Profile *</label>
                  <select value={form.profile} onChange={(e) => setForm((f) => ({ ...f, profile: e.target.value }))} className="w-full h-9 px-2 text-sm rounded-md border border-border/60 bg-white focus:outline-none">
                    {OPTION_PROFILES.map((p) => <option key={p}>{p}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-foreground/80 block mb-1">Scanner Appliance</label>
                <select value={form.scanner} onChange={(e) => setForm((f) => ({ ...f, scanner: e.target.value }))} className="w-full h-9 px-2 text-sm rounded-md border border-border/60 bg-white focus:outline-none">
                  {SCANNERS.map((s) => <option key={s}>{s}</option>)}
                </select>
              </div>
            </div>
          </div>

          <div>
            <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-4">Choose Target Hosts</div>
            <div className="space-y-2">
              <label className="text-xs font-semibold text-foreground/80 block mb-1">IP Addresses / Ranges</label>
              <input
                value={form.targets}
                onChange={(e) => setForm((f) => ({ ...f, targets: e.target.value }))}
                className="w-full h-9 px-3 text-sm rounded-md border border-border/60 bg-white focus:outline-none"
                placeholder="e.g. 192.168.1.1-192.168.1.100, 10.0.0.0/24"
              />
              <label className="text-xs font-semibold text-foreground/80 block mb-1 mt-2">Asset Group</label>
              <select value={form.assetGroup} onChange={(e) => setForm((f) => ({ ...f, assetGroup: e.target.value }))} className="w-full h-9 px-2 text-sm rounded-md border border-border/60 bg-white focus:outline-none">
                <option value="">Select items…</option>
                {ASSET_GROUPS.map((g) => <option key={g}>{g}</option>)}
              </select>
            </div>
          </div>

          <div>
            <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-4">Assign &amp; Notify</div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-foreground/80 block mb-1">Scan owner</label>
                <input
                  value={form.owner}
                  onChange={(e) => setForm((f) => ({ ...f, owner: e.target.value }))}
                  className="w-full h-9 px-3 text-sm rounded-md border border-border/60 bg-white focus:outline-none"
                  placeholder="Assign scan owner…"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-foreground/80 block mb-1">Notify on complete</label>
                <input
                  value={form.notify}
                  onChange={(e) => setForm((f) => ({ ...f, notify: e.target.value }))}
                  className="w-full h-9 px-3 text-sm rounded-md border border-border/60 bg-white focus:outline-none"
                  placeholder="Email or team member…"
                />
              </div>
            </div>
          </div>
        </div>
        <div className="px-6 py-4 border-t border-border flex justify-end gap-2">
          <button onClick={onClose} className="h-9 px-4 text-sm font-semibold text-foreground/80 rounded-lg border border-border hover:bg-muted/50">Cancel</button>
          <button onClick={launch} className="h-9 px-4 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700">Launch</button>
        </div>
      </div>
    </div>
  )
}