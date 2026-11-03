import type { SaveStatus } from './answerSaver'

const LABELS: Record<SaveStatus, { text: string; className: string } | null> = {
  idle: null,
  pending: { text: 'Modifications en attente…', className: 'text-slate-500' },
  saving: { text: 'Enregistrement...', className: 'text-slate-500' },
  saved: { text: 'Enregistré', className: 'text-green-700' },
  error: { text: 'Erreur', className: 'text-red-700' },
}

export function SaveIndicator({ status, onRetry }: { status: SaveStatus; onRetry?: () => void }) {
  const label = LABELS[status]
  return (
    <span role="status" aria-live="polite" className={`text-xs font-medium ${label?.className ?? ''}`}>
      {label?.text}
      {status === 'error' && onRetry && (
        <button onClick={onRetry} className="ml-2 underline">
          Réessayer
        </button>
      )}
    </span>
  )
}
