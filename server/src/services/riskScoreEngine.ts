// Risk score engine — rebuilt per Kapil's revised spec (NXRadar-Vulnerabilities-1.md)
// Composite Risk Score = Σ(Si × Wi) / ΣWi, normalized 0-100.
// Replaces the earlier A+B+C+D/10 model entirely.

type Severity = 'Critical' | 'High' | 'Medium' | 'Low' | 'Info'
type Exposure = 'Internet' | 'Intranet' | string
type Tier = 'Tier 0' | 'Tier 1' | 'Tier 2' | 'Tier 3' | 'Tier 4'

const WEIGHTS = {
  severity: 30,
  cisaKev: 20,
  epss: 15,
  assetCriticality: 15,
  assetExposure: 12,
  slaAge: 8,
}

function isInternetFacing(exposure: Exposure) {
  return exposure === 'Internet' || exposure === 'Internet Facing' || exposure === 'Public'
}

// Factor 1: Severity — CVSS bands, falls back to qualitative Source Risk when CVSS is absent
function severitySignal(cvssScore: number | null, sourceRisk: Severity): number {
  const cvss = cvssScore
  if (cvss != null) {
    if (cvss >= 9.0) return 1
    if (cvss >= 7.0) return 0.75
    if (cvss >= 4.0) return 0.45
    if (cvss >= 0.1) return 0.2
    return 0
  }
  if (sourceRisk === 'Critical') return 1
  if (sourceRisk === 'High') return 0.75
  if (sourceRisk === 'Medium') return 0.45
  if (sourceRisk === 'Low') return 0.2
  return 0
}

// Factor 2: CISA KEV, ransomware use lifts the signal
function cisaKevSignal(isKev: boolean, isRansomware: boolean): number {
  if (isKev && isRansomware) return 1
  if (isKev) return 0.8
  return 0
}

// Factor 3: EPSS — direct probability passthrough
function epssSignal(epssScore: number | null): number {
  return epssScore ?? 0
}

// Factor 4: Asset Criticality — Tier 0-4
const TIER_SIGNAL: Record<Tier, number> = {
  'Tier 0': 1,
  'Tier 1': 0.8,
  'Tier 2': 0.5,
  'Tier 3': 0.25,
  'Tier 4': 0.1,
}
function assetCriticalitySignal(tier: string | null): number {
  return TIER_SIGNAL[tier as Tier] ?? TIER_SIGNAL['Tier 3']
}

// Factor 5: Asset Exposure
function assetExposureSignal(exposure: Exposure): number {
  return isInternetFacing(exposure) ? 1 : 0.3
}

// Factor 6: SLA & Age
function slaAgeSignal(isBreached: boolean): number {
  return isBreached ? 1 : 0
}

function ratingFromScore(score: number): 'Critical' | 'High' | 'Medium' | 'Low' {
  if (score >= 70) return 'Critical'
  if (score >= 47) return 'High'
  if (score >= 27) return 'Medium'
  return 'Low'
}

// SLA matrix — unchanged from the original spec, still governs breach detection
const SLA_MATRIX: Record<Tier, Record<Severity, number>> = {
  'Tier 0': { Critical: 2, High: 7, Medium: 15, Low: 30, Info: Infinity },
  'Tier 1': { Critical: 7, High: 15, Medium: 30, Low: 60, Info: Infinity },
  'Tier 2': { Critical: 15, High: 30, Medium: 60, Low: 90, Info: Infinity },
  'Tier 3': { Critical: 30, High: 45, Medium: 90, Low: 120, Info: Infinity },
  'Tier 4': { Critical: 45, High: 60, Medium: 120, Low: 180, Info: Infinity },
}

export function effectiveSlaDays(tier: Tier, severity: Severity, exposure: Exposure, cisaKev: boolean, certInAdvisory: boolean): number {
  if (cisaKev || certInAdvisory) return 2
  const baseDays = SLA_MATRIX[tier]?.[severity] ?? SLA_MATRIX['Tier 3'][severity]
  if (isInternetFacing(exposure) && (severity === 'Critical' || severity === 'High')) {
    return Math.min(baseDays, SLA_MATRIX['Tier 0'][severity])
  }
  return baseDays
}

export function complianceStatus(publishedAt: Date, slaDays: number, isRemediated: boolean, now: Date = new Date()): 'Compliant' | 'Overdue' {
  if (isRemediated) return 'Compliant'
  const deadline = new Date(publishedAt)
  deadline.setDate(deadline.getDate() + slaDays)
  return now > deadline ? 'Overdue' : 'Compliant'
}

export interface RiskInput {
  cvssScore: number | null
  sourceRisk: Severity
  cisaKev: boolean
  cisaRansomware: boolean
  epssScore: number | null
  assetTier: string | null
  exposure: Exposure
  certInAdvisory: boolean
  publishedAt: Date
  isRemediated: boolean
}

export interface RiskFactorBreakdown {
  factor: string
  signal: number
  weight: number
  contribution: number
}

export interface RiskResult {
  score: number
  rating: 'Critical' | 'High' | 'Medium' | 'Low'
  breakdown: RiskFactorBreakdown[]
  slaDays: number
  complianceStatus: 'Compliant' | 'Overdue'
  complianceExpiryDate: Date
}

export function calculateCompositeRisk(input: RiskInput): RiskResult {
  const tier = (input.assetTier ?? 'Tier 3') as Tier
  const slaDays = effectiveSlaDays(tier, input.sourceRisk, input.exposure, input.cisaKev, input.certInAdvisory)
  const expiryDate = new Date(input.publishedAt)
  expiryDate.setDate(expiryDate.getDate() + slaDays)
  const status = complianceStatus(input.publishedAt, slaDays, input.isRemediated)

  const signals = {
    severity: severitySignal(input.cvssScore, input.sourceRisk),
    cisaKev: cisaKevSignal(input.cisaKev, input.cisaRansomware),
    epss: epssSignal(input.epssScore),
    assetCriticality: assetCriticalitySignal(input.assetTier),
    assetExposure: assetExposureSignal(input.exposure),
    slaAge: slaAgeSignal(status === 'Overdue'),
  }

  const breakdown: RiskFactorBreakdown[] = [
    { factor: 'Severity (CVSS)', signal: signals.severity, weight: WEIGHTS.severity, contribution: signals.severity * WEIGHTS.severity },
    { factor: 'CISA KEV', signal: signals.cisaKev, weight: WEIGHTS.cisaKev, contribution: signals.cisaKev * WEIGHTS.cisaKev },
    { factor: 'EPSS', signal: signals.epss, weight: WEIGHTS.epss, contribution: signals.epss * WEIGHTS.epss },
    { factor: 'Asset Criticality', signal: signals.assetCriticality, weight: WEIGHTS.assetCriticality, contribution: signals.assetCriticality * WEIGHTS.assetCriticality },
    { factor: 'Asset Exposure', signal: signals.assetExposure, weight: WEIGHTS.assetExposure, contribution: signals.assetExposure * WEIGHTS.assetExposure },
    { factor: 'SLA & Age', signal: signals.slaAge, weight: WEIGHTS.slaAge, contribution: signals.slaAge * WEIGHTS.slaAge },
  ]

  const totalWeight = breakdown.reduce((sum, b) => sum + b.weight, 0)
  const totalContribution = breakdown.reduce((sum, b) => sum + b.contribution, 0)
  const score = Math.round((totalContribution / totalWeight) * 100)

  return {
    score,
    rating: ratingFromScore(score),
    breakdown,
    slaDays,
    complianceStatus: status,
    complianceExpiryDate: expiryDate,
  }
}