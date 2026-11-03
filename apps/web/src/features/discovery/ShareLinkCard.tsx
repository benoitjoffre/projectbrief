import { useState } from 'react'
import { api, ApiError } from '../../api/client'
import { formatDate } from '../../api/format'
import { Loading, primaryButton, secondaryButton } from '../../components/ui'
import { useApi } from '../../hooks/useApi'
import type { ShareStatus } from '../../api/types'

/**
 * Lien privé du questionnaire client. Seul le hash du jeton est conservé côté serveur :
 * le lien complet n'est affiché qu'une fois, à sa génération.
 */
export function ShareLinkCard({ projectId }: { projectId: string }) {
  const status = useApi<ShareStatus>(`/api/projects/${projectId}/questionnaire-share`)
  const [link, setLink] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const run = async (fn: () => Promise<void>) => {
    setBusy(true)
    setError(null)
    try {
      await fn()
      status.reload()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Une erreur est survenue.')
    } finally {
      setBusy(false)
    }
  }

  const generate = () => {
    if (status.data?.active && !window.confirm('Un lien est déjà actif : il sera désactivé et remplacé par le nouveau. Continuer ?')) return
    void run(async () => {
      const created = await api.createShare(projectId)
      setLink(`${window.location.origin}${created.path}`)
      setCopied(false)
    })
  }

  const revoke = () => {
    if (!window.confirm('Désactiver le lien ? Le client ne pourra plus y accéder (ses réponses sont conservées).')) return
    void run(async () => {
      await api.revokeShare(projectId)
      setLink(null)
    })
  }

  async function copy() {
    if (!link) return
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
    } catch {
      setError('Copie impossible : sélectionnez le lien et copiez-le manuellement.')
    }
  }

  const share = status.data?.share
  return (
    <section className="mb-6 rounded-lg border border-slate-200 bg-white p-4">
      <h2 className="text-sm font-semibold text-slate-900">Questionnaire client</h2>
      {status.loading ? (
        <Loading />
      ) : (
        <p className="mt-1 text-sm text-slate-600">
          {!share
            ? 'Aucun lien généré.'
            : !share.isActive
              ? 'Le lien est désactivé.'
              : share.completedAt
                ? `Lien actif — le client a terminé le questionnaire le ${formatDate(share.completedAt)}.`
                : 'Lien actif — en attente des réponses du client.'}
        </p>
      )}

      {link && (
        <div className="mt-3">
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              readOnly
              value={link}
              aria-label="Lien client"
              onFocus={(e) => e.currentTarget.select()}
              className="w-full rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-sm"
            />
            <button onClick={() => void copy()} className={secondaryButton}>
              {copied ? 'Copié ✓' : 'Copier'}
            </button>
          </div>
          <p className="mt-1 text-xs text-amber-700">
            Ce lien n’est affiché qu’une seule fois : copiez-le maintenant. Toute personne qui le possède peut répondre.
          </p>
        </div>
      )}
      {share?.isActive && !link && (
        <p className="mt-2 text-xs text-slate-500">
          Le lien n’est pas réaffichable (seule son empreinte est conservée). Générez-en un nouveau pour le copier : l’ancien sera désactivé.
        </p>
      )}
      {error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}

      <div className="mt-3 flex flex-wrap gap-2">
        <button onClick={generate} disabled={busy} className={primaryButton}>
          Générer un lien client
        </button>
        {share?.isActive && (
          <button onClick={revoke} disabled={busy} className={secondaryButton}>
            Désactiver le lien
          </button>
        )}
      </div>
    </section>
  )
}
