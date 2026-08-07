import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { Plus, X } from 'lucide-react'

interface AssessmentRequest {
  id: number
  request_id: string
  assessment_type: string
  type_of_assessment: string
  assessment_name: string
  frequency: string
  application_id: number | null
  status: string
  requested_by: string
  request_date: string
  assigned_to: string | null
}

const TYPE_OF_ASSESSMENT = ['Full Testing', 'Enhancement', 'Re-assessment', 'Calendar']
const FULL_FREQUENCIES = ['Once', 'Daily', 'Weekly', 'Monthly', 'Quarterly', 'Bi-Annual', 'Annual']

function NewRequestModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [assessmentTypeOptions, setAssessmentTypeOptions] = useState<{ id: number; value: string }[]>([])
  const [applications, setApplications] = useState<any[]>([])
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState({
    assessment_type: '', type_of_assessment: '', assessment_group: '', frequency: '',
    tentative_start_date: '', timeHour: '', timeMinute: '', timePeriod: 'AM',
    assessment_name: '', application_id: '', cr_number: '', remarks: '',
  })

  useEffect(() => {
    fetch('/api/masters/assessment_type').then((r) => r.json()).then(setAssessmentTypeOptions).catch(() => {})
    fetch('/api/applications').then((r) => r.json()).then(setApplications).catch(() => {})
  }, [])

  const isFullOrCalendar = form.type_of_assessment === 'Full Testing' || form.type_of_assessment === 'Calendar'
  const selectedApp = applications.find((a) => String(a.id) === form.application_id)

  const handleTypeOfAssessmentChange = (v: string) => {
    const unlocksFrequency = v === 'Full Testing' || v === 'Calendar'
    setForm({ ...form, type_of_assessment: v, frequency: unlocksFrequency ? form.frequency : 'Once' })
  }

  const handleSubmit = async () => {
    if (!form.assessment_type || !form.type_of_assessment || !form.assessment_name.trim() || !form.tentative_start_date || !form.timeHour || !form.timeMinute) {
      toast.error('Please fill in all required fields')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/assessment-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          tentative_start_date: `${form.tentative_start_date}T${String((parseInt(form.timeHour) % 12) + (form.timePeriod === 'PM' ? 12 : 0)).padStart(2, '0')}:${form.timeMinute}:00`,
          application_id: form.application_id || null,
          application_type: selectedApp?.app_type || null,
          application_owner: selectedApp?.business_owner || null,
          business_spoc: selectedApp?.primary_owner || null,
          requested_by: 'system',
        }),
      })
      if (!res.ok) throw new Error('failed')
      toast.success(`Request ${(await res.json()).request_id} submitted`)
      onCreated()
      onClose()
    } catch {
      toast.error('Failed to submit request')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-card rounded-2xl shadow-2xl w-[560px] max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-border flex items-center justify-between sticky top-0 bg-card">
          <h3 className="font-bold text-foreground text-sm">Request for Assessment</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground cursor-pointer"><X className="h-4 w-4" /></button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <div className="text-xs font-bold text-muted-foreground uppercase mb-2">Section 1: Assessment Details</div>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">Assessment Type *</label>
                <select value={form.assessment_type} onChange={(e) => setForm({ ...form, assessment_type: e.target.value })} className="w-full h-9 px-2 text-sm rounded-md border border-input bg-background">
                  <option value="">Select Assessment Type...</option>
                  {assessmentTypeOptions.map((t) => <option key={t.id} value={t.value}>{t.value}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">Type of Assessment *</label>
                <select value={form.type_of_assessment} onChange={(e) => handleTypeOfAssessmentChange(e.target.value)} className="w-full h-9 px-2 text-sm rounded-md border border-input bg-background">
                  <option value="">Select...</option>
                  {TYPE_OF_ASSESSMENT.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">Frequency *</label>
                <select disabled={!isFullOrCalendar} value={form.frequency} onChange={(e) => setForm({ ...form, frequency: e.target.value })} className="w-full h-9 px-2 text-sm rounded-md border border-input bg-background disabled:bg-muted disabled:text-muted-foreground">
                  {isFullOrCalendar ? (
                    <>
                      <option value="">Select...</option>
                      {FULL_FREQUENCIES.map((f) => <option key={f} value={f}>{f}</option>)}
                    </>
                  ) : (
                    <option value="Once">Once</option>
                  )}
                </select>
                {!isFullOrCalendar && <p className="text-[11px] text-muted-foreground mt-1">Locked to "Once" — only unlocks for Full Testing or Calendar</p>}
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">Tentative Start Date *</label>
                <input type="date" min={new Date().toISOString().split('T')[0]} value={form.tentative_start_date} onChange={(e) => setForm({ ...form, tentative_start_date: e.target.value })} className="w-full h-9 px-2 text-sm rounded-md border border-input bg-background" />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">Tentative Start Time *</label>
                <div className="flex gap-2">
                  <select
                    value={form.timeHour}
                    onChange={(e) => setForm({ ...form, timeHour: e.target.value })}
                    className="flex-1 h-9 px-2 text-sm rounded-md border border-input bg-background"
                  >
                    <option value="">HH</option>
                    {Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0')).map((h) => <option key={h} value={h}>{h}</option>)}
                  </select>
                  <select
                    value={form.timeMinute}
                    onChange={(e) => setForm({ ...form, timeMinute: e.target.value })}
                    className="flex-1 h-9 px-2 text-sm rounded-md border border-input bg-background"
                  >
                    <option value="">MM</option>
                    {['00', '15', '30', '45'].map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                  <select
                    value={form.timePeriod}
                    onChange={(e) => setForm({ ...form, timePeriod: e.target.value })}
                    className="flex-1 h-9 px-2 text-sm rounded-md border border-input bg-background"
                  >
                    <option value="AM">AM</option>
                    <option value="PM">PM</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">Assessment Name *</label>
                <input value={form.assessment_name} onChange={(e) => setForm({ ...form, assessment_name: e.target.value })} placeholder="e.g. Q1 Web App Security Assessment" className="w-full h-9 px-3 text-sm rounded-md border border-input bg-background" />
              </div>
            </div>
          </div>

          <div>
            <div className="text-xs font-bold text-muted-foreground uppercase mb-2">Section 2: Application Details</div>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">Application Name *</label>
                <select value={form.application_id} onChange={(e) => setForm({ ...form, application_id: e.target.value })} className="w-full h-9 px-2 text-sm rounded-md border border-input bg-background">
                  <option value="">Select Application...</option>
                  {applications.map((a) => <option key={a.id} value={a.id}>{a.app_name} ({a.app_code})</option>)}
                </select>
              </div>
              {selectedApp && (
                <div className="grid grid-cols-2 gap-2 p-3 rounded-md bg-muted/40 text-xs">
                  <div><span className="text-muted-foreground">Type:</span> {selectedApp.app_type || '—'}</div>
                  <div><span className="text-muted-foreground">Business Owner:</span> {selectedApp.business_owner || '—'}</div>
                  <div><span className="text-muted-foreground">Technology Owner:</span> {selectedApp.technology_owner || '—'}</div>
                  <div><span className="text-muted-foreground">Primary Owner (SPOC):</span> {selectedApp.primary_owner || '—'}</div>
                </div>
              )}
              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">CR Number</label>
                <input value={form.cr_number} onChange={(e) => setForm({ ...form, cr_number: e.target.value })} placeholder="Change Request tracking ID" className="w-full h-9 px-3 text-sm rounded-md border border-input bg-background" />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">Remarks / Supporting Notes *</label>
                <textarea value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value })} rows={3} placeholder="Scope documents, architecture diagrams, credentials required for testing..." className="w-full px-3 py-2 text-sm rounded-md border border-input bg-background" />
              </div>
            </div>
          </div>

          </div>

        <div className="px-5 py-4 border-t border-border flex justify-end gap-2 sticky bottom-0 bg-card">
          <button onClick={onClose} className="h-9 px-4 text-sm font-semibold rounded-lg border border-border hover:bg-muted/50 cursor-pointer">Cancel</button>
          <button onClick={handleSubmit} disabled={saving} className="h-9 px-4 text-sm font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60 cursor-pointer">
            {saving ? 'Submitting…' : 'Submit Request'}
          </button>
        </div>
      </div>
    </div>
  )
}

function CreateAssessmentModal({ request, onClose, onCreated }: { request: AssessmentRequest; onClose: () => void; onCreated: () => void }) {
  const [users, setUsers] = useState<any[]>([])
  const [saving, setSaving] = useState(false)
  const [tester, setTester] = useState('')
  const [coordinators, setCoordinators] = useState<string[]>([])
  const [coordInput, setCoordInput] = useState('')
  const [publishOnTheGo, setPublishOnTheGo] = useState(false)

  useEffect(() => {
    fetch('/api/users').then((r) => r.json()).then(setUsers).catch(() => {})
  }, [])

  const testers = users.filter((u) => u.is_tester)
  const reviewers = users.filter((u) => u.is_reviewer)

  const handleCreate = async () => {
    if (!tester) {
      toast.error('Please assign a Tester')
      return
    }
    setSaving(true)
    try {
      const reviewerAuto = reviewers.length > 0 ? reviewers[Math.floor(Math.random() * reviewers.length)].name : null
      const res = await fetch(`/api/assessment-requests/${request.id}/approve`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tester, coordinators, reviewer: reviewerAuto, publish_on_the_go: publishOnTheGo }),
      })
      if (!res.ok) throw new Error('failed')
      const data = await res.json()
      toast.success(`${data.assessment.assessment_code} created and assigned to ${tester}`)
      onCreated()
      onClose()
    } catch {
      toast.error('Failed to create assessment')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-card rounded-2xl shadow-2xl w-[480px] max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-border sticky top-0 bg-card">
          <h3 className="font-bold text-foreground text-sm">Approve &amp; Create Assessment</h3>
          <p className="text-xs text-muted-foreground mt-0.5">{request.request_id} — {request.assessment_name}</p>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="text-xs font-semibold text-muted-foreground block mb-1">Tester *</label>
            <select value={tester} onChange={(e) => setTester(e.target.value)} className="w-full h-9 px-2 text-sm rounded-md border border-input bg-background">
              <option value="">Select Tester...</option>
              {testers.map((u) => <option key={u.id} value={u.name}>{u.name} ({u.email})</option>)}
            </select>
            {testers.length === 0 && <p className="text-[11px] text-amber-600 mt-1">No users marked as Tester — add one via Admin → Masters → Users & Vendors</p>}
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground block mb-1">Coordinators</label>
            <div className="flex gap-2">
              <select value={coordInput} onChange={(e) => setCoordInput(e.target.value)} className="flex-1 h-9 px-2 text-sm rounded-md border border-input bg-background">
                <option value="">Select a user...</option>
                {users.filter((u) => !coordinators.includes(u.name)).map((u) => <option key={u.id} value={u.name}>{u.name}</option>)}
              </select>
              <button type="button" onClick={() => { if (coordInput) { setCoordinators([...coordinators, coordInput]); setCoordInput('') } }} className="h-9 px-3 text-xs font-semibold rounded-md border border-border hover:bg-muted cursor-pointer">Add</button>
            </div>
            {coordinators.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {coordinators.map((c) => (
                  <span key={c} className="flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-secondary">
                    {c}
                    <button type="button" onClick={() => setCoordinators(coordinators.filter((x) => x !== c))} className="cursor-pointer">×</button>
                  </span>
                ))}
              </div>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground -mt-2">Reviewer will be auto-assigned from users marked as Reviewer ({reviewers.length} available).</p>
          <div className="flex items-center justify-between">
            <span className="text-sm text-foreground">Publish Vulnerability On-the-Go</span>
            <button
              type="button"
              onClick={() => setPublishOnTheGo(!publishOnTheGo)}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors cursor-pointer ${publishOnTheGo ? 'bg-blue-600' : 'bg-muted-foreground/30'}`}
            >
              <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${publishOnTheGo ? 'translate-x-4.5' : 'translate-x-1'}`} />
            </button>
          </div>
          <p className="text-[11px] text-muted-foreground -mt-2">When enabled, findings logged by the tester bypass review gates and publish directly to asset owners (Workflow Type 1).</p>
        </div>
        <div className="px-5 py-4 border-t border-border flex justify-end gap-2 sticky bottom-0 bg-card">
          <button onClick={onClose} className="h-9 px-4 text-sm font-semibold rounded-lg border border-border hover:bg-muted/50 cursor-pointer">Cancel</button>
          <button onClick={handleCreate} disabled={saving} className="h-9 px-4 text-sm font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60 cursor-pointer">
            {saving ? 'Creating…' : 'Approve & Create Assessment'}
          </button>
        </div>
      </div>
    </div>
  )
}

