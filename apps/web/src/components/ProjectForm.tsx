import { useState, type FormEvent } from 'react'
import { ApiError } from '../api/client'
import {
  PROJECT_STATUSES,
  PROJECT_TYPES,
  STATUS_LABELS,
  TYPE_LABELS,
  type Client,
  type Project,
  type ProjectInput,
  type ProjectStatus,
  type ProjectType,
} from '../api/types'
import { ErrorMessage, Field, inputClass, primaryButton, secondaryButton } from './ui'

interface Props {
  /** Création : liste des clients. Édition : projet existant (client non modifiable). */
  clients?: Client[]
  initial?: Project
  defaultClientId?: string
  submitLabel: string
  onSubmit: (data: ProjectInput) => Promise<void>
  onCancel: () => void
}

export function ProjectForm({ clients, initial, defaultClientId, submitLabel, onSubmit, onCancel }: Props) {
  const [clientId, setClientId] = useState(defaultClientId ?? '')
  const [name, setName] = useState(initial?.name ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [objective, setObjective] = useState(initial?.objective ?? '')
  const [type, setType] = useState<ProjectType>(initial?.type ?? 'OTHER')
  const [status, setStatus] = useState<ProjectStatus>(initial?.status ?? 'DRAFT')
  const [deadline, setDeadline] = useState(initial?.deadline ?? '')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string>()
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const local: Record<string, string> = {}
    if (!initial && !clientId) local.clientId = 'Choisissez un client'
    if (!name.trim()) local.name = 'Le nom est obligatoire'
    setErrors(local)
    if (Object.keys(local).length) return

    setSaving(true)
    setFormError(undefined)
    try {
      await onSubmit({
        ...(initial ? {} : { clientId }),
        name,
        description,
        objective,
        type,
        status,
        deadline: deadline || null,
      })
    } catch (err) {
      const apiErr = err as ApiError
      setErrors(apiErr.fields ?? {})
      setFormError(apiErr.message)
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4 rounded-lg border border-slate-200 bg-white p-6">
      {formError && <ErrorMessage message={formError} />}
      {!initial && (
        <Field label="Client *" error={errors.clientId}>
          <select className={inputClass} value={clientId} onChange={(e) => setClientId(e.target.value)}>
            <option value="">— Sélectionner —</option>
            {clients?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {c.company ? ` (${c.company})` : ''}
              </option>
            ))}
          </select>
        </Field>
      )}
      <Field label="Nom du projet *" error={errors.name}>
        <input className={inputClass} value={name} maxLength={255} onChange={(e) => setName(e.target.value)} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Type" error={errors.type}>
          <select className={inputClass} value={type} onChange={(e) => setType(e.target.value as ProjectType)}>
            {PROJECT_TYPES.map((t) => (
              <option key={t} value={t}>
                {TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Statut" error={errors.status}>
          <select className={inputClass} value={status} onChange={(e) => setStatus(e.target.value as ProjectStatus)}>
            {PROJECT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Field label="Description" error={errors.description}>
        <textarea className={inputClass} rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
      </Field>
      <Field label="Objectif" error={errors.objective}>
        <textarea className={inputClass} rows={3} value={objective} onChange={(e) => setObjective(e.target.value)} />
      </Field>
      <Field label="Échéance" error={errors.deadline}>
        <input type="date" className={inputClass} value={deadline} onChange={(e) => setDeadline(e.target.value)} />
      </Field>
      <div className="flex gap-3">
        <button type="submit" disabled={saving} className={primaryButton}>
          {saving ? 'Enregistrement…' : submitLabel}
        </button>
        <button type="button" onClick={onCancel} className={secondaryButton}>
          Annuler
        </button>
      </div>
    </form>
  )
}
