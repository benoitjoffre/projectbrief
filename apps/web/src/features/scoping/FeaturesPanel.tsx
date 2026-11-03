import { useState } from 'react'
import { api, ApiError } from '../../api/client'
import {
  FEATURE_PRIORITIES,
  PRIORITY_LABELS,
  type Feature,
  type FeatureInput,
  type FeaturePriority,
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
import { PRIORITY_STYLES } from './styles'

function FeatureForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial?: Feature
  submitLabel: string
  onSubmit: (data: FeatureInput) => Promise<void>
  onCancel?: () => void
}) {
  const [title, setTitle] = useState(initial?.title ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [priority, setPriority] = useState<FeaturePriority>(initial?.priority ?? 'COULD')
  const [criteria, setCriteria] = useState(initial?.acceptanceCriteria ?? '')
  const [error, setError] = useState<ApiError | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await onSubmit({ title, description, priority, acceptanceCriteria: criteria })
      if (!initial) {
        setTitle('')
        setDescription('')
        setPriority('COULD')
        setCriteria('')
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
        <div className="sm:col-span-2">
          <Field label="Titre" error={error?.fields.title}>
            <input className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} required />
          </Field>
        </div>
        <Field label="Priorité (MoSCoW)">
          <select
            className={inputClass}
            value={priority}
            onChange={(e) => setPriority(e.target.value as FeaturePriority)}
          >
            {FEATURE_PRIORITIES.map((p) => (
              <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>
            ))}
          </select>
        </Field>
      </div>
      <Field label="Description">
        <textarea className={inputClass} rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
      </Field>
      <Field label="Critères d’acceptation">
        <textarea className={inputClass} rows={3} value={criteria} onChange={(e) => setCriteria(e.target.value)} />
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

export function FeaturesPanel({ projectId }: { projectId: string }) {
  const { data, error, loading, reload } = useApi<Feature[]>(`/api/projects/${projectId}/features`)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  if (loading) return <Loading />
  if (error) return <ErrorMessage message={error.message} onRetry={reload} />

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
      {actionError && <ErrorMessage message={actionError} />}
      {data?.length === 0 ? (
        <EmptyState message="Aucune fonctionnalité définie pour ce projet." />
      ) : (
        <ul className="space-y-3">
          {data?.map((f) => (
            <li key={f.id} className="rounded-lg border border-slate-200 bg-white p-4">
              {editingId === f.id ? (
                <FeatureForm
                  initial={f}
                  submitLabel="Enregistrer"
                  onCancel={() => setEditingId(null)}
                  onSubmit={async (d) => {
                    await api.updateFeature(projectId, f.id, d)
                    setEditingId(null)
                    reload()
                  }}
                />
              ) : (
                <>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <h3 className="font-medium text-slate-900">{f.title}</h3>
                    <select
                      aria-label={`Priorité de ${f.title}`}
                      value={f.priority}
                      onChange={(e) =>
                        run(() => api.updateFeature(projectId, f.id, { priority: e.target.value as FeaturePriority }))
                      }
                      className={`rounded-full border-0 px-2.5 py-0.5 text-xs font-medium ${PRIORITY_STYLES[f.priority]}`}
                    >
                      {FEATURE_PRIORITIES.map((p) => (
                        <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>
                      ))}
                    </select>
                  </div>
                  {f.description && <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">{f.description}</p>}
                  {f.acceptanceCriteria && (
                    <div className="mt-2 rounded bg-slate-50 p-2 text-sm">
                      <p className="text-xs font-medium text-slate-500">Critères d’acceptation</p>
                      <p className="whitespace-pre-wrap text-slate-700">{f.acceptanceCriteria}</p>
                    </div>
                  )}
                  <div className="mt-3 flex gap-3 text-sm">
                    <button onClick={() => setEditingId(f.id)} className="text-indigo-600 hover:underline">Modifier</button>
                    <button
                      onClick={() => {
                        if (window.confirm(`Supprimer « ${f.title} » ?`)) void run(() => api.deleteFeature(projectId, f.id))
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
        <h3 className="mb-2 text-sm font-semibold text-slate-700">Ajouter une fonctionnalité</h3>
        <FeatureForm
          submitLabel="Ajouter"
          onSubmit={async (d) => {
            await api.createFeature(projectId, d)
            reload()
          }}
        />
      </div>
    </div>
  )
}
