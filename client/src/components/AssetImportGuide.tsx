import { useState } from 'react'
import { BookOpen, X } from 'lucide-react'

const TABS = ['Overview', 'Fields', 'Allowed Values', 'Common Errors'] as const
type Tab = typeof TABS[number]

const FIELDS_DETAIL = [
  { label: 'Hostname', req: 'mandatory', aliases: 'hostname, host, asset, name, device, asset name', note: 'Primary identifier. Used to match existing assets.' },
  { label: 'IP Address (v4)', req: 'recommended', aliases: 'ip, ipv4, ip address, ipaddress', note: 'Standard dotted-decimal format (e.g. 10.0.1.5).' },
  { label: 'Asset Type', req: 'recommended', aliases: 'asset type, type, category, class, device type', note: 'See Allowed Values tab for accepted strings.' },
  { label: 'Business Unit', req: 'recommended', aliases: 'business unit, bu, department, org unit', note: 'Free text. Drives BU-level risk roll-up.' },
  { label: 'Criticality', req: 'recommended', aliases: 'criticality, tier, sensitivity, asset criticality', note: 'Tier 0 (highest) through Tier 4.' },
  { label: 'Exposure', req: 'recommended', aliases: 'exposure, zone, facing, network zone', note: 'Internet, Internal, DMZ, Cloud, Intranet, Hybrid.' },
  { label: 'OS', req: 'optional', aliases: 'os, operating system, platform', note: 'e.g. Ubuntu Linux, Windows Server 2022.' },
  { label: 'OS Version', req: 'optional', aliases: 'os version, osversion, version', note: 'e.g. 22.04, 2022, 14.0.' },
  { label: 'Asset Group', req: 'optional', aliases: 'asset group, group, application, app, ci group', note: 'Application or service group (e.g. Core Banking).' },
  { label: 'Priority', req: 'optional', aliases: 'priority, asset priority', note: '1 = highest, 4 = lowest. Auto-derived from criticality if omitted.' },
  { label: 'Owner', req: 'optional', aliases: 'owner, custodian, contact, asset owner', note: 'Email or name of responsible person.' },
  { label: 'Location / DC', req: 'optional', aliases: 'location, data center, data centre, site, dc, region', note: 'Physical location or cloud region.' },
  { label: 'IPv6', req: 'optional', aliases: 'ipv6', note: 'Full or compressed IPv6 address.' },
  { label: 'FQDN', req: 'optional', aliases: 'fqdn, dns, fully qualified domain', note: 'e.g. app01.corp.example.com.' },
  { label: 'Cloud Provider', req: 'optional', aliases: 'cloud provider, csp, cloud, provider', note: 'AWS, Azure, GCP, OCI, On-premises.' },
  { label: 'Instance ID', req: 'optional', aliases: 'instance id, instance, cloud id', note: 'Cloud instance/VM identifier (e.g. i-0abc123).' },
  { label: 'Tags', req: 'optional', aliases: 'tags, labels, tag', note: 'Key:value pairs separated by semicolons (e.g. env:prod;pii).' },
  { label: 'Agent Installed', req: 'optional', aliases: 'agent, agent installed', note: 'yes / no / installed / not installed.' },
  { label: 'Compliance Frameworks', req: 'optional', aliases: 'compliance, frameworks, regulation, compliance frameworks', note: 'Semicolon-separated: SEBI;RBI;DPDPA;PCI-DSS;ISO 27001.' },
]

const ALLOWED_VALUES = [
  { field: 'Asset Type', values: ['Server', 'Workstation', 'Network Device', 'Cloud Instance', 'Container', 'Database', 'Mobile', 'IoT', 'Virtual Machine', 'Firewall', 'Router', 'Switch'], note: 'Partial matches work: "linux server" → Server, "k8s pod" → Container.' },
  { field: 'Exposure', values: ['Internet', 'Internal', 'Intranet', 'DMZ', 'Cloud', 'Hybrid'], note: '"external" or "public" maps to Internet.' },
  { field: 'Criticality', values: ['Tier 0', 'Tier 1', 'Tier 2', 'Tier 3', 'Tier 4'], note: 'Tier 0 = crown jewel / most critical. Defaults to Tier 3 if omitted.' },
  { field: 'Priority', values: ['1', '2', '3', '4'], note: '1 = highest urgency, 4 = lowest. Auto-derived if criticality is set.' },
  { field: 'Cloud Provider', values: ['AWS', 'Azure', 'GCP', 'OCI', 'On-premises'], note: 'Case-insensitive.' },
  { field: 'Agent Installed', values: ['yes', 'no', 'installed', 'not installed', 'true', 'false', '1', '0'], note: '' },
  { field: 'Compliance Frameworks', values: ['SEBI', 'RBI', 'IRDA', 'DPDPA', 'PCI-DSS', 'ISO 27001', 'SOC 2', 'NIST CSF'], note: 'Separate multiple values with semicolons.' },
]

const COMMON_ERRORS = [
  { err: 'No valid rows found', fix: 'Ensure your file has a header row as the first non-comment line. Remove any BOM characters if exporting from Excel.' },
  { err: 'Invalid IPv4 address', fix: 'IP must be in dotted-decimal format (e.g. 192.168.1.10). Leading zeros like 192.168.01.10 are not valid.' },
  { err: 'Hostname is MISSING (shown in red)', fix: 'Every row must have a value in the Hostname/host/asset column. Blank rows are automatically skipped.' },
  { err: 'Unknown asset type stored as-is', fix: 'This is a warning, not an error. The value will be stored literally. Check the Allowed Values tab for standard types.' },
  { err: 'Criticality not set — defaults to Tier 3', fix: 'Provide "Tier 1", "Tier 2", etc. in the Criticality column to improve risk scoring.' },
  { err: '"Text contains commas" parsing issue', fix: 'Wrap the field in double quotes in your CSV: "Engineering, Core Platform".' },
  { err: 'Rows parsed as 0', fix: 'Check that the file is saved as CSV (not XLSX). In Excel: File → Save As → CSV UTF-8.' },
]

