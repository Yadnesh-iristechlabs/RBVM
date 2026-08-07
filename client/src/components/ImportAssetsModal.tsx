import { useState, useEffect } from 'react'
import { UploadCloud, Info, ChevronRight, BookOpen, Download, X, AlertTriangle } from 'lucide-react'
import { AssetImportGuide } from '@/components/AssetImportGuide'

const ASSET_TEMPLATE_CSV = [
  '# RBVM Asset Import Template — v2.0 (27 fields)',
  '# Instructions: Fill in the data rows below. Delete or keep these comment lines (they are ignored on upload).',
  '# MANDATORY: Hostname (every other field is optional)',
  '# Asset Type: Server | Workstation | Network Device | Cloud Instance | Container | Database | Mobile | IoT | Virtual Machine | Firewall | Router | Switch',
  '# Exposure: Internet | Internal | Intranet | DMZ | Cloud | Hybrid',
  '# Criticality: Tier 0 (crown jewel) | Tier 1 | Tier 2 | Tier 3 | Tier 4 (lowest)',
  '# Priority: 1 (highest) | 2 | 3 | 4 (lowest)',
  '# Cloud Provider: AWS | Azure | GCP | OCI | On-premises',
  '# Environment: Production | Staging | Development | QA | DR',
  '# Agent Installed: yes | no | installed | not installed',
  '# First Seen / Last Seen: YYYY-MM-DD format',
  '# Compliance Frameworks: semicolon-separated — SEBI;RBI;DPDPA;IRDA;PCI-DSS;ISO 27001;SOC 2;NIST CSF',
  '#',
  'Hostname,IP Address,IPv6,FQDN,MAC Address,Serial Number,Asset Type,OS,OS Version,Exposure,Criticality,Priority,Environment,Network Segment,Business Unit,Asset Group,Owner,Location,Cloud Region,Cloud Provider,Instance ID,Tags,Agent Installed,Agent Version,First Seen,Last Seen,Compliance Frameworks',
  'web-prod-001,10.0.1.5,,web.prod.internal,AA:BB:CC:DD:EE:01,,Server,Ubuntu Linux,22.04,Internet,Tier 1,1,Production,DMZ-Web,Digital Banking,Web Platform,ops@cybernx.com,DC-Mumbai,,,,env:prod;customer-facing,yes,3.2.1,2025-01-15,2026-07-15,"SEBI;RBI;DPDPA"',
  'ec2-api-002,10.0.2.20,,,,,Cloud Instance,Amazon Linux,2023,Cloud,Tier 2,2,Production,AWS-Private,Engineering,API Services,devops@cybernx.com,,ap-south-1,AWS,i-0abc123def456,"env:prod;pci",yes,3.2.0,2024-06-01,2026-07-18,"PCI-DSS;SOC 2"',
  'fw-dmz-01,10.0.0.3,,,,,Network Device,FortiOS,7.4.0,DMZ,Tier 0,1,Production,Perimeter,Infrastructure,Perimeter Security,nw-team@cybernx.com,DC-Mumbai,,,,"perimeter;crown-jewel",no,,2023-03-01,2026-07-10,"SEBI;RBI"',
  'ws-hr-204,10.2.7.55,,,,,Workstation,Windows 11,23H2,Internal,Tier 3,3,Production,Corp-LAN,Human Resources,HR Endpoints,hr-admin@cybernx.com,Pune Office,,,,"endpoint;hr",yes,3.1.5,2024-02-10,2026-07-17,DPDPA',
  'db-core-01,10.1.4.12,,,,,Database,Oracle Linux,8.8,Internal,Tier 1,1,Production,DB-VLAN,Core Banking,Database Cluster,dba@cybernx.com,DC-Mumbai,,,,"pii;restricted",yes,3.2.1,2022-09-01,2026-07-18,"SEBI;RBI;IRDA"',
  'k8s-node-03,10.50.3.10,,k8s-node-03.cluster.local,,,Container,Ubuntu Linux,22.04,Cloud,Tier 2,2,Production,K8s-Cluster,Platform Engineering,Container Cluster,devops@cybernx.com,,ap-south-1,AWS,i-0def456abc,"container;k8s",yes,3.2.1,2024-11-01,2026-07-18,"SOC 2"',
].join('\n')

