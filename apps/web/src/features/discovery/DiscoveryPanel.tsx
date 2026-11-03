import { useCallback, useRef, useState } from 'react'
import type { Answer, DiscoveryProgress, QuestionCategory } from '../../api/types'
import { api } from '../../api/client'
import { ErrorMessage, Loading, ProgressBar, secondaryButton } from '../../components/ui'
import { useApi } from '../../hooks/useApi'
import { QuestionCard } from './QuestionCard'
import { SaveIndicator } from './SaveIndicator'
import { useAnswerSaver } from './useAnswerSaver'

export function DiscoveryPanel({ projectId }: { projectId: string }) {
  const categories = useApi<QuestionCategory[]>('/api/questions')
  const answers = useApi<Answer[]>(`/api/projects/${projectId}/answers`)
  const progress = useApi<DiscoveryProgress>(`/api/projects/${projectId}/discovery/progress`)

  const error = categories.error ?? answers.error ?? progress.error
  if (error) {
    return (
      <ErrorMessage
        message={error.message}
        onRetry={() => {
          categories.reload()
          answers.reload()
          progress.reload()
        }}
      />
    )
  }
  if (!categories.data || !answers.data || !progress.data) return <Loading />

  return (
    <Interview
      projectId={projectId}
      categories={categories.data}
      initialAnswers={answers.data}
      initialProgress={progress.data}
    />
  )
}

function Interview({
  projectId,
  categories,
  initialAnswers,
  initialProgress,
}: {
  projectId: string
  categories: QuestionCategory[]
  initialAnswers: Answer[]
  initialProgress: DiscoveryProgress
}) {
  const [progress, setProgress] = useState(initialProgress)
  const [categoryIndex, setCategoryIndex] = useState(0)
  const [onlyRemaining, setOnlyRemaining] = useState(false)

  // Rafraîchit la progression (calculée côté serveur) après chaque sauvegarde confirmée.
  // Un compteur écarte les réponses arrivées dans le désordre.
  const refreshSeq = useRef(0)
  const refreshProgress = useCallback(() => {
    const seq = ++refreshSeq.current
    api
      .get<DiscoveryProgress>(`/api/projects/${projectId}/discovery/progress`)
      .then((p) => seq === refreshSeq.current && setProgress(p))
      .catch(() => {})
  }, [projectId])

  const { saver, snapshot } = useAnswerSaver(projectId, initialAnswers, refreshProgress)

  const isDone = (questionId: string) => {
    const a = saver.get(questionId)
    return a.isReviewed && a.value.trim() !== ''
  }
  const countDone = (c: QuestionCategory) => c.questions.filter((q) => isDone(q.id)).length

  if (categories.length === 0) return <p className="text-sm text-slate-500">Aucune question disponible.</p>

  const category = categories[categoryIndex]
  const goTo = (i: number) => {
    void saver.flush() // aucune modification en attente n'est perdue au changement de catégorie
    setCategoryIndex(i)
    window.scrollTo({ top: 0 })
  }
  const visible = category.questions.filter((q) => !onlyRemaining || !isDone(q.id))

  return (
    <div>
      <div className="mb-6 rounded-lg border border-slate-200 bg-white p-4">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-sm">
          <span className="font-medium text-slate-900">
            Progression : {progress.reviewedQuestions} / {progress.totalQuestions} questions validées (
            {progress.percentage} %)
          </span>
          <SaveIndicator status={snapshot.status} onRetry={() => void saver.flush()} />
        </div>
        <ProgressBar percentage={progress.percentage} label="Progression de l'entretien" />
      </div>

      <div className="grid gap-6 md:grid-cols-[16rem_1fr]">
        <nav aria-label="Catégories" className="flex gap-2 overflow-x-auto md:flex-col md:overflow-visible">
          {categories.map((c, i) => (
            <button
              key={c.id}
              onClick={() => goTo(i)}
              aria-current={i === categoryIndex ? 'true' : undefined}
              className={`flex shrink-0 items-center justify-between gap-3 rounded-md border px-3 py-2 text-left text-sm ${
                i === categoryIndex
                  ? 'border-indigo-600 bg-indigo-50 font-medium text-indigo-900'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              <span>{c.title}</span>
              <span className="whitespace-nowrap text-xs text-slate-500">
                {countDone(c)}/{c.questions.length}
              </span>
            </button>
          ))}
        </nav>

        <section>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold text-slate-900">
              {category.title}{' '}
              <span className="text-sm font-normal text-slate-500">
                ({countDone(category)}/{category.questions.length} validées)
              </span>
            </h2>
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={onlyRemaining}
                onChange={(e) => setOnlyRemaining(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-indigo-600"
              />
              Questions restantes uniquement
            </label>
          </div>

          {visible.length === 0 ? (
            <p className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">
              Toutes les questions de cette catégorie sont traitées.
            </p>
          ) : (
            <ul className="space-y-4">
              {visible.map((q) => (
                <QuestionCard
                  key={q.id}
                  index={category.questions.indexOf(q) + 1}
                  question={q}
                  answer={saver.get(q.id)}
                  onChange={(patch) => saver.edit(q.id, patch)}
                  onRetry={() => void saver.retry(q.id)}
                />
              ))}
            </ul>
          )}

          <div className="mt-6 flex justify-between gap-3">
            <button
              onClick={() => goTo(categoryIndex - 1)}
              disabled={categoryIndex === 0}
              className={`${secondaryButton} disabled:opacity-50`}
            >
              ← Catégorie précédente
            </button>
            <button
              onClick={() => goTo(categoryIndex + 1)}
              disabled={categoryIndex === categories.length - 1}
              className={`${secondaryButton} disabled:opacity-50`}
            >
              Catégorie suivante →
            </button>
          </div>
        </section>
      </div>
    </div>
  )
}
