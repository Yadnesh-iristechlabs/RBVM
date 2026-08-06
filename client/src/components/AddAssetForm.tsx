import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { Plus, Save, ChevronDown } from 'lucide-react'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { MockAsset } from '@/mock/assets'


function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border border-border rounded-lg p-5">
      <div className="flex items-center gap-3 mb-4">
        <div className="flex-1 h-px bg-border" />
        <span className="text-xs font-semibold uppercase tracking-wide text-foreground/70">{title}</span>
        <div className="flex-1 h-px bg-border" />
      </div>
      {children}
    </div>
  )
}

function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <Label className="text-xs font-semibold uppercase tracking-wide text-foreground/70">
      {children}
      {required && <span className="text-destructive ml-0.5">*</span>}
    </Label>
  )
}

export function AddAssetForm({ open, onOpenChange, asset, onSaved }: { open: boolean; onOpenChange: (v: boolean) => void; asset?: MockAsset; onSaved?: () => void }) {
  const isEdit = !!asset
  const [hostname, setHostname] = useState(asset?.hostname ?? '')
  const [ipAddress, setIpAddress] = useState(asset?.ip_address ?? '')
  const [fqdn, setFqdn] = useState('')
  const [macAddress, setMacAddress] = useState('')
  const [port, setPort] = useState('')
  const [urlSsid, setUrlSsid] = useState('')
  const [userType, setUserType] = useState<'Internal' | 'External' | ''>('')
  const [endpoints, setEndpoints] = useState<string[]>([])
  const [endpointInput, setEndpointInput] = useState('')
  const addEndpoint = () => {
    if (endpointInput.trim() && !endpoints.includes(endpointInput.trim())) {
      setEndpoints([...endpoints, endpointInput.trim()])
      setEndpointInput('')
    }
  }
  const [applicationId, setApplicationId] = useState('')
  const [qualysAssetId, setQualysAssetId] = useState('')
  const [qualysAgentId, setQualysAgentId] = useState('')
  const [qualysNetbios, setQualysNetbios] = useState('')
  const [regionVpcId, setRegionVpcId] = useState('')
  const [qwebHostId, setQwebHostId] = useState('')
  const [tenableAssetId, setTenableAssetId] = useState('')
  const [tenableAgentName, setTenableAgentName] = useState('')
  const [tenableRepoName, setTenableRepoName] = useState('')
  const [tenableManagerName, setTenableManagerName] = useState('')
  const [applicationOptions, setApplicationOptions] = useState<{ id: number; app_name: string; app_code: string }[]>([])
  const [connectedTools, setConnectedTools] = useState<Record<string, boolean>>({})

  useEffect(() => {
    fetch('http://localhost:4001/api/integrations')
      .then((res) => res.json())
      .then((data: any[]) => {
        const status: Record<string, boolean> = {}
        data.forEach((d) => { status[d.name] = d.connected })
        setConnectedTools(status)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    fetch('http://localhost:4001/api/applications')
      .then((res) => res.json())
      .then(setApplicationOptions)
      .catch(() => {})
  }, [])
  const [assetType, setAssetType] = useState(asset?.asset_type ?? '')
  const [exposure, setExposure] = useState(asset?.exposure ?? 'Intranet')
  const [criticality, setCriticality] = useState(asset?.criticality ?? '')
  const [tierOptions, setTierOptions] = useState<{ id: number; value: string }[]>([])
  const [assetTypeOptions, setAssetTypeOptions] = useState<{ id: number; value: string }[]>([])
  const [assetDomain, setAssetDomain] = useState('')
  const [assetDomainOptions, setAssetDomainOptions] = useState<{ id: number; value: string }[]>([])
  const [assetClass, setAssetClass] = useState('')
  const [assetClassOptions, setAssetClassOptions] = useState<{ id: number; value: string }[]>([])
  const [assetEnvironment, setAssetEnvironment] = useState('')
  const [assetEnvironmentOptions, setAssetEnvironmentOptions] = useState<{ id: number; value: string }[]>([])
  const [assetStatus, setAssetStatus] = useState('')
  const [assetStatusOptions, setAssetStatusOptions] = useState<{ id: number; value: string }[]>([])
  const [department, setDepartment] = useState('')
  const [departmentOptions, setDepartmentOptions] = useState<{ id: number; value: string }[]>([])
  const [businessUnitOptions, setBusinessUnitOptions] = useState<{ id: number; value: string }[]>([])
  const [location, setLocation] = useState('')
  const [locationOptions, setLocationOptions] = useState<{ id: number; value: string }[]>([])
  const [assetGroupMaster, setAssetGroupMaster] = useState('')
  const [assetGroupOptions, setAssetGroupOptions] = useState<{ id: number; value: string }[]>([])
  const [complianceOptions, setComplianceOptions] = useState<{ id: number; value: string }[]>([])
  const [controlsOptions, setControlsOptions] = useState<{ id: number; value: string }[]>([])
  const [tagOptions, setTagOptions] = useState<{ id: number; value: string }[]>([])
  const [exposureOptions, setExposureOptions] = useState<{ id: number; value: string }[]>([])

  useEffect(() => {
    fetch('http://localhost:4001/api/masters/asset_tier')
      .then((res) => res.json())
      .then((data) => {
        setTierOptions(data)
        if (!asset?.criticality && data.length > 0) setCriticality(data[data.length - 1].value)
      })
      .catch((err) => console.error('failed to load tiers', err))

    fetch('http://localhost:4001/api/masters/asset_type')
      .then((res) => res.json())
      .then((data) => {
        setAssetTypeOptions(data)
        if (!asset?.asset_type && data.length > 0) setAssetType(data[0].value)
      })
      .catch((err) => console.error('failed to load asset types', err))

    fetch('http://localhost:4001/api/masters/asset_domain')
      .then((res) => res.json())
      .then((data) => {
        setAssetDomainOptions(data)
        if (data.length > 0) setAssetDomain(data[0].value)
      })
      .catch((err) => console.error('failed to load asset domains', err))

    fetch('http://localhost:4001/api/masters/asset_class')
      .then((res) => res.json())
      .then((data) => {
        setAssetClassOptions(data)
        if (data.length > 0) setAssetClass(data[0].value)
      })
      .catch((err) => console.error('failed to load asset classes', err))

    fetch('http://localhost:4001/api/masters/asset_environment')
      .then((res) => res.json())
      .then((data) => {
        setAssetEnvironmentOptions(data)
        if (data.length > 0) setAssetEnvironment(data[0].value)
      })
      .catch((err) => console.error('failed to load environments', err))

    fetch('http://localhost:4001/api/masters/asset_status')
      .then((res) => res.json())
      .then((data) => {
        setAssetStatusOptions(data)
        if (data.length > 0) setAssetStatus(data[0].value)
      })
      .catch((err) => console.error('failed to load statuses', err))

    fetch('http://localhost:4001/api/masters/department')
      .then((res) => res.json())
      .then((data) => {
        setDepartmentOptions(data)
        if (!asset?.business_unit && data.length > 0) setDepartment(data[0].value)
      })
      .catch((err) => console.error('failed to load departments', err))

    fetch('http://localhost:4001/api/masters/business_unit')
      .then((res) => res.json())
      .then((data) => {
        setBusinessUnitOptions(data)
        if (!asset?.business_unit && data.length > 0) setBusinessUnit(data[0].value)
      })
      .catch((err) => console.error('failed to load business units', err))

    fetch('http://localhost:4001/api/masters/location')
      .then((res) => res.json())
      .then((data) => {
        setLocationOptions(data)
        if (data.length > 0) setLocation(data[0].value)
      })
      .catch((err) => console.error('failed to load locations', err))

    fetch('http://localhost:4001/api/masters/asset_group')
      .then((res) => res.json())
      .then((data) => {
        setAssetGroupOptions(data)
        if (data.length > 0) setAssetGroupMaster(data[0].value)
      })
      .catch((err) => console.error('failed to load asset groups', err))

    fetch('http://localhost:4001/api/masters/regulatory_config')
      .then((res) => res.json())
      .then((data) => setComplianceOptions(data))
      .catch((err) => console.error('failed to load compliance frameworks', err))

    fetch('http://localhost:4001/api/masters/controls')
      .then((res) => res.json())
      .then((data) => setControlsOptions(data))
      .catch((err) => console.error('failed to load controls', err))

    fetch('http://localhost:4001/api/masters/tags')
      .then((res) => res.json())
      .then((data) => setTagOptions(data))
      .catch((err) => console.error('failed to load tags', err))

    fetch('http://localhost:4001/api/masters/exposure')
      .then((res) => res.json())
      .then((data) => setExposureOptions(data))
      .catch((err) => console.error('failed to load exposure', err))
  }, [])
  const [businessUnit, setBusinessUnit] = useState(asset?.business_unit ?? '')
  const [owner, setOwner] = useState(asset?.owner ?? '')
  const [ownerDropdownOpen, setOwnerDropdownOpen] = useState(false)
  const [userList, setUserList] = useState<{ id: number; name: string; email: string }[]>([])

  useEffect(() => {
    fetch('http://localhost:4001/api/users')
      .then((res) => res.json())
      .then(setUserList)
      .catch(() => {})
  }, [])
  const [saving, setSaving] = useState(false)
  const [compliance, setCompliance] = useState<string[]>(asset?.compliance_frameworks ?? [])
  const [controls, setControls] = useState<string[]>([])
  const [tags, setTags] = useState<string[]>([])

  const [errors, setErrors] = useState<Record<string, boolean>>({})

  const validate = () => {
    const newErrors: Record<string, boolean> = {}
    if (!hostname.trim()) newErrors.hostname = true
    if (!ipAddress.trim()) newErrors.ipAddress = true
    if (!assetDomain) newErrors.assetDomain = true
    if (!assetType) newErrors.assetType = true
    if (!exposure) newErrors.exposure = true
    if (!criticality) newErrors.criticality = true
    if (!assetClass) newErrors.assetClass = true
    if (!assetEnvironment) newErrors.assetEnvironment = true
    if (!assetStatus) newErrors.assetStatus = true
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const [dupWarning, setDupWarning] = useState<string | null>(null)

  const handleSave = async (force = false) => {
    if (!validate()) {
      toast.error('Please fill in all required fields, highlighted in red')
      return
    }
    setSaving(true)
    const payload = { hostname, ip_address: ipAddress, fqdn, asset_type: assetType, exposure, criticality, asset_domain: assetDomain, asset_class: assetClass, asset_environment: assetEnvironment, asset_status: assetStatus, department, business_unit: businessUnit, location, asset_group_master: assetGroupMaster, mac_address: macAddress, port: port ? Number(port) : null, url_ssid: urlSsid, user_type: userType, endpoint: endpoints, application_id: applicationId || null, qualys_asset_id: qualysAssetId, qualys_agent_id: qualysAgentId, qualys_netbios_hostname: qualysNetbios, region_vpc_id: regionVpcId, qweb_host_id: qwebHostId, tenable_asset_id: tenableAssetId, tenable_agent_name: tenableAgentName, tenable_repository_name: tenableRepoName, tenable_manager_name: tenableManagerName, compliance_frameworks: compliance, force }
    try {
      const url = isEdit ? `http://localhost:4001/api/assets/${asset!.id}` : 'http://localhost:4001/api/assets'
      const method = isEdit ? 'PUT' : 'POST'
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      if (res.status === 409) {
        const data = await res.json()
        setDupWarning(data.message)
        setSaving(false)
        return
      }
      if (!res.ok) throw new Error('save failed')
      toast.success(isEdit ? `${hostname} updated successfully` : `${hostname} added successfully`)
      onOpenChange(false)
      onSaved?.()
    } catch (err) {
      console.error('save failed', err)
      toast.error(isEdit ? 'Failed to update asset' : 'Failed to add asset')
    } finally {
      setSaving(false)
    }
  }

  const toggleChip = (list: string[], setList: (v: string[]) => void, value: string) => {
    setList(list.includes(value) ? list.filter((v) => v !== value) : [...list, value])
  }


  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full !max-w-[760px] p-0 flex flex-col">
        <SheetHeader className="p-6 pb-0">
          <div className="flex items-center gap-2">
            {isEdit ? <Save size={18} className="text-primary" /> : <Plus size={18} className="text-primary" />}
            <SheetTitle>{isEdit ? 'Edit Asset' : 'Add Asset'}</SheetTitle>
          </div>
          <SheetDescription>{isEdit ? `Update details for ${asset?.hostname}` : 'Register a new asset in the inventory'}</SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          <SectionCard title="Identity">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <FieldLabel required>Hostname</FieldLabel>
                <Input placeholder="e.g. prod-web-01" value={hostname} onChange={(e) => { setHostname(e.target.value); setErrors((p) => ({ ...p, hostname: false })) }} className={errors.hostname ? 'border-red-500 focus-visible:ring-red-500' : ''} />
              </div>
              <div className="space-y-1.5">
                <FieldLabel required>IPv4 Address</FieldLabel>
                <Input placeholder="10.0.1.45" value={ipAddress} onChange={(e) => { setIpAddress(e.target.value); setErrors((p) => ({ ...p, ipAddress: false })) }} className={errors.ipAddress ? 'border-red-500 focus-visible:ring-red-500' : ''} />
              </div>
              <div className="space-y-1.5">
                <FieldLabel>IPv6 Address</FieldLabel>
                <Input placeholder="optional" />
              </div>
              <div className="space-y-1.5">
                <FieldLabel>FQDN</FieldLabel>
                <Input placeholder="host.cybernx.com" value={fqdn} onChange={(e) => setFqdn(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <FieldLabel>MAC Address</FieldLabel>
                <Input placeholder="00:1B:44:11:3A:B7" value={macAddress} onChange={(e) => setMacAddress(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <FieldLabel>Port</FieldLabel>
                <Input type="number" min="1" max="65535" placeholder="443" value={port} onChange={(e) => setPort(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <FieldLabel>User Type</FieldLabel>
                <div className="flex gap-2">
                  {(['Internal', 'External'] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => { setUserType(t); setOwner('') }}
                      className={`flex-1 h-9 text-sm font-medium rounded-md border cursor-pointer transition-colors ${userType === t ? 'bg-blue-600 text-white border-blue-600' : 'border-input text-muted-foreground hover:bg-secondary'}`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-1.5 col-span-2">
                <FieldLabel>Endpoint</FieldLabel>
                <div className="flex gap-2">
                  <Input placeholder="e.g. /api/v1/payments" value={endpointInput} onChange={(e) => setEndpointInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addEndpoint())} />
                  <Button type="button" variant="secondary" onClick={addEndpoint}>Add</Button>
                </div>
                {endpoints.length > 0 && (
                  <div className="rounded-md border border-border overflow-hidden mt-2">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-muted/30 border-b border-border/40">
                          <th className="px-3 py-1.5 text-left text-xs font-semibold text-muted-foreground w-10">#</th>
                          <th className="px-3 py-1.5 text-left text-xs font-semibold text-muted-foreground">Endpoint</th>
                          <th className="px-3 py-1.5 w-10"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/20">
                        {endpoints.map((ep, i) => (
                          <tr key={i}>
                            <td className="px-3 py-1.5 text-xs text-muted-foreground">{i + 1}</td>
                            <td className="px-3 py-1.5 font-mono text-xs text-foreground">{ep}</td>
                            <td className="px-3 py-1.5 text-right">
                              <button type="button" onClick={() => setEndpoints(endpoints.filter((_, idx) => idx !== i))} className="text-red-500 hover:text-red-600 cursor-pointer text-xs">×</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
              <div className="space-y-1.5 col-span-2">
                <FieldLabel>URL / SSID</FieldLabel>
                <Input placeholder="https://app.cybernx.com or WiFi-SSID-Name" value={urlSsid} onChange={(e) => setUrlSsid(e.target.value)} />
              </div>
              <div className="space-y-1.5 col-span-2">
                <FieldLabel>Instance ID</FieldLabel>
                <Input placeholder="i-0abc123 (cloud)" />
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Classification">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <FieldLabel required>Asset Domain</FieldLabel>
                <Select value={assetDomain} onValueChange={(v) => { setAssetDomain(v); setErrors((p) => ({ ...p, assetDomain: false })) }}>
                  <SelectTrigger className={`w-full ${errors.assetDomain ? 'border-red-500 ring-1 ring-red-500' : ''}`}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {assetDomainOptions.map((d) => (
                      <SelectItem key={d.id} value={d.value}>{d.value}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <FieldLabel required>Asset Type</FieldLabel>
                <Select value={assetType} onValueChange={(v) => { setAssetType(v); setErrors((p) => ({ ...p, assetType: false })) }}>
                  <SelectTrigger className={`w-full ${errors.assetType ? 'border-red-500 ring-1 ring-red-500' : ''}`}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {assetTypeOptions.map((t) => (
                      <SelectItem key={t.id} value={t.value}>{t.value}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <FieldLabel required>Exposure</FieldLabel>
                <Select value={exposure} onValueChange={(v) => { setExposure(v); setErrors((p) => ({ ...p, exposure: false })) }}>
                  <SelectTrigger className={`w-full ${errors.exposure ? 'border-red-500 ring-1 ring-red-500' : ''}`}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {exposureOptions.map((e) => (
                      <SelectItem key={e.id} value={e.value}>{e.value}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <FieldLabel>Operating System</FieldLabel>
                <Input placeholder="e.g. Ubuntu 22.04 LTS" />
              </div>
              <div className="space-y-1.5">
                <FieldLabel>OS Version</FieldLabel>
                <Input placeholder="e.g. 22.04.3" />
              </div>
              <div className="space-y-1.5">
                <FieldLabel required>Criticality (Tier)</FieldLabel>
                <Select value={criticality} onValueChange={(v) => { setCriticality(v); setErrors((p) => ({ ...p, criticality: false })) }}>
                  <SelectTrigger className={`w-full ${errors.criticality ? 'border-red-500 ring-1 ring-red-500' : ''}`}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {tierOptions.map((t) => (
                      <SelectItem key={t.id} value={t.value}>{t.value}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-1.5">
                <FieldLabel required>Asset Class</FieldLabel>
                <Select value={assetClass} onValueChange={(v) => { setAssetClass(v); setErrors((p) => ({ ...p, assetClass: false })) }}>
                  <SelectTrigger className={`w-full ${errors.assetClass ? 'border-red-500 ring-1 ring-red-500' : ''}`}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {assetClassOptions.map((c) => (
                      <SelectItem key={c.id} value={c.value}>{c.value}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <FieldLabel required>Asset Environment</FieldLabel>
                <Select value={assetEnvironment} onValueChange={(v) => { setAssetEnvironment(v); setErrors((p) => ({ ...p, assetEnvironment: false })) }}>
                  <SelectTrigger className={`w-full ${errors.assetEnvironment ? 'border-red-500 ring-1 ring-red-500' : ''}`}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {assetEnvironmentOptions.map((e) => (
                      <SelectItem key={e.id} value={e.value}>{e.value}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <FieldLabel required>Asset Status</FieldLabel>
                <Select value={assetStatus} onValueChange={(v) => { setAssetStatus(v); setErrors((p) => ({ ...p, assetStatus: false })) }}>
                  <SelectTrigger className={`w-full ${errors.assetStatus ? 'border-red-500 ring-1 ring-red-500' : ''}`}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {assetStatusOptions.map((s) => (
                      <SelectItem key={s.id} value={s.value}>{s.value}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Ownership &amp; Location">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <FieldLabel>Department</FieldLabel>
                <Select value={department} onValueChange={setDepartment}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {departmentOptions.map((d) => (
                      <SelectItem key={d.id} value={d.value}>{d.value}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <FieldLabel>Business Unit</FieldLabel>
                <Select value={businessUnit} onValueChange={setBusinessUnit}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {businessUnitOptions.map((b) => (
                      <SelectItem key={b.id} value={b.value}>{b.value}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <FieldLabel>Application</FieldLabel>
                <select
                  value={applicationId}
                  onChange={(e) => setApplicationId(e.target.value)}
                  className="w-full h-9 px-2 text-sm rounded-md border border-input bg-background"
                >
                  <option value="">— None —</option>
                  {applicationOptions.map((a) => (
                    <option key={a.id} value={a.id}>{a.app_name} ({a.app_code})</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <FieldLabel>Owner</FieldLabel>
                <div className="relative">
                  <input
                    value={owner}
                    onChange={(e) => { setOwner(e.target.value); setOwnerDropdownOpen(true) }}
                    onFocus={() => setOwnerDropdownOpen(true)}
                    onBlur={() => setTimeout(() => setOwnerDropdownOpen(false), 150)}
                    placeholder="Search users..."
                    className="w-full h-9 pl-3 pr-9 text-sm rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                  />
                  <button type="button" tabIndex={-1} onMouseDown={(e) => e.preventDefault()} onClick={() => setOwnerDropdownOpen((o) => !o)} className="absolute right-0 top-0 h-9 w-9 flex items-center justify-center text-muted-foreground cursor-pointer">
                    <ChevronDown size={15} className={`transition-transform ${ownerDropdownOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {ownerDropdownOpen && (
                    <div className="absolute z-10 mt-1 w-full max-h-40 overflow-y-auto rounded-md border border-border bg-card shadow-lg">
                      {userList.filter((u: any) => (!userType || u.user_type === userType) && (u.name.toLowerCase().includes(owner.toLowerCase()) || u.email.toLowerCase().includes(owner.toLowerCase()))).length === 0 ? (
                        <div className="px-3 py-2 text-sm text-muted-foreground">No matching {userType || ''} users found</div>
                      ) : (
                        userList.filter((u: any) => (!userType || u.user_type === userType) && (u.name.toLowerCase().includes(owner.toLowerCase()) || u.email.toLowerCase().includes(owner.toLowerCase()))).map((u) => (
                          <button key={u.id} type="button" onMouseDown={() => { setOwner(u.email); setOwnerDropdownOpen(false) }} className="w-full text-left px-3 py-2 text-sm hover:bg-muted cursor-pointer">
                            <div className="font-medium text-foreground">{u.name}</div>
                            <div className="text-xs text-muted-foreground">{u.email}</div>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>
              <div className="space-y-1.5">
                <FieldLabel>Location / Data Center</FieldLabel>
                <Select value={location} onValueChange={setLocation}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {locationOptions.map((l) => (
                      <SelectItem key={l.id} value={l.value}>{l.value}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <FieldLabel>Asset Group</FieldLabel>
                <Select value={assetGroupMaster} onValueChange={setAssetGroupMaster}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {assetGroupOptions.map((g) => (
                      <SelectItem key={g.id} value={g.value}>{g.value}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 col-span-2">
                <FieldLabel>Cloud Provider</FieldLabel>
                <Select defaultValue="none">
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— None</SelectItem>
                    {['AWS', 'Azure', 'GCP', 'OCI', 'On-premises'].map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </SectionCard>

          {connectedTools.qualys && (
          <SectionCard title="Tool Integration (Qualys)">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <FieldLabel>Qualys Asset ID</FieldLabel>
                <Input value={qualysAssetId} onChange={(e) => setQualysAssetId(e.target.value)} placeholder="e.g. 123456789" />
              </div>
              <div className="space-y-1.5">
                <FieldLabel>Qualys Agent ID</FieldLabel>
                <Input value={qualysAgentId} onChange={(e) => setQualysAgentId(e.target.value)} placeholder="e.g. a1b2c3d4-..." />
              </div>
              <div className="space-y-1.5">
                <FieldLabel>NetBIOS Hostname</FieldLabel>
                <Input value={qualysNetbios} onChange={(e) => setQualysNetbios(e.target.value)} placeholder="e.g. WEB-PROD-01" />
              </div>
              <div className="space-y-1.5">
                <FieldLabel>Region / VPC ID</FieldLabel>
                <Input value={regionVpcId} onChange={(e) => setRegionVpcId(e.target.value)} placeholder="e.g. ap-south-1 / vpc-0abc123" />
              </div>
              <div className="space-y-1.5 col-span-2">
                <FieldLabel>QWeb Host ID</FieldLabel>
                <Input value={qwebHostId} onChange={(e) => setQwebHostId(e.target.value)} placeholder="e.g. QH-98765" />
              </div>
            </div>
          </SectionCard>
          )}

          {connectedTools.tenable && (
          <SectionCard title="Tool Integration (Tenable)">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <FieldLabel>Tenable Asset ID</FieldLabel>
                <Input value={tenableAssetId} onChange={(e) => setTenableAssetId(e.target.value)} placeholder="e.g. t-9988776" />
              </div>
              <div className="space-y-1.5">
                <FieldLabel>Tenable Agent Name</FieldLabel>
                <Input value={tenableAgentName} onChange={(e) => setTenableAgentName(e.target.value)} placeholder="e.g. agent-web-01" />
              </div>
              <div className="space-y-1.5">
                <FieldLabel>Repository Name</FieldLabel>
                <Input value={tenableRepoName} onChange={(e) => setTenableRepoName(e.target.value)} placeholder="e.g. Production Repo" />
              </div>
              <div className="space-y-1.5">
                <FieldLabel>Manager Name</FieldLabel>
                <Input value={tenableManagerName} onChange={(e) => setTenableManagerName(e.target.value)} placeholder="e.g. tenable-sc-01" />
              </div>
            </div>
          </SectionCard>
          )}

          <SectionCard title="Security &amp; Compliance">
            <div className="space-y-4">
              <div className="space-y-1.5">
                <FieldLabel>Agent</FieldLabel>
                <Select defaultValue="not-installed">
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="not-installed">Not Installed</SelectItem>
                    <SelectItem value="installed">Installed</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <FieldLabel>Compliance Frameworks</FieldLabel>
                <div className="flex flex-wrap gap-2">
                  {complianceOptions.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => toggleChip(compliance, setCompliance, c.value)}
                      className={`px-3 py-1 rounded-full text-xs border font-medium transition-colors cursor-pointer ${
                        compliance.includes(c.value) ? 'bg-blue-600 text-white border-blue-600' : 'border-input text-muted-foreground hover:bg-secondary'
                      }`}
                    >
                      {c.value}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <FieldLabel>Compensating Controls</FieldLabel>
                <div className="flex flex-wrap gap-2">
                  {controlsOptions.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => toggleChip(controls, setControls, c.value)}
                      className={`px-3 py-1 rounded-full text-xs border font-medium transition-colors cursor-pointer ${
                        controls.includes(c.value) ? 'bg-green-600 text-white border-green-600' : 'border-input text-muted-foreground hover:bg-secondary'
                      }`}
                    >
                      {c.value}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <FieldLabel>Tags</FieldLabel>
                <div className="flex flex-wrap gap-2">
                  {tagOptions.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => toggleChip(tags, setTags, t.value)}
                      className={`px-3 py-1 rounded-full text-xs border font-medium transition-colors cursor-pointer ${
                        tags.includes(t.value) ? 'bg-purple-600 text-white border-purple-600' : 'border-input text-muted-foreground hover:bg-secondary'
                      }`}
                    >
                      {t.value}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </SectionCard>

          <p className="text-xs text-muted-foreground border-t border-border pt-4">
            Vulnerability counts and risk score are computed from scanner findings after the asset is created.
          </p>
        </div>

        <div className="flex items-center justify-end gap-2 p-4 border-t border-border">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => handleSave(false)} disabled={saving}>
            {isEdit ? <Save size={16} className="mr-1" /> : <Plus size={16} className="mr-1" />}
            {saving ? 'Saving...' : isEdit ? 'Save Changes' : 'Add Asset'}
          </Button>
        </div>
      </SheetContent>

      {dupWarning && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40" onClick={() => setDupWarning(null)}>
          <div className="bg-card rounded-2xl shadow-2xl w-[420px]" onClick={(e) => e.stopPropagation()}>
            <div className="p-5 space-y-3">
              <h3 className="font-bold text-foreground text-sm">Possible Duplicate Asset</h3>
              <p className="text-sm text-muted-foreground">{dupWarning}</p>
              <p className="text-xs text-muted-foreground">This match was found using IP+FQDN, IP+Location, Hostname+Domain+Environment, or IP+MAC. You can proceed anyway if this is genuinely a different asset.</p>
            </div>
            <div className="px-5 py-4 border-t border-border flex justify-end gap-2">
              <button onClick={() => setDupWarning(null)} className="h-9 px-4 text-sm font-semibold rounded-lg border border-border hover:bg-muted/50 cursor-pointer">Cancel</button>
              <button onClick={() => { setDupWarning(null); handleSave(true) }} className="h-9 px-4 text-sm font-semibold rounded-lg bg-amber-600 text-white hover:bg-amber-700 cursor-pointer">Add Anyway</button>
            </div>
          </div>
        </div>
      )}
    </Sheet>
  )
}