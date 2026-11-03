import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../api/client'
import type { Client } from '../api/types'
import { ProjectForm } from '../components/ProjectForm'
import { useApi } from '../hooks/useApi'
import { EmptyState, ErrorMessage, Loading, PageHeader, primaryButton } from '../components/ui'

export function ProjectNewPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { data: clients, error, loading, reload } = useApi<Client[]>('/api/clients')

  return (
    <>
      <PageHeader title="Nouveau projet" />
      {loading && <Loading />}
      {error && <ErrorMessage message={error.message} onRetry={reload} />}
      {clients && clients.length === 0 && (
        <EmptyState
          message="Créez d'abord un client pour pouvoir lui associer un projet."
          action={
            <Link to="/clients/new" className={primaryButton}>
              Créer un client
            </Link>
          }
        />
      )}
      {clients && clients.length > 0 && (
        <div className="max-w-2xl">
          <ProjectForm
            clients={clients}
            defaultClientId={params.get('clientId') ?? ''}
            submitLabel="Créer le projet"
            onCancel={() => navigate(-1)}
            onSubmit={async (data) => {
              const project = await api.createProject(data)
              navigate(`/projects/${project.id}`)
            }}
          />
        </div>
      )}
    </>
  )
}
