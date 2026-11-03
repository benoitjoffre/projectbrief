import { Link } from 'react-router-dom'
import { TYPE_LABELS, type Project } from '../api/types'
import { formatDate } from '../api/format'
import { useApi } from '../hooks/useApi'
import { EmptyState, ErrorMessage, Loading, PageHeader, primaryButton, StatusBadge } from '../components/ui'

export function DashboardPage() {
  const { data: projects, error, loading, reload } = useApi<Project[]>('/api/projects')

  return (
    <>
      <PageHeader
        title="Projets"
        action={
          <Link to="/projects/new" className={primaryButton}>
            Nouveau projet
          </Link>
        }
      />
      {loading && <Loading />}
      {error && <ErrorMessage message={error.message} onRetry={reload} />}
      {projects && projects.length === 0 && (
        <EmptyState
          message="Aucun projet pour le moment."
          action={
            <Link to="/projects/new" className={primaryButton}>
              Créer un projet
            </Link>
          }
        />
      )}
      {projects && projects.length > 0 && (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => (
            <li key={p.id}>
              <Link
                to={`/projects/${p.id}`}
                className="block h-full rounded-lg border border-slate-200 bg-white p-4 shadow-sm hover:border-indigo-300"
              >
                <div className="flex items-start justify-between gap-2">
                  <h2 className="font-medium text-slate-900">{p.name}</h2>
                  <StatusBadge status={p.status} />
                </div>
                <p className="mt-1 text-sm text-slate-500">{p.client?.name}</p>
                <p className="mt-3 text-xs text-slate-400">
                  {TYPE_LABELS[p.type]} · Échéance : {formatDate(p.deadline)}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
