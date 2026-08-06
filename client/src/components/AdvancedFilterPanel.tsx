import { X } from 'lucide-react'
import type { AdvancedFilters } from './AssetsTable'
import { EMPTY_ADV_FILTERS } from './AssetsTable'

const ASSET_TYPES = ['Server', 'Workstation', 'Network Device', 'Cloud Instance', 'Container', 'Database', 'Firewall']
const TIERS = ['Tier 0', 'Tier 1', 'Tier 2', 'Tier 3']
const EXPOSURES = ['Internet', 'Internal', 'Intranet', 'DMZ', 'Cloud', 'Hybrid']
const FRAMEWORKS = ['SEBI', 'RBI', 'IRDA', 'DPDPA']

function toggle(list: string[], value: string) {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value]
}

function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-2.5 py-1 rounded-full text-xs border font-medium cursor-pointer transition-colors ${
        active ? 'bg-blue-600 text-white border-blue-600' : 'border-input text-muted-foreground hover:bg-secondary'
      }`}
    >
      {label}
    </button>
  )
}

export function AdvancedFilterPanel({ value, onChange, onClose }: { value: AdvancedFilters; onChange: (v: AdvancedFilters) => void; onClose: () => void }) {
  const activeCount = Object.entries(value).filter(([k, v]) => Array.isArray(v) ? v.length > 0 : v && v !== 'any').length

  return (
    <div className="bg-card border border-border rounded-xl shadow-sm p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-foreground">Advanced Filters</h3>
        <div className="flex items-center gap-3">
          {activeCount > 0 && (
            <button onClick={() => onChange(EMPTY_ADV_FILTERS)} className="text-xs text-blue-600 hover:underline cursor-pointer">Clear all ({activeCount})</button>
          )}
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground cursor-pointer"><X size={16} /></button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-6 gap-y-4">
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-muted-foreground uppercase">Domain & Type</label>
          <div className="flex flex-wrap gap-1.5">
            {ASSET_TYPES.map((t) => <Chip key={t} label={t} active={value.assetTypes.includes(t)} onClick={() => onChange({ ...value, assetTypes: toggle(value.assetTypes, t) })} />)}
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-muted-foreground uppercase">Risk & Priority (Tier)</label>
          <div className="flex flex-wrap gap-1.5">
            {TIERS.map((t) => <Chip key={t} label={t} active={value.tiers.includes(t)} onClick={() => onChange({ ...value, tiers: toggle(value.tiers, t) })} />)}
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-muted-foreground uppercase">Ownership</label>
          <div className="grid grid-cols-1 gap-1.5">
            <input placeholder="Owner" value={value.owner} onChange={(e) => onChange({ ...value, owner: e.target.value })} className="h-8 px-2.5 text-xs rounded-md border border-input bg-background" />
            <input placeholder="Department" value={value.department} onChange={(e) => onChange({ ...value, department: e.target.value })} className="h-8 px-2.5 text-xs rounded-md border border-input bg-background" />
            <input placeholder="Business Unit" value={value.businessUnit} onChange={(e) => onChange({ ...value, businessUnit: e.target.value })} className="h-8 px-2.5 text-xs rounded-md border border-input bg-background" />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-muted-foreground uppercase">Network & Location</label>
          <div className="flex flex-wrap gap-1.5 mb-1.5">
            {EXPOSURES.map((e) => <Chip key={e} label={e} active={value.exposure.includes(e)} onClick={() => onChange({ ...value, exposure: toggle(value.exposure, e) })} />)}
          </div>
          <input placeholder="Location" value={value.location} onChange={(e) => onChange({ ...value, location: e.target.value })} className="h-8 px-2.5 text-xs rounded-md border border-input bg-background w-full" />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-muted-foreground uppercase">Compliance & Controls</label>
          <div className="flex flex-wrap gap-1.5">
            {FRAMEWORKS.map((f) => <Chip key={f} label={f} active={value.compliance.includes(f)} onClick={() => onChange({ ...value, compliance: toggle(value.compliance, f) })} />)}
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-muted-foreground uppercase">Scanner Status</label>
          <div className="flex gap-3">
            <select value={value.agentStatus} onChange={(e) => onChange({ ...value, agentStatus: e.target.value as any })} className="h-8 px-2 text-xs rounded-md border border-input bg-background flex-1">
              <option value="any">Any Agent Status</option>
              <option value="installed">Agent Installed</option>
              <option value="not-installed">Agent Not Installed</option>
            </select>
            <select value={value.scanStatus} onChange={(e) => onChange({ ...value, scanStatus: e.target.value as any })} className="h-8 px-2 text-xs rounded-md border border-input bg-background flex-1">
              <option value="any">Any Scan Status</option>
              <option value="scanned">Scanned</option>
              <option value="never">Never Scanned</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  )
}