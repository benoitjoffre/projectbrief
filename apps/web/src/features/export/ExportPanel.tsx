import { useEffect, useRef, useState } from 'react'
import { ApiError, fetchPdf } from '../../api/client'
import { DOCUMENT_SECTIONS, type DocumentOptions, type DocumentSection, type DocumentWarning } from '../../api/types'
import { ErrorMessage, Field, inputClass, Loading, primaryButton, secondaryButton } from '../../components/ui'
import { useApi } from '../../hooks/useApi'
import { BlobUrlHolder, DEFAULT_OPTIONS, SECTION_LABELS, validateOptions } from './exportOptions'

type Action = 'preview' | 'download'

export function ExportPanel({ projectId }: { projectId: string }) {
  const warnings = useApi<DocumentWarning[]>(`/api/projects/${projectId}/document/warnings`)
  const [options, setOptions] = useState<DocumentOptions>(DEFAULT_OPTIONS)
  const [busy, setBusy] = useState<Action | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  // Options utilisées pour l'aperçu affiché : permet de signaler un aperçu périmé.
  const [previewedWith, setPreviewedWith] = useState<string | null>(null)

  const holder = useRef(new BlobUrlHolder())
  useEffect(() => {
    const h = holder.current
    return () => h.clear() // URL Blob libérée au démontage
  }, [])

  const errors = validateOptions(options)
  const stale = previewUrl !== null && previewedWith !== JSON.stringify(options)

  const setSection = (s: DocumentSection, value: boolean) =>
    setOptions((o) => ({ ...o, sections: { ...o.sections, [s]: value } }))

  async function run(action: Action) {
    setBusy(action)
    setError(null)
    // On envoie exactement l'état affiché (version nettoyée) : aperçu et téléchargement partagent les mêmes options.
    const sent = { ...options, version: options.version.trim() }
    try {
      const { blob, filename } = await fetchPdf(projectId, action, sent)
      if (action === 'preview') {
        setPreviewUrl(holder.current.set(blob))
        setPreviewedWith(JSON.stringify(options))
      } else {
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = filename ?? 'cahier-des-charges.pdf'
        document.body.append(a)
        a.click()
        a.remove()
        setTimeout(() => URL.revokeObjectURL(url), 10_000)
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Échec de la génération du PDF.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[22rem_1fr]">
      <div className="space-y-5">
        <section className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="mb-2 text-sm font-semibold text-slate-900">Points d’attention avant export</h2>
          {warnings.loading ? (
            <Loading />
          ) : warnings.error ? (
            <ErrorMessage message={warnings.error.message} onRetry={warnings.reload} />
          ) : warnings.data?.length ? (
            <ul className="space-y-1.5 text-sm text-amber-800">
              {warnings.data.map((w) => (
                <li key={w.code} className="flex gap-2">
                  <span aria-hidden>⚠</span>
                  <span>{w.message}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-green-700">Aucun point d’attention.</p>
          )}
          <p className="mt-3 text-xs text-slate-500">
            Ces avertissements ne bloquent pas l’export. Le document reste un « document de travail ».
          </p>
        </section>

        <section className="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-slate-900">Options du document</h2>
          <Field label="Version du document">
            <input
              className={inputClass}
              value={options.version}
              maxLength={30}
              onChange={(e) => setOptions((o) => ({ ...o, version: e.target.value }))}
            />
          </Field>
          <fieldset>
            <legend className="mb-1 text-sm font-medium text-slate-700">Sections à inclure</legend>
            {DOCUMENT_SECTIONS.map((s) => (
              <label key={s} className="flex items-center gap-2 py-0.5 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={options.sections[s]}
                  onChange={(e) => setSection(s, e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-indigo-600"
                />
                {SECTION_LABELS[s]}
              </label>
            ))}
            {!options.sections.risks && (
              <p className="mt-1 text-xs text-slate-500">Les risques sont exclus par défaut (données internes).</p>
            )}
          </fieldset>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={options.includeNonMvpFeatures}
              onChange={(e) => setOptions((o) => ({ ...o, includeNonMvpFeatures: e.target.checked }))}
              className="h-4 w-4 rounded border-slate-300 text-indigo-600"
            />
            Inclure les fonctionnalités hors MVP
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={options.includeUnansweredQuestions}
              onChange={(e) => setOptions((o) => ({ ...o, includeUnansweredQuestions: e.target.checked }))}
              className="h-4 w-4 rounded border-slate-300 text-indigo-600"
            />
            Inclure les questions sans réponse
          </label>

          {errors.length > 0 && (
            <ul role="alert" className="text-xs text-red-700">
              {errors.map((e) => <li key={e}>{e}</li>)}
            </ul>
          )}
          <div className="flex flex-wrap gap-2 pt-1">
            <button onClick={() => void run('preview')} disabled={busy !== null || errors.length > 0} className={secondaryButton}>
              {busy === 'preview' ? 'Génération…' : 'Prévisualiser'}
            </button>
            <button onClick={() => void run('download')} disabled={busy !== null || errors.length > 0} className={primaryButton}>
              {busy === 'download' ? 'Génération…' : 'Télécharger'}
            </button>
          </div>
        </section>
      </div>

      <div className="min-w-0">
        {error && <ErrorMessage message={error} />}
        {busy === 'preview' && <Loading label="Génération de l’aperçu…" />}
        {previewUrl ? (
          <div className="space-y-2">
            {stale && (
              <p role="status" className="rounded-md bg-amber-50 p-2 text-sm text-amber-800">
                Les options ont changé depuis cet aperçu : prévisualisez à nouveau pour le mettre à jour.
              </p>
            )}
            <iframe title="Aperçu du PDF" src={previewUrl} className="h-[75vh] w-full rounded-lg border border-slate-200 bg-white" />
          </div>
        ) : (
          !busy && !error && (
            <p className="rounded-lg border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
              Cliquez sur « Prévisualiser » pour afficher le cahier des charges.
            </p>
          )
        )}
      </div>
    </div>
  )
}
