import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { X } from 'lucide-react'

export function LaunchAssessmentScanModal({ onClose }: { onClose: () => void }) {
  const [assessments, setAssessments] = useState<any[]>([])
  const [form, setForm] = useState({ assessment_id: '', scan_tool: 'Qualys', scan_type: 'Normal Scan', frequency: 'Once', run_time: '09:00' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch('/api/assessments')
      .then((r) => r.json())
      .then((data: any[]) => setAssessments(data.filter((a) => !['Completed', 'Cancelled'].includes(a.status))))
      .catch(() => {})
  }, [])

  const handleSubmit = async () => {
    if (!form.assessment_id) { toast.error('Please select an assessment'); return }
    setSaving(true)
    try {
      const res = await fetch('/api/auto-scan/schedule', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) throw new Error('failed')
      toast.success('Scan scheduled for the selected assessment')
      onClose()
    } catch {
      toast.error('Failed to schedule scan')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-card rounded-2xl shadow-2xl w-[440px]" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <h3 className="font-bold text-foreground text-sm">Launch Scan</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground cursor-pointer"><X className="h-4 w-4" /></button>
        </div>
        <div className="p-5 space-y-3">
          <div>
            <label className="text-xs font-semibold text-muted-foreground block mb-1">Assessment *</label>
            <select value={form.assessment_id} onChange={(e) => setForm({ ...form, assessment_id: e.target.value })} className="w-full h-9 px-2 text-sm rounded-md border border-input bg-background">
              <option value="">Select an assessment...</option>
              {assessments.map((a) => <option key={a.id} value={a.id}>{a.assessment_code} — {a.assessment_name}</option>)}
            </select>
            {assessments.length === 0 && <p className="text-[11px] text-amber-600 mt-1">No open assessments available — create and approve a request first.</p>}
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground block mb-1">Scan Tool</label>
            <select value={form.scan_tool} onChange={(e) => setForm({ ...form, scan_tool: e.target.value })} className="w-full h-9 px-2 text-sm rounded-md border border-input bg-background">
              {['Qualys', 'Tenable', 'Rapid7'].map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground block mb-1">Scan Type</label>
            <select value={form.scan_type} onChange={(e) => setForm({ ...form, scan_type: e.target.value })} className="w-full h-9 px-2 text-sm rounded-md border border-input bg-background">
              {['Normal Scan', 'Agent Based', 'EC2'].map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground block mb-1">Frequency</label>
            <select value={form.frequency} onChange={(e) => setForm({ ...form, frequency: e.target.value })} className="w-full h-9 px-2 text-sm rounded-md border border-input bg-background">
              {['Once', 'Daily', 'Weekly', 'Monthly', 'Yearly'].map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground block mb-1">Run Time</label>
            <input type="time" value={form.run_time} onChange={(e) => setForm({ ...form, run_time: e.target.value })} className="w-full h-9 px-2 text-sm rounded-md border border-input bg-background" />
          </div>
        </div>
        <div className="px-5 py-4 border-t border-border flex justify-end gap-2">
          <button onClick={onClose} className="h-9 px-4 text-sm font-semibold rounded-lg border border-border hover:bg-muted/50 cursor-pointer">Cancel</button>
          <button onClick={handleSubmit} disabled={saving} className="h-9 px-4 text-sm font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60 cursor-pointer">
            {saving ? 'Scheduling…' : 'Schedule Scan'}
          </button>
        </div>
      </div>
    </div>
  )
}