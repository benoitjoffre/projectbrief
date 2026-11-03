import type {
  Answer,
  AnswerInput,
  Client,
  ClientInput,
  Feature,
  FeatureInput,
  Project,
  ProjectInput,
  ScopingItem,
  ScopingItemInput,
} from './types'

const BASE = import.meta.env.VITE_API_URL ?? ''

export class ApiError extends Error {
  status: number
  fields: Record<string, string>
  constructor(status: number, message: string, fields: Record<string, string> = {}) {
    super(message)
    this.status = status
    this.fields = fields
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${BASE}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...init?.headers },
    })
  } catch {
    throw new ApiError(0, "Impossible de joindre l'API. Est-elle démarrée ?")
  }
  const body = await res.json().catch(() => null)
  if (!res.ok) {
    const err = body?.error
    const fields: Record<string, string> = {}
    for (const d of err?.details ?? []) if (d.path && !fields[d.path]) fields[d.path] = d.message
    throw new ApiError(res.status, err?.message ?? `Erreur ${res.status}`, fields)
  }
  return body as T
}

const send = (method: string, body: unknown): RequestInit => ({ method, body: JSON.stringify(body) })

export const api = {
  get: <T>(path: string) => request<T>(path),
  createClient: (data: ClientInput) => request<Client>('/api/clients', send('POST', data)),
  createProject: (data: ProjectInput) => request<Project>('/api/projects', send('POST', data)),
  updateProject: (id: string, data: ProjectInput) =>
    request<Project>(`/api/projects/${id}`, send('PATCH', data)),
  saveAnswer: (projectId: string, questionId: string, data: AnswerInput) =>
    request<Answer>(`/api/projects/${projectId}/answers/${questionId}`, send('PUT', data)),
  createFeature: (projectId: string, data: FeatureInput) =>
    request<Feature>(`/api/projects/${projectId}/features`, send('POST', data)),
  updateFeature: (projectId: string, id: string, data: FeatureInput) =>
    request<Feature>(`/api/projects/${projectId}/features/${id}`, send('PATCH', data)),
  deleteFeature: (projectId: string, id: string) =>
    request<null>(`/api/projects/${projectId}/features/${id}`, { method: 'DELETE' }),
  createScopingItem: (projectId: string, data: ScopingItemInput) =>
    request<ScopingItem>(`/api/projects/${projectId}/scoping-items`, send('POST', data)),
  updateScopingItem: (projectId: string, id: string, data: ScopingItemInput) =>
    request<ScopingItem>(`/api/projects/${projectId}/scoping-items/${id}`, send('PATCH', data)),
  deleteScopingItem: (projectId: string, id: string) =>
    request<null>(`/api/projects/${projectId}/scoping-items/${id}`, { method: 'DELETE' }),
}
