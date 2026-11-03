import { useId } from 'react'
import type { Question } from '../../api/types'
import type { AnswerState } from './answerSaver'
import { SaveIndicator } from './SaveIndicator'

interface Props {
  index: number
  question: Question
  answer: AnswerState
  onChange: (patch: { value?: string; isReviewed?: boolean }) => void
  onRetry: () => void
  onResolve?: (choice: 'mine' | 'theirs') => void
  /** Lecture seule (questionnaire terminé). */
  readOnly?: boolean
  /** Masque « Question validée » (réservée à l'administrateur). */
  hideReview?: boolean
  /** Réponse « traitée » : dépend du contexte (validée pour l'admin, simplement remplie pour le client). */
  done: boolean
}

export function QuestionCard({ index, question, answer, onChange, onRetry, onResolve, readOnly, hideReview, done }: Props) {
  const id = useId()
  return (
    <li className="rounded-lg border border-slate-200 bg-white p-4 sm:p-5">
      <div className="mb-2 flex items-start justify-between gap-3">
        <label htmlFor={id} className="text-sm font-medium text-slate-900">
          <span className="mr-2 text-slate-400">{index}.</span>
          {question.label}
        </label>
        {done && (
          <span className="shrink-0 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
            {hideReview ? 'Répondue' : 'Traitée'}
          </span>
        )}
      </div>
      {question.helpText && <p className="mb-2 text-xs text-slate-500">{question.helpText}</p>}
      <textarea
        id={id}
        rows={4}
        value={answer.value}
        readOnly={readOnly}
        onChange={(e) => onChange({ value: e.target.value })}
        className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
      />
      {answer.conflict && (
        <div role="alert" className="mt-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-900">
          <p className="font-medium">Cette réponse a été modifiée ailleurs pendant votre saisie.</p>
          <p className="mt-1 whitespace-pre-wrap text-xs text-red-800">Version enregistrée : {answer.conflict.value || '(vide)'}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button onClick={() => onResolve?.('mine')} className="rounded-md bg-red-700 px-3 py-1 text-xs font-medium text-white">
              Garder ma version
            </button>
            <button onClick={() => onResolve?.('theirs')} className="rounded-md border border-red-300 bg-white px-3 py-1 text-xs font-medium text-red-800">
              Reprendre la version enregistrée
            </button>
          </div>
        </div>
      )}
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        {hideReview ? (
          <span />
        ) : (
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={answer.isReviewed}
              disabled={readOnly}
              onChange={(e) => onChange({ isReviewed: e.target.checked })}
              className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            />
            Question validée
          </label>
        )}
        {!readOnly && <SaveIndicator status={answer.status} onRetry={onRetry} />}
      </div>
    </li>
  )
}
