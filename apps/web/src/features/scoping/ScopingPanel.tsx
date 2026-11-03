import { useState } from 'react'
import { api, ApiError } from '../../api/client'
import {
  SCOPING_SEVERITIES,
  SCOPING_STATUSES,
  SCOPING_STATUS_LABELS,
  SCOPING_TYPES,
  SCOPING_TYPE_LABELS,
  SEVERITY_LABELS,
  type ScopingItem,
  type ScopingItemInput,
  type ScopingSeverity,
  type ScopingStatus,
  type ScopingType,
} from '../../api/types'
import {
  EmptyState,
  ErrorMessage,
  Field,
  inputClass,
  Loading,
  primaryButton,
  secondaryButton,
} from '../../components/ui'
import { useApi } from '../../hooks/useApi'
import { SEVERITY_STYLES } from './styles'

function ItemForm({
  initial,
  defaultType,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial?: ScopingItem
  defaultType: ScopingType
  submitLabel: string
  onSubmit: (data: ScopingItemInput) => Promise<void>
  onCancel?: () => void
}) {
  const [type, setType] = useState<ScopingType>(initial?.type ?? defaultType)
  const [title, setTitle] = useState(initial?.title ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [status, setStatus] = useState<ScopingStatus>(initial?.status ?? 'OPEN')
  const [severity, setSeverity] = useState<ScopingSeverity | ''>(initial?.severity ?? '')
  const [resolution, setResolution] = useState(initial?.resolution ?? '')
  const [error, setError] = useState<ApiError | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await onSubmit({
        type,
        title,
        description,
        status,
        severity: severity || null,
        resolution,
      })
      if (!initial) {
        setTitle('')
        setDescription('')
        setStatus('OPEN')
        setSeverity('')
        setResolution('')
      }
    } catch (err) {
      setError(err as ApiError)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
      {error && <p role="alert" className="text-sm text-red-700">{error.message}</p>}
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Type">
          <select className={inputClass} value={type} onChange={(e) => setType(e.target.value as ScopingType)}>
            {SCOPING_TYPES.map((t) => (
              <option key={t} value={t}>{SCOPING_TYPE_LABELS[t]}</option>
            ))}
          </select>
        </Field>
        <div className="sm:col-span-2">
          <Field label="Titre" error={error?.fields.title}>
            <input className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} required />
          </Field>
        </div>
      </div>
      <Field label="Description">
        <textarea className={inputClass} rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Statut">
          <select className={inputClass} value={status} onChange={(e) => setStatus(e.target.value as ScopingStatus)}>
            {SCOPING_STATUSES.map((s) => (
              <option key={s} value={s}>{SCOPING_STATUS_LABELS[s]}</option>
            ))}
          </select>
        </Field>
        <Field label="Sévérité (surtout pour les risques)">
          <select className={inputClass} value={severity} onChange={(e) => setSeverity(e.target.value as ScopingSeverity | '')}>
            <option value="">—</option>
            {SCOPING_SEVERITIES.map((s) => (
              <option key={s} value={s}>{SEVERITY_LABELS[s]}</option>
            ))}
          </select>
        </Field>
      </div>
      <Field label="Résolution / décision / solution">
        <textarea className={inputClass} rows={2} value={resolution} onChange={(e) => setResolution(e.target.value)} />
      </Field>
      <div className="flex gap-2">
        <button disabled={busy} className={primaryButton}>{submitLabel}</button>
        {onCancel && (
          <button type="button" onClick={onCancel} className={secondaryButton}>Annuler</button>
        )}
      </div>
    </form>
  )
}

export function ScopingPanel({ projectId }: { projectId: string }) {
  const [filter, setFilter] = useState<ScopingType | 'ALL'>('ALL')
  const query = filter === 'ALL' ? '' : `?type=${filter}`
  const { data, error, loading, reload } = useApi<ScopingItem[]>(
    `/api/projects/${projectId}/scoping-items${query}`,
  )
  const [editingId, setEditingId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const run = async (fn: () => Promise<unknown>) => {
    setActionError(null)
    try {
      await fn()
      reload()
    } catch (err) {
      setActionError((err as ApiError).message)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrer par type">
        {(['ALL', ...SCOPING_TYPES] as const).map((t) => (
          <button
            key={t}
            onClick={() => setFilter(t)}
            aria-pressed={filter === t}
            className={`rounded-full border px-3 py-1 text-sm ${
              filter === t
                ? 'border-indigo-600 bg-indigo-50 font-medium text-indigo-800'
                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            {t === 'ALL' ? 'Tous' : SCOPING_TYPE_LABELS[t]}
          </button>
        ))}
      </div>

      {actionError && <ErrorMessage message={actionError} />}
      {loading ? (
        <Loading />
      ) : error ? (
        <ErrorMessage message={error.message} onRetry={reload} />
      ) : data?.length === 0 ? (
        <EmptyState message="Aucun élément de cadrage." />
      ) : (
        <ul className="space-y-3">
          {data?.map((it) => (
            <li key={it.id} className="rounded-lg border border-slate-200 bg-white p-4">
              {editingId === it.id ? (
                <ItemForm
                  initial={it}
                  defaultType={it.type}
                  submitLabel="Enregistrer"
                  onCancel={() => setEditingId(null)}
                  onSubmit={async (d) => {
                    await api.updateScopingItem(projectId, it.id, d)
                    setEditingId(null)
                    reload()
                  }}
                />
              ) : (
                <>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                        {SCOPING_TYPE_LABELS[it.type]}
                      </span>
                      <h3 className="font-medium text-slate-900">{it.title}</h3>
                    </div>
                    <div className="flex items-center gap-2">
                      {it.severity && (
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${SEVERITY_STYLES[it.severity]}`}>
                          {SEVERITY_LABELS[it.severity]}
                        </span>
                      )}
                      <select
                        aria-label={`Statut de ${it.title}`}
                        value={it.status}
                        onChange={(e) =>
                          run(() => api.updateScopingItem(projectId, it.id, { status: e.target.value as ScopingStatus }))
                        }
                        className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs"
                      >
                        {SCOPING_STATUSES.map((s) => (
                          <option key={s} value={s}>{SCOPING_STATUS_LABELS[s]}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  {it.description && <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">{it.description}</p>}
                  {it.resolution && (
                    <div className="mt-2 rounded bg-green-50 p-2 text-sm">
                      <p className="text-xs font-medium text-green-800">Résolution</p>
                      <p className="whitespace-pre-wrap text-slate-700">{it.resolution}</p>
                    </div>
                  )}
                  <div className="mt-3 flex gap-3 text-sm">
                    <button onClick={() => setEditingId(it.id)} className="text-indigo-600 hover:underline">Modifier</button>
                    <button
                      onClick={() => {
                        if (window.confirm(`Supprimer « ${it.title} » ?`)) void run(() => api.deleteScopingItem(projectId, it.id))
                      }}
                      className="text-red-600 hover:underline"
                    >
                      Supprimer
                    </button>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      <div>
        <h3 className="mb-2 text-sm font-semibold text-slate-700">Ajouter un élément</h3>
        <ItemForm
          key={filter}
          defaultType={filter === 'ALL' ? 'CONSTRAINT' : filter}
          submitLabel="Ajouter"
          onSubmit={async (d) => {
            await api.createScopingItem(projectId, d)
            reload()
          }}
        />
      </div>
    </div>
  )
}
