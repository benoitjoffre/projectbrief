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
