import type { FeaturePriority, ScopingSeverity } from '../../api/types'

export const PRIORITY_STYLES: Record<FeaturePriority, string> = {
  MUST: 'bg-red-100 text-red-800',
  SHOULD: 'bg-amber-100 text-amber-800',
  COULD: 'bg-blue-100 text-blue-800',
  WONT: 'bg-slate-200 text-slate-600',
}

export const SEVERITY_STYLES: Record<ScopingSeverity, string> = {
  LOW: 'bg-green-100 text-green-800',
  MEDIUM: 'bg-amber-100 text-amber-800',
  HIGH: 'bg-red-100 text-red-800',
}
