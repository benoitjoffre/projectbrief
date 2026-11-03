import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { api, ApiError } from '../api/client'
import type { PublicQuestionnaire } from '../api/types'
import { ErrorMessage, Loading, primaryButton } from '../components/ui'
import { SaveConflict, type SaveFn } from '../features/discovery/answerSaver'
import { Interview } from '../features/discovery/Interview'
import { useAnswerSaver } from '../features/discovery/useAnswerSaver'
import { useApi } from '../hooks/useApi'

/** Page publique (sans connexion, hors Layout) : le jeton du lien est la seule clé d'accès. */
export function PublicQuestionnairePage() {
  const { token = '' } = useParams()
  const { data, error, loading, reload } = useApi<PublicQuestionnaire>(
    `/api/public/questionnaires/${encodeURIComponent(token)}`,
  )

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-5xl px-4 py-3 text-lg font-bold text-indigo-600">ProjectBrief</div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8">
        {loading ? (
          <Loading />
        ) : error ? (
          error.status === 404 ? (
            <div role="alert" className="rounded-md border border-slate-200 bg-white p-6 text-center">
              <h1 className="text-lg font-semibold text-slate-900">Lien invalide ou désactivé</h1>
              <p className="mt-2 text-sm text-slate-600">Vérifiez le lien reçu ou contactez la personne qui vous l’a envoyé.</p>
            </div>
          ) : (
            <ErrorMessage message={error.message} onRetry={reload} />
          )
        ) : data ? (
          <Questionnaire token={token} data={data} />
        ) : null}
      </main>
    </div>
  )
}

function Questionnaire({ token, data }: { token: string; data: PublicQuestionnaire }) {
  const [progress, setProgress] = useState(data.progress)
  const [completedAt, setCompletedAt] = useState(data.completedAt)
  const [finishing, setFinishing] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const [save] = useState<SaveFn>(() => async (questionId, payload, expectedUpdatedAt) => {
    try {
      const saved = await api.savePublicAnswer(token, questionId, { value: payload.value, expectedUpdatedAt })
      setProgress(saved.progress)
      return { updatedAt: saved.updatedAt }
    } catch (err) {
      if (err instanceof ApiError && err.code === 'STALE_WRITE') {
        throw new SaveConflict(err.current ?? { value: '', isReviewed: false, updatedAt: null })
      }
      if (err instanceof ApiError && err.code === 'ALREADY_COMPLETED') setCompletedAt(new Date().toISOString())
      throw err
    }
  })
  const { saver } = useAnswerSaver(save, data.answers)

  async function finish() {
    setMessage(null)
    if (!window.confirm('Terminer le questionnaire ? Vous ne pourrez plus modifier vos réponses ensuite.')) return
    setFinishing(true)
    try {
      await saver.flush() // aucune saisie en attente ne doit être perdue
      if (saver.hasUnsaved()) {
        setMessage('Certaines réponses ne sont pas encore enregistrées (erreur ou conflit). Corrigez-les avant de terminer.')
        return
      }
      const res = await api.completePublic(token)
      setCompletedAt(res.completedAt)
    } catch (err) {
      setMessage(err instanceof ApiError ? err.message : 'Impossible de terminer le questionnaire.')
    } finally {
      setFinishing(false)
    }
  }

  return (
    <>
      <h1 className="mb-1 text-2xl font-semibold text-slate-900">{data.project.name}</h1>
      <p className="mb-6 text-sm text-slate-600">
        Merci de répondre aux questions ci-dessous. Vos réponses sont enregistrées automatiquement : vous pouvez fermer
        cette page et reprendre plus tard avec le même lien.
      </p>

      {completedAt && (
        <div role="status" className="mb-6 rounded-md border border-green-200 bg-green-50 p-4 text-sm text-green-900">
          <p className="font-medium">Merci ! Vos réponses ont bien été transmises.</p>
          <p className="mt-1">Le questionnaire est terminé : vos réponses ne peuvent plus être modifiées.</p>
        </div>
      )}

      <Interview
        categories={data.categories}
        saver={saver}
        isDone={(a) => a.value.trim() !== ''}
        hideReview
        readOnly={completedAt !== null}
        remainingLabel="Questions sans réponse uniquement"
        progress={{
          text: `Progression : ${progress.answeredQuestions} / ${progress.totalQuestions} questions répondues (${progress.percentage} %)`,
          percentage: progress.percentage,
        }}
        footer={
          completedAt ? null : (
            <div className="mt-8 rounded-lg border border-slate-200 bg-white p-4">
              <p className="mb-3 text-sm text-slate-600">
                Vous avez terminé ? Validez l’envoi de vos réponses. Vous pourrez ignorer les questions qui ne vous concernent pas.
              </p>
              {message && <p role="alert" className="mb-3 text-sm text-red-700">{message}</p>}
              <button onClick={() => void finish()} disabled={finishing} className={primaryButton}>
                {finishing ? 'Envoi…' : 'Terminer'}
              </button>
            </div>
          )
        }
      />
    </>
  )
}