function downloadTemplate() {
  const blob = new Blob([ASSET_TEMPLATE_CSV], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'rbvm_asset_import_template.csv'
  a.click()
  URL.revokeObjectURL(url)
}

const ASSET_IMPORT_FIELDS: { key: string; label: string; req: 'mandatory' | 'recommended' | 'optional'; aliases: string }[] = [
  { key: 'hostname', label: 'Hostname', req: 'mandatory', aliases: 'hostname, host, asset, name, device, asset name' },
  { key: 'ipv4', label: 'IP Address (v4)', req: 'recommended', aliases: 'ip, ipv4, ip address, ipaddress, host ip' },
  { key: 'assetType', label: 'Asset Type', req: 'recommended', aliases: 'asset type, type, category, class, device type' },
  { key: 'businessUnit', label: 'Business Unit', req: 'recommended', aliases: 'business unit, bu, department, org unit' },
  { key: 'criticality', label: 'Criticality', req: 'recommended', aliases: 'criticality, tier, sensitivity (Tier 0–4)' },
  { key: 'exposure', label: 'Exposure', req: 'recommended', aliases: 'exposure, zone, facing, network zone (Internet/DMZ/Cloud/Intranet)' },
  { key: 'os', label: 'OS', req: 'optional', aliases: 'os, operating system, platform' },
  { key: 'osVersion', label: 'OS Version', req: 'optional', aliases: 'os version, osversion, version' },
  { key: 'assetGroup', label: 'Asset Group', req: 'optional', aliases: 'asset group, group, application, app, ci group' },
  { key: 'priority', label: 'Priority', req: 'optional', aliases: 'priority, asset priority (1–4)' },
  { key: 'owner', label: 'Owner', req: 'optional', aliases: 'owner, custodian, contact, asset owner' },
  { key: 'location', label: 'Location / DC', req: 'optional', aliases: 'location, data center, data centre, site, dc' },
  { key: 'region', label: 'Cloud Region', req: 'optional', aliases: 'region, cloud region, availability zone' },
  { key: 'ipv6', label: 'IPv6', req: 'optional', aliases: 'ipv6' },
  { key: 'fqdn', label: 'FQDN', req: 'optional', aliases: 'fqdn, dns, fully qualified domain' },
  { key: 'macAddress', label: 'MAC Address', req: 'optional', aliases: 'mac, mac address, macaddress' },
  { key: 'serialNumber', label: 'Serial Number', req: 'optional', aliases: 'serial number, serial, asset tag' },
  { key: 'environment', label: 'Environment', req: 'optional', aliases: 'environment, env (Production/Staging/Dev/QA)' },
  { key: 'networkSegment', label: 'Network Segment', req: 'optional', aliases: 'network segment, vlan, subnet, segment' },
  { key: 'cloudProvider', label: 'Cloud Provider', req: 'optional', aliases: 'cloud provider, csp, cloud (AWS/Azure/GCP/OCI)' },
  { key: 'instanceId', label: 'Instance ID', req: 'optional', aliases: 'instance id, instance, vm id, cloud id' },
  { key: 'tags', label: 'Tags', req: 'optional', aliases: 'tags, labels (semicolon/comma separated key:value)' },
  { key: 'agent', label: 'Agent Installed', req: 'optional', aliases: 'agent, agent installed (yes/no)' },
  { key: 'agentVersion', label: 'Agent Version', req: 'optional', aliases: 'agent version, agentversion' },
  { key: 'firstSeen', label: 'First Seen', req: 'optional', aliases: 'first seen, first discovered, created (YYYY-MM-DD)' },
  { key: 'lastSeen', label: 'Last Seen', req: 'optional', aliases: 'last seen, last scanned, last active (YYYY-MM-DD)' },
  { key: 'complianceFrameworks', label: 'Compliance Frameworks', req: 'optional', aliases: 'compliance, frameworks, regulation (SEBI;RBI;DPDPA;…)' },
]

type Step = 1 | 2 | 3

interface ValidationResult {
  totalRows: number
  validCount: number
  errorCount: number
  errors: { row: number; field: string; message: string }[]
  preview: Record<string, any>[]
}

export function ImportAssetsModal({ open, onOpenChange, onImported }: { open: boolean; onOpenChange: (v: boolean) => void; onImported?: () => void }) {
  const [step, setStep] = useState<Step>(1)
  const [fileName, setFileName] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [showGuide, setShowGuide] = useState(false)
  const [validating, setValidating] = useState(false)
  const [result, setResult] = useState<ValidationResult | null>(null)
  const [committing, setCommitting] = useState(false)
  const [importedCount, setImportedCount] = useState(0)
  const [progressPct, setProgressPct] = useState(0)

  useEffect(() => {
    if (!open) return
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [open])

  if (!open) return null

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f)
    setFileName(f.name)
    setStep(2)
    setValidating(true)
    const startTime = Date.now()
    try {
      const form = new FormData()
      form.append('file', f)
      const res = await fetch('/api/import/validate', { method: 'POST', body: form })
      const data = await res.json()
      const elapsed = Date.now() - startTime
      const minDelay = 800
      if (elapsed < minDelay) await new Promise((r) => setTimeout(r, minDelay - elapsed))
      setResult(data)
    } catch (err) {
      console.error('validate failed', err)
    } finally {
      setValidating(false)
    }
  }

  const commit = async () => {
    if (!file) return
    setCommitting(true)
    setStep(3)
    setProgressPct(0)

    const progressTimer = setInterval(() => {
      setProgressPct((p) => Math.min(90, p + Math.random() * 15))
    }, 200)

    try {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch('/api/import/commit', { method: 'POST', body: form })
      const data = await res.json()
      clearInterval(progressTimer)
      setProgressPct(100)
      await new Promise((r) => setTimeout(r, 400))
      setImportedCount(data.imported ?? 0)
      onImported?.()
    } catch (err) {
      clearInterval(progressTimer)
      console.error('commit failed', err)
    } finally {
      setCommitting(false)
    }
  }

  const close = () => {
    setStep(1)
    setFileName('')
    setFile(null)
    setResult(null)
    setImportedCount(0)
    onOpenChange(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={close}>
      <div className="w-full max-w-4xl bg-card border border-border rounded-2xl shadow-2xl max-h-[95vh] flex flex-col" onClick={(e) => e.stopPropagation()}>

        <div className="px-6 py-4 border-b border-border flex items-center gap-3 shrink-0">
          <UploadCloud className="h-5 w-5 text-blue-600 shrink-0" />
          <div>
            <h3 className="font-bold text-foreground">Import Assets</h3>
            <p className="text-xs text-muted-foreground">CSV, XLSX, or XML upload · 27 fields · auto-mapped column names · validated before import</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button onClick={() => setShowGuide(true)} className="inline-flex items-center gap-1.5 h-8 px-3 text-xs font-semibold rounded-lg border border-blue-300 text-blue-600 hover:bg-blue-50">
              <BookOpen className="h-3.5 w-3.5" /> Import Guide
            </button>
            <button onClick={close} className="text-muted-foreground hover:text-foreground ml-1"><X className="h-4 w-4" /></button>
          </div>
        </div>

        <div className="px-6 py-3 border-b border-border/50 flex items-center gap-3 text-xs shrink-0">
          {(['Upload', 'Validate', 'Complete'] as const).map((label, i) => {
            const s = i + 1
            const done = step > s
            const active = step === s
            return (
              <div key={label} className="flex items-center gap-2">
                <div className={`flex items-center justify-center w-6 h-6 rounded-full text-[11px] font-bold border-2 transition-colors ${done ? 'bg-green-500 border-green-500 text-white' : active ? 'bg-blue-600 border-blue-600 text-white' : 'border-border text-muted-foreground'}`}>
                  {done ? '✓' : s}
                </div>
                <span className={active ? 'font-semibold text-foreground' : done ? 'text-green-600' : 'text-muted-foreground'}>{label}</span>
                {i < 2 && <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40" />}
              </div>
            )
          })}
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {step === 1 && (
            <>
              <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-4">
                <p className="text-sm font-semibold text-blue-700 mb-2 flex items-center gap-1.5"><Info className="h-4 w-4" /> Getting started</p>
                <ul className="list-disc ml-4 text-xs text-muted-foreground space-y-1 leading-relaxed">
                  <li>Download the template, fill in your asset data, then upload the file.</li>
                  <li><strong>Hostname</strong> is the only mandatory field. All other columns are optional.</li>
                  <li>Column names are matched automatically — case-insensitive, common aliases accepted.</li>
                  <li>Comment lines (starting with <code className="bg-muted px-1 rounded">#</code>) are ignored.</li>
                  <li>Click <strong>Import Guide</strong> (top right) for detailed field documentation and allowed values.</li>
                </ul>
              </div>

              <details className="rounded-lg border border-border group">
                <summary className="px-4 py-2.5 text-xs font-semibold text-foreground cursor-pointer hover:bg-muted/40 flex items-center gap-2 list-none">
                  <ChevronRight className="h-3.5 w-3.5 group-open:rotate-90 transition-transform" />
                  Column reference ({ASSET_IMPORT_FIELDS.length} supported fields)
                </summary>
                <div className="max-h-52 overflow-y-auto border-t border-border/40">
                  <table className="w-full text-[11px]">
                    <thead className="sticky top-0 bg-muted/50">
                      <tr>{['Field', 'Requirement', 'Accepted Column Names'].map((h) => <th key={h} className="px-3 py-2 text-left font-semibold text-muted-foreground">{h}</th>)}</tr>
                    </thead>
                    <tbody className="divide-y divide-border/20">
                      {ASSET_IMPORT_FIELDS.map((f) => (
                        <tr key={f.key}>
                          <td className="px-3 py-1.5 font-semibold text-foreground">{f.label}</td>
                          <td className="px-3 py-1.5">
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${f.req === 'mandatory' ? 'bg-red-100 text-red-700' : f.req === 'recommended' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>{f.req}</span>
                          </td>
                          <td className="px-3 py-1.5 font-mono text-[10px] text-muted-foreground">{f.aliases}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>

              <div className="flex flex-wrap items-center gap-2">
                <button onClick={downloadTemplate} className="inline-flex items-center gap-1.5 h-9 px-4 text-sm font-semibold rounded-lg border border-border text-foreground hover:bg-muted transition-colors">
                  <Download className="h-4 w-4 text-blue-600" /> Download Excel Template (CSV)
                </button>
              </div>

              <label className="flex flex-col items-center justify-center gap-2 w-full h-36 rounded-xl border-2 border-dashed border-border hover:border-blue-400 hover:bg-muted/20 text-muted-foreground cursor-pointer transition-colors group">
                <UploadCloud className="h-8 w-8 group-hover:text-blue-500 transition-colors" />
                <span className="text-sm font-medium group-hover:text-foreground transition-colors">Click to choose your CSV file</span>
                <span className="text-xs">Maximum 10,000 rows · UTF-8 CSV</span>
                <input type="file" accept=".csv,.xlsx,.xls,.xml,text/csv" onChange={onFile} className="hidden" />
              </label>
            </>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="text-sm text-foreground">
                File: <span className="font-mono">{fileName}</span>
              </div>
              {validating && (
                <div className="py-12 flex flex-col items-center justify-center gap-3">
                  <div className="relative w-14 h-14">
                    <div className="absolute inset-0 rounded-full border-4 border-blue-100" />
                    <div className="absolute inset-0 rounded-full border-4 border-blue-600 border-t-transparent animate-spin" />
                  </div>
                  <div className="text-center">
                    <div className="text-sm font-semibold text-foreground">Validating file…</div>
                    <div className="text-xs text-muted-foreground mt-0.5">Checking rows against the 27-field spec</div>
                  </div>
                </div>
              )}
              {result && !validating && (
                <>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="rounded-lg border border-border bg-muted/20 p-3 text-center">
                      <div className="text-2xl font-black text-foreground">{result.totalRows}</div>
                      <div className="text-xs text-muted-foreground">Total Rows</div>
                    </div>
                    <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-center">
                      <div className="text-2xl font-black text-green-600">{result.validCount}</div>
                      <div className="text-xs text-green-700">Valid</div>
                    </div>
                    <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-center">
                      <div className="text-2xl font-black text-red-600">{result.errorCount}</div>
                      <div className="text-xs text-red-700">Errors</div>
                    </div>
                  </div>
                  {result.errors.length > 0 && (
                    <div className="max-h-40 overflow-y-auto rounded-lg border border-red-200">
                      <table className="w-full text-xs">
                        <thead className="bg-red-50 sticky top-0">
                          <tr>{['Row', 'Field', 'Message'].map((h) => <th key={h} className="px-3 py-2 text-left font-semibold text-red-700">{h}</th>)}</tr>
                        </thead>
                        <tbody className="divide-y divide-red-100">
                          {result.errors.map((e, i) => (
                            <tr key={i}>
                              <td className="px-3 py-1.5">{e.row}</td>
                              <td className="px-3 py-1.5">{e.field}</td>
                              <td className="px-3 py-1.5 text-red-600">{e.message}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  {result.preview.length > 0 && (
                    <div>
                      <div className="text-xs font-semibold text-muted-foreground mb-1">Preview (first {result.preview.length} valid rows)</div>
                      <div className="max-h-40 overflow-auto rounded-lg border border-border">
                        <table className="w-full text-xs">
                          <thead className="bg-muted/40 sticky top-0">
                            <tr>{Object.keys(result.preview[0]).map((k) => <th key={k} className="px-2 py-1.5 text-left font-semibold text-muted-foreground whitespace-nowrap">{k}</th>)}</tr>
                          </thead>
                          <tbody className="divide-y divide-border/20">
                            {result.preview.map((row, i) => (
                              <tr key={i}>
                                {Object.keys(result.preview[0]).map((k) => <td key={k} className="px-2 py-1.5 whitespace-nowrap">{String(row[k] ?? '')}</td>)}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {step === 3 && (
            committing ? (
              <div className="py-10 space-y-4">
                <div className="text-center">
                  <div className="text-sm font-semibold text-foreground">Importing assets…</div>
                  <div className="text-xs text-muted-foreground mt-1">Please don't close this window</div>
                </div>
                <div className="max-w-sm mx-auto space-y-2">
                  <div className="w-full h-2.5 rounded-full bg-muted overflow-hidden">
                    <div className="h-full bg-blue-600 transition-all duration-300 rounded-full" style={{ width: `${progressPct}%` }} />
                  </div>
                  <div className="text-center text-xs text-muted-foreground">{Math.round(progressPct)}%</div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 space-y-2">
                <div className="text-4xl font-black text-green-600">{importedCount}</div>
                <div className="text-sm text-muted-foreground">assets imported successfully</div>
              </div>
            )
          )}
        </div>

        <div className="px-6 py-4 border-t border-border flex items-center justify-between gap-2 shrink-0">
          <div>
            {step === 2 && (
              <button onClick={() => setStep(1)} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                ← Back to Upload
              </button>
            )}
            {step === 3 && !committing && (
              <button onClick={() => { setStep(2) }} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                ← Back to Validate
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            {step < 3 && <button onClick={close} className="h-9 px-4 text-sm rounded-lg border border-border text-muted-foreground hover:bg-muted">Cancel</button>}
            {step === 2 && result && result.validCount > 0 && (
              <button onClick={commit} disabled={committing} className="h-9 px-4 text-sm font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60">
                {committing ? 'Importing…' : `Import ${result.validCount} Assets`}
              </button>
            )}
            {step === 3 && !committing && <button onClick={close} className="h-9 px-4 text-sm font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700">Done</button>}
          </div>
        </div>
      </div>
      {showGuide && <AssetImportGuide onClose={() => setShowGuide(false)} />}
    </div>
  )
}