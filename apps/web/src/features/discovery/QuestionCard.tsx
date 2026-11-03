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
}

export function QuestionCard({ index, question, answer, onChange, onRetry }: Props) {
  const id = useId()
  const done = answer.isReviewed && answer.value.trim() !== ''
  return (
    <li className="rounded-lg border border-slate-200 bg-white p-4 sm:p-5">
      <div className="mb-2 flex items-start justify-between gap-3">
        <label htmlFor={id} className="text-sm font-medium text-slate-900">
          <span className="mr-2 text-slate-400">{index}.</span>
          {question.label}
        </label>
        {done && (
          <span className="shrink-0 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
            Traitée
          </span>
        )}
      </div>
      {question.helpText && <p className="mb-2 text-xs text-slate-500">{question.helpText}</p>}
      <textarea
        id={id}
        rows={4}
        value={answer.value}
        onChange={(e) => onChange({ value: e.target.value })}
        className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
      />
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={answer.isReviewed}
            onChange={(e) => onChange({ isReviewed: e.target.checked })}
            className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
          />
          Question validée
        </label>
        <SaveIndicator status={answer.status} onRetry={onRetry} />
      </div>
    </li>
  )
}
