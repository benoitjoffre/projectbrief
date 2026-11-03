import { useState, useSyncExternalStore, type ReactNode } from 'react'
import { ProgressBar, secondaryButton } from '../../components/ui'
import type { AnswerSaver, AnswerState } from './answerSaver'
import { QuestionCard } from './QuestionCard'
import { SaveIndicator } from './SaveIndicator'

interface Props {
  categories: Array<{ id: string; title: string; questions: Array<{ id: string; label: string; helpText: string | null }> }>
  saver: AnswerSaver
  /** Ce qui compte comme « traité » : validée par l'admin, ou simplement répondue côté client. */
  isDone: (answer: AnswerState) => boolean
  progress: { text: string; percentage: number }
  readOnly?: boolean
  hideReview?: boolean
  /** Contenu affiché sous la navigation (ex. bouton « Terminer »). */
  footer?: ReactNode
  remainingLabel?: string
}

/** Parcours par catégories, partagé par l'entretien (administrateur) et le questionnaire client. */
export function Interview({ categories, saver, isDone, progress, readOnly, hideReview, footer, remainingLabel }: Props) {
  const snapshot = useSyncExternalStore(saver.subscribe, saver.getSnapshot)
  const [categoryIndex, setCategoryIndex] = useState(0)
  const [onlyRemaining, setOnlyRemaining] = useState(false)

  if (categories.length === 0) return <p className="text-sm text-slate-500">Aucune question disponible.</p>

  const done = (id: string) => isDone(saver.get(id))
  const category = categories[categoryIndex]
  const countDone = (c: (typeof categories)[number]) => c.questions.filter((q) => done(q.id)).length
  const goTo = (i: number) => {
    void saver.flush() // aucune modification en attente n'est perdue au changement de catégorie
    setCategoryIndex(i)
    window.scrollTo({ top: 0 })
  }
  const visible = category.questions.filter((q) => !onlyRemaining || !done(q.id))

  return (
    <div>
      <div className="mb-6 rounded-lg border border-slate-200 bg-white p-4">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-sm">
          <span className="font-medium text-slate-900">{progress.text}</span>
          {!readOnly && <SaveIndicator status={snapshot.status} onRetry={() => void saver.flush()} />}
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
                ({countDone(category)}/{category.questions.length} {hideReview ? 'répondues' : 'validées'})
              </span>
            </h2>
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={onlyRemaining}
                onChange={(e) => setOnlyRemaining(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-indigo-600"
              />
              {remainingLabel ?? 'Questions restantes uniquement'}
            </label>
          </div>

          {visible.length === 0 ? (
            <p className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">
              Toutes les questions de cette catégorie sont traitées.
            </p>
          ) : (
            <ul className="space-y-4">
              {visible.map((q) => {
                const answer = saver.get(q.id)
                return (
                  <QuestionCard
                    key={q.id}
                    index={category.questions.indexOf(q) + 1}
                    question={{ ...q, categoryId: category.id, sortOrder: 0 }}
                    answer={answer}
                    done={isDone(answer)}
                    readOnly={readOnly}
                    hideReview={hideReview}
                    onChange={(patch) => saver.edit(q.id, patch)}
                    onRetry={() => void saver.retry(q.id)}
                    onResolve={(choice) => saver.resolveConflict(q.id, choice)}
                  />
                )
              })}
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
          {footer}
        </section>
      </div>
    </div>
  )
}
