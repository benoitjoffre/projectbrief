import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, ApiError } from '../api/client'
import { ErrorMessage, Field, inputClass, PageHeader, primaryButton, secondaryButton } from '../components/ui'

export function ClientNewPage() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ name: '', email: '', phone: '', company: '' })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string>()
  const [saving, setSaving] = useState(false)

  const set = (key: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [key]: e.target.value }))

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const local: Record<string, string> = {}
    if (!form.name.trim()) local.name = 'Le nom est obligatoire'
    if (form.email && !/^\S+@\S+\.\S+$/.test(form.email.trim())) local.email = 'Email invalide'
    setErrors(local)
    if (Object.keys(local).length) return

    setSaving(true)
    setFormError(undefined)
    try {
      await api.createClient(form)
      navigate('/clients')
    } catch (err) {
      const apiErr = err as ApiError
      setErrors(apiErr.fields ?? {})
      setFormError(apiErr.message)
      setSaving(false)
    }
  }

  return (
    <>
      <PageHeader title="Nouveau client" />
      <form onSubmit={handleSubmit} noValidate className="max-w-xl space-y-4 rounded-lg border border-slate-200 bg-white p-6">
        {formError && <ErrorMessage message={formError} />}
        <Field label="Nom *" error={errors.name}>
          <input className={inputClass} value={form.name} maxLength={255} onChange={set('name')} />
        </Field>
        <Field label="Entreprise" error={errors.company}>
          <input className={inputClass} value={form.company} maxLength={255} onChange={set('company')} />
        </Field>
        <Field label="Email" error={errors.email}>
          <input type="email" className={inputClass} value={form.email} onChange={set('email')} />
        </Field>
        <Field label="Téléphone" error={errors.phone}>
          <input type="tel" className={inputClass} value={form.phone} maxLength={50} onChange={set('phone')} />
        </Field>
        <div className="flex gap-3">
          <button type="submit" disabled={saving} className={primaryButton}>
            {saving ? 'Enregistrement…' : 'Créer le client'}
          </button>
          <button type="button" onClick={() => navigate('/clients')} className={secondaryButton}>
            Annuler
          </button>
        </div>
      </form>
    </>
  )
}
