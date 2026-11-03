import type {
  Answer,
  AnswerInput,
  Client,
  ClientInput,
  CreatedShare,
  DocumentOptions,
  Feature,
  FeatureInput,
  Project,
  ProjectInput,
  PublicAnswerSaved,
  PublicQuestionnaire,
  ScopingItem,
  ScopingItemInput,
  ShareStatus,
} from './types'

const BASE = import.meta.env.VITE_API_URL ?? ''

export class ApiError extends Error {
  status: number
  fields: Record<string, string>
  /** Code applicatif du serveur (ex. STALE_WRITE, ALREADY_COMPLETED). */
  code: string | null
  /** Données additionnelles du serveur (ex. réponse courante lors d'un conflit). */
  current: StaleAnswer | null
  constructor(
    status: number,
    message: string,
    fields: Record<string, string> = {},
    code: string | null = null,
    current: StaleAnswer | null = null,
  ) {
    super(message)
    this.status = status
    this.fields = fields
    this.code = code
    this.current = current
  }
}

export interface StaleAnswer {
  value: string
  isReviewed: boolean
  updatedAt: string
}

// Garde-fou minimal en attendant une vraie authentification : jeton Bearer des routes d'administration.
// Attention : une variable VITE_* est visible dans le bundle ; à ne pas utiliser comme secret en production publique.
const ADMIN_TOKEN = import.meta.env.VITE_ADMIN_TOKEN as string | undefined
const authHeaders = (path: string): Record<string, string> =>
  ADMIN_TOKEN && !path.startsWith('/api/public') ? { Authorization: `Bearer ${ADMIN_TOKEN}` } : {}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${BASE}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...authHeaders(path), ...init?.headers },
    })
  } catch {
    throw new ApiError(0, "Impossible de joindre l'API. Est-elle démarrée ?")
  }
  const body = await res.json().catch(() => null)
  if (!res.ok) throw toApiError(res.status, body)
  return body as T
}

interface ErrorBody {
  error?: { code?: string; message?: string; current?: StaleAnswer; details?: Array<{ path?: string; message: string }> }
}

function toApiError(status: number, body: ErrorBody | null) {
  const err = body?.error
  const fields: Record<string, string> = {}
  for (const d of err?.details ?? []) if (d.path && !fields[d.path]) fields[d.path] = d.message
  return new ApiError(status, err?.message ?? `Erreur ${status}`, fields, err?.code ?? null, err?.current ?? null)
}

export interface PdfResult {
  blob: Blob
  /** Nom de fichier proposé par le serveur (en-tête Content-Disposition), s'il est présent. */
  filename: string | null
}

/** Génère le PDF (aperçu ou téléchargement) : mêmes options, même service côté serveur. */
export async function fetchPdf(
  projectId: string,
  kind: 'preview' | 'download',
  options: DocumentOptions,
): Promise<PdfResult> {
  let res: Response
  try {
    res = await fetch(`${BASE}/api/projects/${projectId}/document/${kind}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders('/api') },
      body: JSON.stringify(options),
    })
  } catch {
    throw new ApiError(0, "Impossible de joindre l'API. Est-elle démarrée ?")
  }
  if (!res.ok) throw toApiError(res.status, await res.json().catch(() => null))
  if (!res.headers.get('Content-Type')?.startsWith('application/pdf')) {
    throw new ApiError(res.status, 'Réponse inattendue du serveur (PDF attendu).')
  }
  const match = /filename="([^"]+)"/.exec(res.headers.get('Content-Disposition') ?? '')
  return { blob: await res.blob(), filename: match?.[1] ?? null }
}

const send = (method: string, body: unknown): RequestInit => ({ method, body: JSON.stringify(body) })

export const api = {
  get: <T>(path: string) => request<T>(path),
  createClient: (data: ClientInput) => request<Client>('/api/clients', send('POST', data)),
  createProject: (data: ProjectInput) => request<Project>('/api/projects', send('POST', data)),
  updateProject: (id: string, data: ProjectInput) =>
    request<Project>(`/api/projects/${id}`, send('PATCH', data)),
  saveAnswer: (projectId: string, questionId: string, data: AnswerInput & { expectedUpdatedAt?: string | null }) =>
    request<Answer>(`/api/projects/${projectId}/answers/${questionId}`, send('PUT', data)),
  getShare: (projectId: string) => request<ShareStatus>(`/api/projects/${projectId}/questionnaire-share`),
  createShare: (projectId: string) =>
    request<CreatedShare>(`/api/projects/${projectId}/questionnaire-share`, { method: 'POST' }),
  revokeShare: (projectId: string) =>
    request<ShareStatus>(`/api/projects/${projectId}/questionnaire-share`, { method: 'DELETE' }),
  getPublicQuestionnaire: (token: string) =>
    request<PublicQuestionnaire>(`/api/public/questionnaires/${encodeURIComponent(token)}`),
  savePublicAnswer: (token: string, questionId: string, data: { value: string; expectedUpdatedAt: string | null }) =>
    request<PublicAnswerSaved>(
      `/api/public/questionnaires/${encodeURIComponent(token)}/answers/${questionId}`,
      send('PUT', data),
    ),
  completePublic: (token: string) =>
    request<{ completedAt: string }>(`/api/public/questionnaires/${encodeURIComponent(token)}/complete`, {
      method: 'POST',
    }),
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