function ReqBadge({ req }: { req: string }) {
  return (
    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${req === 'mandatory' ? 'bg-red-100 text-red-700' : req === 'recommended' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>{req}</span>
  )
}

export function AssetImportGuide({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<Tab>('Overview')

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="w-full max-w-2xl bg-card border border-border rounded-2xl shadow-2xl max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-border flex items-center gap-2 shrink-0">
          <BookOpen className="h-4 w-4 text-blue-600" />
          <div>
            <h3 className="font-bold text-foreground text-sm">Asset Import — Field Guide</h3>
            <p className="text-xs text-muted-foreground">Everything you need to prepare your CSV before uploading</p>
          </div>
          <button onClick={onClose} className="ml-auto text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>

        <div className="flex gap-px border-b border-border bg-muted/30 shrink-0">
          {TABS.map((t) => (
            <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 text-xs font-semibold transition-colors ${tab === t ? 'bg-card text-foreground border-b-2 border-blue-600' : 'text-muted-foreground hover:text-foreground'}`}>{t}</button>
          ))}
        </div>

        <div className="p-5 overflow-y-auto flex-1 text-sm space-y-4">
          {tab === 'Overview' && (
            <div className="space-y-3">
              <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
                <p className="font-semibold text-blue-700 mb-2">How import works</p>
                <ol className="list-decimal ml-4 text-xs text-muted-foreground space-y-1">
                  <li>Download the Excel template (CSV format) and fill in your asset data.</li>
                  <li>Upload the file — the system auto-maps column names (case-insensitive, aliases accepted).</li>
                  <li>Review the validation screen: errors (shown in red) are skipped; warnings (amber) are imported as-is.</li>
                  <li>Confirm the import — only valid rows are committed to the inventory.</li>
                </ol>
              </div>
              <div className="rounded-xl border border-border p-4 space-y-2">
                <p className="font-semibold text-foreground text-xs mb-1">Format requirements</p>
                <ul className="list-disc ml-4 text-xs text-muted-foreground space-y-1">
                  <li>File must be <strong>CSV</strong> (comma-separated values) or Excel saved as CSV.</li>
                  <li>First row must be a <strong>header row</strong> with column names.</li>
                  <li>Lines starting with <code>#</code> are treated as comments and ignored.</li>
                  <li>Text fields containing commas must be enclosed in double quotes.</li>
                  <li>Multiple values (e.g. compliance frameworks) can be separated by <code>;</code> or <code>,</code>.</li>
                  <li>Maximum recommended file size: <strong>10,000 rows</strong>. Larger files may be slow.</li>
                </ul>
              </div>
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                <p className="font-semibold text-amber-700 text-xs mb-1">Mandatory field</p>
                <p className="text-xs text-muted-foreground"><strong>Hostname</strong> is the only mandatory field. Every other field is optional, but populating IP Address, Asset Type, Business Unit, and Criticality significantly improves risk scoring accuracy.</p>
              </div>
            </div>
          )}

          {tab === 'Fields' && (
            <div className="overflow-x-auto">
              <table className="w-full text-[11px] border-collapse">
                <thead>
                  <tr className="bg-muted/40">
                    {['Field', 'Req.', 'Accepted Column Names', 'Notes'].map((h) => <th key={h} className="px-3 py-2 text-left font-semibold text-muted-foreground border border-border/40">{h}</th>)}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/20">
                  {FIELDS_DETAIL.map((f) => (
                    <tr key={f.label}>
                      <td className="px-3 py-1.5 font-semibold text-foreground border border-border/20">{f.label}</td>
                      <td className="px-3 py-1.5 border border-border/20"><ReqBadge req={f.req} /></td>
                      <td className="px-3 py-1.5 font-mono text-[10px] text-muted-foreground border border-border/20">{f.aliases}</td>
                      <td className="px-3 py-1.5 text-[11px] text-muted-foreground border border-border/20">{f.note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {tab === 'Allowed Values' && (
            <div className="space-y-4 text-xs">
              {ALLOWED_VALUES.map((g) => (
                <div key={g.field} className="rounded-lg border border-border p-3">
                  <p className="font-semibold text-foreground mb-1">{g.field}</p>
                  <div className="flex flex-wrap gap-1 mb-1">{g.values.map((v) => <span key={v} className="px-2 py-0.5 rounded-full bg-muted border border-border/60 text-[10px] font-mono text-foreground">{v}</span>)}</div>
                  {g.note && <p className="text-muted-foreground mt-1">{g.note}</p>}
                </div>
              ))}
            </div>
          )}

          {tab === 'Common Errors' && (
            <div className="space-y-3 text-xs">
              {COMMON_ERRORS.map((e, i) => (
                <div key={i} className="rounded-lg border border-border p-3">
                  <p className="font-semibold text-red-600 mb-1">✗ {e.err}</p>
                  <p className="text-muted-foreground"><strong className="text-foreground">Fix:</strong> {e.fix}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t border-border shrink-0 flex justify-end">
          <button onClick={onClose} className="h-8 px-4 text-sm font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700">Close Guide</button>
        </div>
      </div>
    </div>
  )
}