const STATUS_TONE: Record<string, string> = {
  Pending: 'bg-amber-50 text-amber-700 border-amber-200',
  Approved: 'bg-green-50 text-green-700 border-green-200',
  Rejected: 'bg-red-50 text-red-700 border-red-200',
}

const ASM_STATUS_TONE: Record<string, string> = {
  'Not Started': 'bg-slate-100 text-slate-600 border-slate-200',
  'In-Process Manual': 'bg-blue-50 text-blue-700 border-blue-200',
  'In-Process Auto': 'bg-purple-50 text-purple-700 border-purple-200',
  'Paused': 'bg-amber-50 text-amber-700 border-amber-200',
  'Completed': 'bg-green-50 text-green-700 border-green-200',
  'Cancelled': 'bg-red-50 text-red-700 border-red-200',
}

const ASM_ACTIONS: Record<string, { label: string; to: string; bg: string }[]> = {
  'Not Started': [
    { label: 'Start Manual', to: 'In-Process Manual', bg: 'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100' },
    { label: 'Start Auto', to: 'In-Process Auto', bg: 'border-purple-200 bg-purple-50 text-purple-700 hover:bg-purple-100' },
    { label: 'Cancel', to: 'Cancelled', bg: 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100' },
  ],
  'In-Process Manual': [
    { label: 'Pause', to: 'Paused', bg: 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100' },
    { label: 'Complete', to: 'Completed', bg: 'border-green-200 bg-green-50 text-green-700 hover:bg-green-100' },
    { label: 'Cancel', to: 'Cancelled', bg: 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100' },
  ],
  'In-Process Auto': [
    { label: 'Pause', to: 'Paused', bg: 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100' },
    { label: 'Complete', to: 'Completed', bg: 'border-green-200 bg-green-50 text-green-700 hover:bg-green-100' },
    { label: 'Cancel', to: 'Cancelled', bg: 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100' },
  ],
  'Paused': [
    { label: 'Resume Manual', to: 'In-Process Manual', bg: 'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100' },
    { label: 'Resume Auto', to: 'In-Process Auto', bg: 'border-purple-200 bg-purple-50 text-purple-700 hover:bg-purple-100' },
    { label: 'Cancel', to: 'Cancelled', bg: 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100' },
  ],
  'Completed': [],
  'Cancelled': [],
}

function FindingsDrawer({ assessment, onClose }: { assessment: any; onClose: () => void }) {
  const [findings, setFindings] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ title: '', cve_id: '', severity: 'Medium', cvss_score: '', diagnosis: '', solution: '' })
  const [saving, setSaving] = useState(false)

  const fetchFindings = () => {
    setLoading(true)
    fetch(`/api/vulnerabilities/assessment/${assessment.id}`).then((r) => r.json()).then(setFindings).catch(() => {}).finally(() => setLoading(false))
  }

  useEffect(() => { fetchFindings() }, [assessment.id])

  const addFinding = async () => {
    if (!form.title.trim()) { toast.error('Title is required'); return }
    setSaving(true)
    try {
      const res = await fetch('/api/vulnerabilities/discover', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, cvss_score: form.cvss_score ? Number(form.cvss_score) : null, assessment_id: assessment.id, asset_id: 200, discovered_by: assessment.tester }),
      })
      if (!res.ok) throw new Error('failed')
      const data = await res.json()
      toast.success(data.discoveryType === 'Also Found' ? 'Matched existing vulnerability — marked as Also Found' : 'New finding logged as Draft')
      setForm({ title: '', cve_id: '', severity: 'Medium', cvss_score: '', diagnosis: '', solution: '' })
      setShowAdd(false)
      fetchFindings()
    } catch {
      toast.error('Failed to log finding')
    } finally {
      setSaving(false)
    }
  }

  const publishFinding = async (id: number) => {
    await fetch(`/api/vulnerabilities/discovery/${id}/publish`, { method: 'PUT' })
    toast.success('Finding published')
    fetchFindings()
  }

  const requestVerdict = async (id: number) => {
    const res = await fetch(`/api/vulnerabilities/discovery/${id}/request-verdict`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ verdict: 'False Positive', requested_by: assessment.tester }),
    })
    if (!res.ok) { toast.error('Failed to request verdict'); return }
    const data = await res.json()
    toast.success(data.needsL2 ? 'Verdict requested — pending L1 Reviewer approval, then L2 Approver' : 'Verdict requested — pending Reviewer approval')
    fetchFindings()
  }

  const decideVerdict = async (id: number, decision: 'Approved' | 'Rejected', level: 'L1' | 'Final') => {
    const reviewer = level === 'L1' ? assessment.reviewer : (approverName || assessment.reviewer)
    const res = await fetch(`/api/vulnerabilities/discovery/${id}/verdict-decision`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ decision, reviewed_by: reviewer, level }),
    })
    if (!res.ok) { const d = await res.json(); toast.error(d.error); return }
    toast.success(`${level === 'L1' ? 'L1 review' : 'Verdict'} ${decision.toLowerCase()}`)
    fetchFindings()
  }

  const openTicket = async (id: number) => {
    const res = await fetch(`/api/vulnerabilities/discovery/${id}/open-ticket`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ remediation_owner: assessment.tester }),
    })
    if (!res.ok) { const d = await res.json(); toast.error(d.error); return }
    const data = await res.json()
    toast.success(`Ticket ${data.ticket_id} opened`)
    fetchFindings()
  }

  const updateTicketStatus = async (id: number, status: string) => {
    await fetch(`/api/vulnerabilities/discovery/${id}/ticket-status`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }),
    })
    toast.success(`Ticket updated to ${status}`)
    fetchFindings()
  }

  const markClean = async (id: number) => {
    await fetch(`/api/vulnerabilities/discovery/${id}/mark-clean`, { method: 'PUT' })
    toast.success('Marked clean — no remediation needed')
    fetchFindings()
  }

  const requestRetest = async (id: number) => {
    const res = await fetch(`/api/assessment-requests/retest/${id}`, { method: 'POST' })
    if (!res.ok) { const d = await res.json(); toast.error(d.error); return }
    const data = await res.json()
    toast.success(`Re-test request ${data.request_id} created`)
  }

  const discardFinding = async (id: number) => {
    await fetch(`/api/vulnerabilities/discovery/${id}/discard`, { method: 'PUT' })
    toast.success('Draft discarded')
    fetchFindings()
  }

  const isCompleted = assessment.status === 'Completed'
  const [drawerTab, setDrawerTab] = useState<'Summary' | 'Findings' | 'Schedule'>('Summary')
  const [assetDetails, setAssetDetails] = useState<any | null>(null)
  const [schedules, setSchedules] = useState<any[]>([])
  const [approverName, setApproverName] = useState('')
  const [showBulkUpload, setShowBulkUpload] = useState(false)
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadResult, setUploadResult] = useState<any | null>(null)

  const handleBulkUpload = async () => {
    if (!uploadFile) return
    setUploading(true)
    setUploadResult(null)
    try {
      const formData = new FormData()
      formData.append('file', uploadFile)
      const res = await fetch(`/api/vulnerabilities/bulk-upload/${assessment.id}`, { method: 'POST', body: formData })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error || 'Upload failed'); return }
      setUploadResult(data)
      toast.success(`${data.created} created, ${data.matched} matched, ${data.skipped} skipped`)
      fetchFindings()
    } catch {
      toast.error('Upload failed')
    } finally {
      setUploading(false)
    }
  }

  useEffect(() => {
    fetch(`/api/assessments/${assessment.id}/asset-details`).then((r) => r.json()).then(setAssetDetails).catch(() => {})
    fetch('/api/users').then((r) => r.json()).then((users: any[]) => {
      const approver = users.find((u) => u.is_approver)
      if (approver) setApproverName(approver.name)
    }).catch(() => {})
  }, [assessment.id])
  const [showScheduleForm, setShowScheduleForm] = useState(false)
  const [scheduleForm, setScheduleForm] = useState({ scan_tool: 'Qualys', scan_type: 'Normal Scan', frequency: 'Once', run_time: '09:00' })

  const fetchSchedules = () => {
    fetch(`/api/auto-scan/schedule/assessment/${assessment.id}`).then((r) => r.json()).then(setSchedules).catch(() => {})
  }

  useEffect(() => { fetchSchedules() }, [assessment.id])

  const createSchedule = async () => {
    const res = await fetch('/api/auto-scan/schedule', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...scheduleForm, assessment_id: assessment.id }),
    })
    if (!res.ok) { toast.error('Failed to create schedule'); return }
    toast.success('Auto-scan schedule created')
    setShowScheduleForm(false)
    fetchSchedules()
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-card rounded-2xl shadow-2xl w-[720px] max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-border flex items-center justify-between sticky top-0 bg-card">
          <div>
            <h3 className="font-bold text-foreground text-sm">{assessment.assessment_code} — Findings</h3>
            <p className="text-xs text-muted-foreground mt-0.5">{assessment.assessment_name}</p>
          </div>
          <div className="flex items-center gap-2">
            {!isCompleted && (
              <>
                <button onClick={() => setShowAdd(true)} className="h-8 px-3 text-xs font-semibold rounded-md bg-blue-600 text-white hover:bg-blue-700 cursor-pointer">+ Log Finding</button>
                <button onClick={() => setShowScheduleForm(true)} className="h-8 px-3 text-xs font-semibold rounded-md border border-purple-200 bg-purple-50 text-purple-700 hover:bg-purple-100 cursor-pointer">Schedule Auto-Scan</button>
                <button onClick={() => setShowBulkUpload(true)} className="h-8 px-3 text-xs font-semibold rounded-md border border-green-200 bg-green-50 text-green-700 hover:bg-green-100 cursor-pointer">Upload Results</button>
              </>
            )}
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground cursor-pointer"><X className="h-4 w-4" /></button>
          </div>
        </div>

        <div className="flex gap-1 px-5 pt-3 border-b border-border">
          {(['Summary', 'Findings', 'Schedule'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setDrawerTab(t)}
              className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors cursor-pointer ${drawerTab === t ? 'border-blue-500 text-blue-600' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
            >
              {t}
            </button>
          ))}
        </div>

        {isCompleted && (
          <div className="mx-5 mt-4 px-3 py-2 rounded-md bg-slate-100 border border-slate-200 text-xs text-slate-600">
            This assessment is Completed — all published findings are frozen and read-only.
          </div>
        )}

        {drawerTab === 'Summary' && (
          <div className="mx-5 mt-4 grid grid-cols-4 gap-2">
            {[
              { label: 'Total', value: findings.length, color: 'text-foreground' },
              { label: 'Critical/High', value: findings.filter((f) => ['Critical', 'High'].includes(f.snapshot_severity)).length, color: 'text-red-700' },
              { label: 'Remediated', value: findings.filter((f) => f.ticket_status === 'Closed').length, color: 'text-green-700' },
              { label: 'False Positive', value: findings.filter((f) => f.verdict_status === 'Approved').length, color: 'text-slate-500' },
            ].map((s) => (
              <div key={s.label} className="rounded-md border border-border p-3 text-center">
                <div className={`text-xl font-bold ${s.color}`}>{s.value}</div>
                <div className="text-[10px] text-muted-foreground uppercase mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>
        )}

        {drawerTab === 'Summary' && assetDetails && (
          <div className="mx-5 mt-4 mb-6 p-3 rounded-md bg-muted/40 border border-border">
            <div className="text-xs font-bold text-muted-foreground uppercase mb-2">Target / Application Details</div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
              <div><span className="text-muted-foreground">Application:</span> <span className="font-medium text-foreground">{assetDetails.app_name || '—'}</span></div>
              <div><span className="text-muted-foreground">App Code:</span> <span className="font-medium text-foreground">{assetDetails.app_code || '—'}</span></div>
              <div><span className="text-muted-foreground">Type:</span> <span className="font-medium text-foreground">{assetDetails.application_type || '—'}</span></div>
              <div><span className="text-muted-foreground">Business Owner:</span> <span className="font-medium text-foreground">{assetDetails.business_owner || '—'}</span></div>
              <div><span className="text-muted-foreground">Technology Owner:</span> <span className="font-medium text-foreground">{assetDetails.technology_owner || '—'}</span></div>
              <div><span className="text-muted-foreground">SPOC:</span> <span className="font-medium text-foreground">{assetDetails.business_spoc || '—'}</span></div>
            </div>
          </div>
        )}

        {drawerTab === 'Schedule' && schedules.length > 0 && (
          <div className="mx-5 mt-4 p-3 rounded-md bg-purple-50 border border-purple-200">
            <div className="text-xs font-bold text-purple-700 mb-1.5">Auto-Scan Schedule</div>
            {schedules.map((s) => (
              <div key={s.id} className="text-xs text-purple-800 flex items-center gap-2 flex-wrap">
                <span className="font-semibold">{s.scan_tool}</span>
                <span>·</span>
                <span>{s.scan_type}</span>
                <span>·</span>
                <span>{s.frequency}</span>
                <span>·</span>
                <span>Next run: {new Date(s.next_run_at).toLocaleString()}</span>
                <span className={`ml-auto font-bold px-1.5 py-0.5 rounded ${s.status === 'Active' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}`}>{s.status}</span>
              </div>
            ))}
          </div>
        )}

        {drawerTab === 'Schedule' && schedules.length === 0 && (
          <div className="mx-5 mt-4 text-sm text-muted-foreground text-center py-8">No auto-scan schedule configured yet — use "Schedule Auto-Scan" above.</div>
        )}

        {drawerTab === 'Findings' && (
        <div className="p-5">
          {loading && <div className="text-sm text-muted-foreground text-center py-6">Loading…</div>}
          {!loading && findings.length === 0 && <div className="text-sm text-muted-foreground text-center py-6">No findings logged yet.</div>}
          {!loading && findings.length > 0 && (
            <div className="space-y-2">
              {findings.map((f) => (
                <div key={f.id} className="rounded-lg border border-border p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-foreground">{f.snapshot_title}</span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${f.snapshot_severity === 'Critical' ? 'bg-red-100 text-red-700' : f.snapshot_severity === 'High' ? 'bg-orange-100 text-orange-700' : f.snapshot_severity === 'Medium' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>{f.snapshot_severity}</span>
                        {f.discovery_type === 'Also Found' && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-purple-100 text-purple-700">Also Found</span>}
                        {f.is_draft && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">Draft</span>}
                        {!f.is_draft && f.published_via === 'Auto' && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-teal-100 text-teal-700">Auto-Published</span>}
                        {f.is_frozen && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">Frozen</span>}
                        {f.verdict_l1_status === 'Pending' && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">Pending L1 Review</span>}
                        {f.verdict_l1_status === 'Approved' && f.verdict_status === 'Pending' && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-purple-100 text-purple-700">Pending L2 Approval</span>}
                        {f.verdict_status === 'Pending' && f.verdict_l1_status === 'None' && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">Verdict Pending</span>}
                        {f.verdict_status === 'Approved' && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-700">False Positive</span>}
                        {(f.verdict_status === 'Rejected' || f.verdict_l1_status === 'Rejected') && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">Verdict Rejected</span>}
                      </div>
                      {f.cve_id && <div className="text-xs font-mono text-muted-foreground mt-0.5">{f.cve_id}</div>}
                      <div className="text-xs text-muted-foreground mt-1">{f.snapshot_diagnosis}</div>
                      {f.verdict_l1_status === 'Pending' && <div className="text-[11px] text-amber-700 mt-1">Requested by {f.verdict_requested_by} — awaiting Reviewer</div>}
                      {f.verdict_l1_status === 'Approved' && f.verdict_status === 'Pending' && <div className="text-[11px] text-purple-700 mt-1">L1 approved by {f.verdict_l1_by} — awaiting Approver</div>}
                      {f.verdict_status === 'Approved' && <div className="text-[11px] text-muted-foreground mt-1">{f.verdict_l2_by ? `L1: ${f.verdict_l1_by} → L2: ${f.verdict_l2_by}` : `Reviewed by ${f.verdict_reviewed_by}`}</div>}
                      {f.ticket_id && (
                        <div className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1.5">
                          <span className="font-mono">{f.ticket_id}</span>
                          <span className={`font-bold ${f.ticket_status === 'Closed' ? 'text-green-600' : 'text-blue-600'}`}>{f.ticket_status}</span>
                          {f.remediation_owner && <span>— {f.remediation_owner}</span>}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col gap-1.5 shrink-0 items-end">
                      <div className="flex gap-1.5">
                        {f.is_draft && !isCompleted && (
                          <>
                            <button onClick={() => publishFinding(f.id)} className="text-xs font-semibold px-2 py-1 rounded-md border border-green-200 bg-green-50 text-green-700 hover:bg-green-100 cursor-pointer">Publish</button>
                            <button onClick={() => discardFinding(f.id)} className="text-xs font-semibold px-2 py-1 rounded-md border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 cursor-pointer">Discard</button>
                          </>
                        )}
                        {!f.is_draft && !f.is_frozen && f.verdict_status === 'None' && (
                          <button onClick={() => requestVerdict(f.id)} className="text-xs font-semibold px-2 py-1 rounded-md border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 cursor-pointer">Request False Positive</button>
                        )}
                        {f.verdict_l1_status === 'Pending' && (
                          <>
                            <button onClick={() => decideVerdict(f.id, 'Approved', 'L1')} className="text-xs font-semibold px-2 py-1 rounded-md border border-green-200 bg-green-50 text-green-700 hover:bg-green-100 cursor-pointer">L1 Approve</button>
                            <button onClick={() => decideVerdict(f.id, 'Rejected', 'L1')} className="text-xs font-semibold px-2 py-1 rounded-md border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 cursor-pointer">L1 Reject</button>
                          </>
                        )}
                        {f.verdict_l1_status === 'Approved' && f.verdict_status === 'Pending' && (
                          <>
                            <button onClick={() => decideVerdict(f.id, 'Approved', 'Final')} className="text-xs font-semibold px-2 py-1 rounded-md border border-purple-200 bg-purple-50 text-purple-700 hover:bg-purple-100 cursor-pointer">L2 Approve</button>
                            <button onClick={() => decideVerdict(f.id, 'Rejected', 'Final')} className="text-xs font-semibold px-2 py-1 rounded-md border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 cursor-pointer">L2 Reject</button>
                          </>
                        )}
                        {f.verdict_status === 'Pending' && f.verdict_l1_status === 'None' && (
                          <>
                            <button onClick={() => decideVerdict(f.id, 'Approved', 'Final')} className="text-xs font-semibold px-2 py-1 rounded-md border border-green-200 bg-green-50 text-green-700 hover:bg-green-100 cursor-pointer">Approve</button>
                            <button onClick={() => decideVerdict(f.id, 'Rejected', 'Final')} className="text-xs font-semibold px-2 py-1 rounded-md border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 cursor-pointer">Reject</button>
                          </>
                        )}
                      </div>
                      {!f.is_draft && !f.ticket_id && f.verdict_status !== 'Approved' && (
                        <div className="flex gap-1.5">
                          <button onClick={() => markClean(f.id)} className="text-xs font-semibold px-2 py-1 rounded-md border border-green-200 bg-green-50 text-green-700 hover:bg-green-100 cursor-pointer">Mark Clean</button>
                          <button onClick={() => openTicket(f.id)} className="text-xs font-semibold px-2 py-1 rounded-md border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 cursor-pointer">Open Ticket</button>
                        </div>
                      )}
                      {f.ticket_id && f.ticket_status !== 'Closed' && (
                        <select
                          value={f.ticket_status}
                          onChange={(e) => updateTicketStatus(f.id, e.target.value)}
                          className="text-xs h-7 px-2 rounded-md border border-input bg-background cursor-pointer"
                        >
                          {['Open', 'Remediation In Progress', 'Pending Retest', 'Closed'].map((s) => <option key={s} value={s}>{s}</option>)}
                        </select>
                      )}
                      {f.ticket_status === 'Closed' && (
                        <button onClick={() => requestRetest(f.id)} className="text-xs font-semibold px-2 py-1 rounded-md border border-purple-200 bg-purple-50 text-purple-700 hover:bg-purple-100 cursor-pointer">Request Re-test</button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        )}

        {showBulkUpload && (
          <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40" onClick={() => setShowBulkUpload(false)}>
            <div className="bg-card rounded-2xl shadow-2xl w-[440px]" onClick={(e) => e.stopPropagation()}>
              <div className="px-5 py-4 border-b border-border"><h3 className="font-bold text-foreground text-sm">Upload Scan Results (CSV)</h3></div>
              <div className="p-5 space-y-3">
                <p className="text-xs text-muted-foreground">Required columns: <span className="font-mono">title, severity</span>. Optional: <span className="font-mono">cve_id, cvss_score, diagnosis, solution</span>. Severity must be Critical/High/Medium/Low. Max 500 rows.</p>
                <input
                  type="file"
                  accept=".csv"
                  onChange={(e) => { setUploadFile(e.target.files?.[0] || null); setUploadResult(null) }}
                  className="w-full text-sm file:mr-3 file:h-8 file:px-3 file:rounded-md file:border file:border-input file:bg-background file:text-sm file:cursor-pointer cursor-pointer"
                />
                {uploadResult && (
                  <div className="rounded-md bg-muted/40 border border-border p-3 text-xs space-y-1">
                    <div><span className="font-semibold text-green-700">{uploadResult.created}</span> new findings created</div>
                    <div><span className="font-semibold text-purple-700">{uploadResult.matched}</span> matched to existing findings ("Also Found")</div>
                    <div><span className="font-semibold text-red-700">{uploadResult.skipped}</span> rows skipped</div>
                    {uploadResult.errors.length > 0 && (
                      <div className="mt-1.5 text-red-600">
                        {uploadResult.errors.map((e: string, i: number) => <div key={i}>{e}</div>)}
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div className="px-5 py-4 border-t border-border flex justify-end gap-2">
                <button onClick={() => setShowBulkUpload(false)} className="h-9 px-4 text-sm font-semibold rounded-lg border border-border hover:bg-muted/50 cursor-pointer">Close</button>
                <button onClick={handleBulkUpload} disabled={!uploadFile || uploading || !!uploadResult} className="h-9 px-4 text-sm font-semibold rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer">
                  {uploading ? 'Uploading…' : uploadResult ? 'Uploaded' : 'Upload'}
                </button>
              </div>
            </div>
          </div>
        )}

        {showScheduleForm && (
          <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40" onClick={() => setShowScheduleForm(false)}>
            <div className="bg-card rounded-2xl shadow-2xl w-[420px]" onClick={(e) => e.stopPropagation()}>
              <div className="px-5 py-4 border-b border-border"><h3 className="font-bold text-foreground text-sm">Schedule Auto-Scan</h3></div>
              <div className="p-5 space-y-3">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground block mb-1">Scan Tool</label>
                  <select value={scheduleForm.scan_tool} onChange={(e) => setScheduleForm({ ...scheduleForm, scan_tool: e.target.value })} className="w-full h-9 px-2 text-sm rounded-md border border-input bg-background">
                    {['Qualys', 'Tenable', 'Rapid7'].map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground block mb-1">Scan Type</label>
                  <select value={scheduleForm.scan_type} onChange={(e) => setScheduleForm({ ...scheduleForm, scan_type: e.target.value })} className="w-full h-9 px-2 text-sm rounded-md border border-input bg-background">
                    {['Normal Scan', 'Agent Based', 'EC2'].map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground block mb-1">Frequency</label>
                  <select value={scheduleForm.frequency} onChange={(e) => setScheduleForm({ ...scheduleForm, frequency: e.target.value })} className="w-full h-9 px-2 text-sm rounded-md border border-input bg-background">
                    {['Once', 'Daily', 'Weekly', 'Monthly', 'Yearly'].map((f) => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground block mb-1">Run Time</label>
                  <input type="time" value={scheduleForm.run_time} onChange={(e) => setScheduleForm({ ...scheduleForm, run_time: e.target.value })} className="w-full h-9 px-2 text-sm rounded-md border border-input bg-background" />
                </div>
              </div>
              <div className="px-5 py-4 border-t border-border flex justify-end gap-2">
                <button onClick={() => setShowScheduleForm(false)} className="h-9 px-4 text-sm font-semibold rounded-lg border border-border hover:bg-muted/50 cursor-pointer">Cancel</button>
                <button onClick={createSchedule} className="h-9 px-4 text-sm font-semibold rounded-lg bg-purple-600 text-white hover:bg-purple-700 cursor-pointer">Create Schedule</button>
              </div>
            </div>
          </div>
        )}

        {showAdd && (
          <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40" onClick={() => setShowAdd(false)}>
            <div className="bg-card rounded-2xl shadow-2xl w-[460px]" onClick={(e) => e.stopPropagation()}>
              <div className="px-5 py-4 border-b border-border"><h3 className="font-bold text-foreground text-sm">Log Finding</h3></div>
              <div className="p-5 space-y-3">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground block mb-1">Title *</label>
                  <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="w-full h-9 px-3 text-sm rounded-md border border-input bg-background" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground block mb-1">CVE ID</label>
                    <input value={form.cve_id} onChange={(e) => setForm({ ...form, cve_id: e.target.value })} placeholder="optional" className="w-full h-9 px-3 text-sm rounded-md border border-input bg-background" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground block mb-1">CVSS Score</label>
                    <input type="number" step="0.1" min="0" max="10" value={form.cvss_score} onChange={(e) => setForm({ ...form, cvss_score: e.target.value })} className="w-full h-9 px-3 text-sm rounded-md border border-input bg-background" />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground block mb-1">Severity</label>
                  <select value={form.severity} onChange={(e) => setForm({ ...form, severity: e.target.value })} className="w-full h-9 px-2 text-sm rounded-md border border-input bg-background">
                    {['Critical', 'High', 'Medium', 'Low'].map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground block mb-1">Diagnosis</label>
                  <textarea value={form.diagnosis} onChange={(e) => setForm({ ...form, diagnosis: e.target.value })} rows={2} className="w-full px-3 py-2 text-sm rounded-md border border-input bg-background" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground block mb-1">Solution</label>
                  <textarea value={form.solution} onChange={(e) => setForm({ ...form, solution: e.target.value })} rows={2} className="w-full px-3 py-2 text-sm rounded-md border border-input bg-background" />
                </div>
              </div>
              <div className="px-5 py-4 border-t border-border flex justify-end gap-2">
                <button onClick={() => setShowAdd(false)} className="h-9 px-4 text-sm font-semibold rounded-lg border border-border hover:bg-muted/50 cursor-pointer">Cancel</button>
                <button onClick={addFinding} disabled={saving} className="h-9 px-4 text-sm font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60 cursor-pointer">{saving ? 'Saving…' : 'Log Finding'}</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function AssessmentsListing() {
  const [assessments, setAssessments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [viewingAssessment, setViewingAssessment] = useState<any | null>(null)
  const [confirmComplete, setConfirmComplete] = useState<{ id: number; draftCount: number } | null>(null)

  const fetchAssessments = () => {
    setLoading(true)
    fetch('/api/assessments').then((r) => r.json()).then(setAssessments).catch(() => {}).finally(() => setLoading(false))
  }

  useEffect(() => { fetchAssessments() }, [])

  const changeStatus = async (id: number, status: string, discardDrafts?: boolean) => {
    const res = await fetch(`/api/assessments/${id}/status`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status, discardDrafts }),
    })
    if (!res.ok) {
      const d = await res.json()
      if (d.error === 'drafts_pending') {
        setConfirmComplete({ id, draftCount: d.draftCount })
        return
      }
      toast.error(d.error)
      return
    }
    toast.success(`Status updated to ${status}`)
    fetchAssessments()
  }

  return (
    <div className="space-y-3">
      <h2 className="text-sm font-bold text-foreground">Assessment Management</h2>
      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/30 border-b border-border/40">
              {['Assessment Code', 'Assessment Name', 'Tester', 'Reviewer', 'Status', 'Actions'].map((h) => (
                <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/20">
            {loading && <tr><td colSpan={6} className="text-center py-8 text-sm text-muted-foreground">Loading…</td></tr>}
            {!loading && assessments.length === 0 && <tr><td colSpan={6} className="text-center py-8 text-sm text-muted-foreground">No assessments created yet.</td></tr>}
            {!loading && assessments.map((a) => (
              <tr key={a.id} className="hover:bg-muted/30 cursor-pointer" onClick={() => setViewingAssessment(a)}>
                <td className="px-3 py-2.5 font-mono text-xs text-blue-600 hover:underline">{a.assessment_code}</td>
                <td className="px-3 py-2.5 font-medium text-foreground">{a.assessment_name}</td>
                <td className="px-3 py-2.5 text-xs text-muted-foreground">{a.tester || '—'}</td>
                <td className="px-3 py-2.5 text-xs text-muted-foreground">{a.reviewer || '—'}</td>
                <td className="px-3 py-2.5">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${ASM_STATUS_TONE[a.status] || ''}`}>{a.status}</span>
                </td>
                <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                  <div className="flex gap-1.5 flex-wrap">
                    {(ASM_ACTIONS[a.status] || []).map((action) => (
                      <button key={action.label} onClick={() => changeStatus(a.id, action.to)} className={`text-xs font-semibold px-2.5 py-1 rounded-md border cursor-pointer ${action.bg}`}>
                        {action.label}
                      </button>
                    ))}
                    {(ASM_ACTIONS[a.status] || []).length === 0 && <span className="text-xs text-muted-foreground">—</span>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {confirmComplete && (
        <div className="fixed inset-0 z-[85] flex items-center justify-center bg-black/40" onClick={() => setConfirmComplete(null)}>
          <div className="bg-card rounded-2xl shadow-2xl w-[420px]" onClick={(e) => e.stopPropagation()}>
            <div className="p-5 space-y-3">
              <h3 className="font-bold text-foreground text-sm">Complete Assessment</h3>
              <p className="text-sm text-muted-foreground">
                {confirmComplete.draftCount} draft finding(s) will be <strong>discarded</strong> if you proceed. Published findings will be frozen. This cannot be undone.
              </p>
            </div>
            <div className="px-5 py-4 border-t border-border flex justify-end gap-2">
              <button onClick={() => setConfirmComplete(null)} className="h-9 px-4 text-sm font-semibold rounded-lg border border-border hover:bg-muted/50 cursor-pointer">Cancel</button>
              <button
                onClick={() => { changeStatus(confirmComplete.id, 'Completed', true); setConfirmComplete(null) }}
                className="h-9 px-4 text-sm font-semibold rounded-lg bg-red-600 text-white hover:bg-red-700 cursor-pointer"
              >
                Discard Drafts &amp; Complete
              </button>
            </div>
          </div>
        </div>
      )}

      {viewingAssessment && <FindingsDrawer assessment={viewingAssessment} onClose={() => setViewingAssessment(null)} />}
    </div>
  )
}

function VulnerabilitySummaryView() {
  const [summary, setSummary] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/vulnerabilities/summary').then((r) => r.json()).then(setSummary).catch(() => {}).finally(() => setLoading(false))
  }, [])

  return (
    <div className="space-y-3 pt-4 border-t border-border">
      <h2 className="text-sm font-bold text-foreground">Vulnerability Summary — Cross-Assessment Comparison</h2>
      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/30 border-b border-border/40">
              <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Assessment</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Status</th>
              {['Total', 'Critical', 'High', 'Medium', 'Low', 'Remediated', 'False Positive', 'Draft'].map((h) => (
                <th key={h} className="px-3 py-2 text-center text-xs font-semibold text-muted-foreground">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/20">
            {loading && <tr><td colSpan={10} className="text-center py-8 text-sm text-muted-foreground">Loading…</td></tr>}
            {!loading && summary.map((s) => (
              <tr key={s.assessment_id} className="hover:bg-muted/30">
                <td className="px-3 py-2.5">
                  <div className="font-mono text-xs text-muted-foreground">{s.assessment_code}</div>
                  <div className="font-medium text-foreground text-sm">{s.assessment_name}</div>
                </td>
                <td className="px-3 py-2.5">
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${ASM_STATUS_TONE[s.status] || ''}`}>{s.status}</span>
                </td>
                <td className="px-3 py-2.5 text-center text-sm font-semibold text-foreground">{s.total_findings}</td>
                <td className="px-3 py-2.5 text-center text-sm font-semibold text-red-700">{s.critical_count}</td>
                <td className="px-3 py-2.5 text-center text-sm font-semibold text-orange-700">{s.high_count}</td>
                <td className="px-3 py-2.5 text-center text-sm font-semibold text-amber-700">{s.medium_count}</td>
                <td className="px-3 py-2.5 text-center text-sm font-semibold text-blue-700">{s.low_count}</td>
                <td className="px-3 py-2.5 text-center text-sm font-semibold text-green-700">{s.remediated_count}</td>
                <td className="px-3 py-2.5 text-center text-sm font-semibold text-slate-500">{s.false_positive_count}</td>
                <td className="px-3 py-2.5 text-center text-sm font-semibold text-purple-700">{s.draft_count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function VulnerabilityListView() {
  const [findings, setFindings] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [severityFilter, setSeverityFilter] = useState('all')

  useEffect(() => {
    fetch('/api/vulnerabilities/all').then((r) => r.json()).then(setFindings).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const filtered = severityFilter === 'all' ? findings : findings.filter((f) => f.snapshot_severity === severityFilter)

  const statusBadge = (f: any) => {
    if (f.verdict_status === 'Approved') return <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-700">False Positive</span>
    if (f.ticket_status === 'Closed') return <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-green-100 text-green-700">Remediated</span>
    if (f.ticket_id) return <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">{f.ticket_status}</span>
    if (f.is_draft) return <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">Draft</span>
    return <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">Open</span>
  }

  return (
    <div className="space-y-3 pt-4 border-t border-border">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-foreground">Vulnerability List</h2>
        <select value={severityFilter} onChange={(e) => setSeverityFilter(e.target.value)} className="h-8 px-2 text-xs rounded-md border border-input bg-background">
          <option value="all">All Severities</option>
          {['Critical', 'High', 'Medium', 'Low'].map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/30 border-b border-border/40">
              {['Title', 'Severity', 'Assessment', 'Type', 'Discovered By', 'Status'].map((h) => (
                <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/20">
            {loading && <tr><td colSpan={6} className="text-center py-8 text-sm text-muted-foreground">Loading…</td></tr>}
            {!loading && filtered.length === 0 && <tr><td colSpan={6} className="text-center py-8 text-sm text-muted-foreground">No findings match this filter.</td></tr>}
            {!loading && filtered.map((f) => (
              <tr key={f.id} className="hover:bg-muted/30">
                <td className="px-3 py-2.5 font-medium text-foreground">
                  {f.snapshot_title}
                  {f.cve_id && <span className="ml-1.5 font-mono text-[10px] text-muted-foreground">{f.cve_id}</span>}
                </td>
                <td className="px-3 py-2.5">
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${f.snapshot_severity === 'Critical' ? 'bg-red-100 text-red-700' : f.snapshot_severity === 'High' ? 'bg-orange-100 text-orange-700' : f.snapshot_severity === 'Medium' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>{f.snapshot_severity}</span>
                </td>
                <td className="px-3 py-2.5 text-xs font-mono text-muted-foreground">{f.assessment_code}</td>
                <td className="px-3 py-2.5 text-xs text-muted-foreground">{f.assessment_type}</td>
                <td className="px-3 py-2.5 text-xs text-muted-foreground">{f.discovered_by}</td>
                <td className="px-3 py-2.5">{statusBadge(f)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export function RequestAssessmentTab() {
  const [requests, setRequests] = useState<AssessmentRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)
  const [approvingRequest, setApprovingRequest] = useState<AssessmentRequest | null>(null)

  const fetchRequests = () => {
    setLoading(true)
    fetch('/api/assessment-requests')
      .then((res) => res.json())
      .then(setRequests)
      .catch(() => toast.error('Failed to load assessment requests'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchRequests() }, [])


  const handleReject = async (id: number) => {
    await fetch(`/api/assessment-requests/${id}/reject`, { method: 'PUT' })
    toast.success('Request rejected')
    fetchRequests()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold text-foreground">Request for Assessment</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Raise and track requests to conduct security assessments on applications and infrastructure assets.</p>
        </div>
        <button onClick={() => setShowNew(true)} className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-md bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 cursor-pointer">
          <Plus className="h-4 w-4" /> New Request
        </button>
      </div>

      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/30 border-b border-border/40">
              {['Request ID', 'Assessment Name', 'Assessment Type', 'Type', 'Requested By', 'Request Date', 'Status', 'Actions'].map((h) => (
                <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/20">
            {loading && <tr><td colSpan={8} className="text-center py-8 text-sm text-muted-foreground">Loading…</td></tr>}
            {!loading && requests.length === 0 && <tr><td colSpan={8} className="text-center py-8 text-sm text-muted-foreground">No assessment requests yet.</td></tr>}
            {!loading && requests.map((r) => (
              <tr key={r.id} className="hover:bg-muted/30">
                <td className="px-3 py-2.5 font-mono text-xs text-muted-foreground">{r.request_id}</td>
                <td className="px-3 py-2.5 font-medium text-foreground">{r.assessment_name}</td>
                <td className="px-3 py-2.5 text-muted-foreground text-xs">{r.assessment_type}</td>
                <td className="px-3 py-2.5 text-muted-foreground text-xs">{r.type_of_assessment}</td>
                <td className="px-3 py-2.5 text-muted-foreground text-xs">{r.requested_by}</td>
                <td className="px-3 py-2.5 text-muted-foreground text-xs">{new Date(r.request_date).toLocaleDateString()}</td>
                <td className="px-3 py-2.5">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${STATUS_TONE[r.status] || ''}`}>{r.status}</span>
                </td>
                <td className="px-3 py-2.5">
                  {r.status === 'Pending' ? (
                    <div className="flex gap-1.5">
                      <button onClick={() => setApprovingRequest(r)} className="text-xs font-semibold px-2.5 py-1 rounded-md border border-green-200 bg-green-50 text-green-700 hover:bg-green-100 cursor-pointer">Approve</button>
                      <button onClick={() => handleReject(r.id)} className="text-xs font-semibold px-2.5 py-1 rounded-md border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 cursor-pointer">Reject</button>
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showNew && <NewRequestModal onClose={() => setShowNew(false)} onCreated={fetchRequests} />}
      {approvingRequest && <CreateAssessmentModal request={approvingRequest} onClose={() => setApprovingRequest(null)} onCreated={fetchRequests} />}

      <div className="pt-4 border-t border-border">
        <AssessmentsListing />
      </div>

      <VulnerabilitySummaryView />
      <VulnerabilityListView />
    </div>
  )
}