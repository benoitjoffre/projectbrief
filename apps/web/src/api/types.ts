export const PROJECT_TYPES = ['WEBSITE', 'WEB_APP', 'SAAS', 'API', 'OTHER'] as const
export const PROJECT_STATUSES = ['DRAFT', 'DISCOVERY', 'SCOPING', 'READY', 'ARCHIVED'] as const
export type ProjectType = (typeof PROJECT_TYPES)[number]
export type ProjectStatus = (typeof PROJECT_STATUSES)[number]

export const TYPE_LABELS: Record<ProjectType, string> = {
  WEBSITE: 'Site web',
  WEB_APP: 'Application web',
  SAAS: 'SaaS',
  API: 'API',
  OTHER: 'Autre',
}

export const STATUS_LABELS: Record<ProjectStatus, string> = {
  DRAFT: 'Brouillon',
  DISCOVERY: 'Découverte',
  SCOPING: 'Cadrage',
  READY: 'Prêt',
  ARCHIVED: 'Archivé',
}

export interface Client {
  id: string
  name: string
  email: string | null
  phone: string | null
  company: string | null
  createdAt: string
  updatedAt: string
}

export interface Project {
  id: string
  clientId: string
  name: string
  description: string | null
  objective: string | null
  type: ProjectType
  status: ProjectStatus
  deadline: string | null
  createdAt: string
  updatedAt: string
  client?: Client
}

export type ClientInput = Pick<Client, 'name'> & Partial<Pick<Client, 'email' | 'phone' | 'company'>>
export type ProjectInput = Partial<
  Pick<Project, 'name' | 'description' | 'objective' | 'type' | 'status' | 'deadline'>
> & { clientId?: string }

export interface Question {
  id: string
  categoryId: string
  label: string
  helpText: string | null
  sortOrder: number
}

export interface QuestionCategory {
  id: string
  title: string
  description: string | null
  sortOrder: number
  questions: Question[]
}

export interface Answer {
  id: string
  projectId: string
  questionId: string
  questionText: string
  value: string
  isReviewed: boolean
  createdAt: string
  updatedAt: string
}

export interface DiscoveryProgress {
  totalQuestions: number
  reviewedQuestions: number
  percentage: number
}

export type AnswerInput = Pick<Answer, 'value' | 'isReviewed'>

export const FEATURE_PRIORITIES = ['MUST', 'SHOULD', 'COULD', 'WONT'] as const
export type FeaturePriority = (typeof FEATURE_PRIORITIES)[number]

export const PRIORITY_LABELS: Record<FeaturePriority, string> = {
  MUST: 'Must — indispensable',
  SHOULD: 'Should — important',
  COULD: 'Could — souhaitable',
  WONT: 'Won’t — hors périmètre',
}

export interface Feature {
  id: string
  projectId: string
  title: string
  description: string | null
  priority: FeaturePriority
  acceptanceCriteria: string | null
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export type FeatureInput = Partial<
  Pick<Feature, 'title' | 'description' | 'priority' | 'acceptanceCriteria' | 'sortOrder'>
>

export const SCOPING_TYPES = [
  'CONSTRAINT',
  'RISK',
  'DEPENDENCY',
  'ASSUMPTION',
  'DECISION',
  'OPEN_QUESTION',
] as const
export const SCOPING_STATUSES = ['OPEN', 'IN_PROGRESS', 'RESOLVED'] as const
export const SCOPING_SEVERITIES = ['LOW', 'MEDIUM', 'HIGH'] as const
export type ScopingType = (typeof SCOPING_TYPES)[number]
export type ScopingStatus = (typeof SCOPING_STATUSES)[number]
export type ScopingSeverity = (typeof SCOPING_SEVERITIES)[number]

export const SCOPING_TYPE_LABELS: Record<ScopingType, string> = {
  CONSTRAINT: 'Contraintes',
  RISK: 'Risques',
  DEPENDENCY: 'Dépendances',
  ASSUMPTION: 'Hypothèses',
  DECISION: 'Décisions',
  OPEN_QUESTION: 'Questions ouvertes',
}
export const SCOPING_STATUS_LABELS: Record<ScopingStatus, string> = {
  OPEN: 'Ouvert',
  IN_PROGRESS: 'En cours',
  RESOLVED: 'Résolu',
}
export const SEVERITY_LABELS: Record<ScopingSeverity, string> = {
  LOW: 'Faible',
  MEDIUM: 'Moyenne',
  HIGH: 'Élevée',
}

export interface ScopingItem {
  id: string
  projectId: string
  type: ScopingType
  title: string
  description: string | null
  status: ScopingStatus
  severity: ScopingSeverity | null
  resolution: string | null
  createdAt: string
  updatedAt: string
}

export type ScopingItemInput = Partial<
  Pick<ScopingItem, 'type' | 'title' | 'description' | 'status' | 'severity' | 'resolution'>
>

export interface ProjectSummary {
  project: Project
  client: Client | null
  discovery: DiscoveryProgress
  features: Record<FeaturePriority, Feature[]>
  mvp: Feature[]
  scopingItems: Record<ScopingType, ScopingItem[]>
  openQuestions: ScopingItem[]
  unresolvedHighRisks: ScopingItem[]
  decisionsCount: number
}
