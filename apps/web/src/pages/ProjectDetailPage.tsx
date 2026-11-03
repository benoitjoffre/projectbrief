import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../api/client'
import { TYPE_LABELS, type Project } from '../api/types'
import { ProjectForm } from '../components/ProjectForm'
import { formatDate } from '../api/format'
import { useApi } from '../hooks/useApi'
import { ErrorMessage, Loading, PageHeader, secondaryButton, StatusBadge } from '../components/ui'

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="py-3 sm:grid sm:grid-cols-3 sm:gap-4">
      <dt className="text-sm font-medium text-slate-500">{label}</dt>
      <dd className="mt-1 whitespace-pre-wrap text-sm text-slate-900 sm:col-span-2 sm:mt-0">{children}</dd>
    </div>
  )
}

export function ProjectDetailPage() {
  const { id = '' } = useParams()
  const { data: project, error, loading, reload } = useApi<Project>(`/api/projects/${id}`)
  const [editing, setEditing] = useState(false)

  if (loading) return <Loading />
  if (error) {
    return (
      <>
        <ErrorMessage
          message={error.status === 404 ? 'Projet introuvable.' : error.message}
          onRetry={error.status === 404 ? undefined : reload}
        />
        <Link to="/" className="mt-4 inline-block text-sm text-indigo-600 hover:underline">
          ← Retour au tableau de bord
        </Link>
      </>
    )
  }
  if (!project) return null

  return (
    <>
      <Link to="/" className="mb-2 inline-block text-sm text-indigo-600 hover:underline">
        ← Projets
      </Link>
      <PageHeader
        title={project.name}
        action={
          !editing && (
            <button onClick={() => setEditing(true)} className={secondaryButton}>
              Modifier
            </button>
          )
        }
      />
      {editing ? (
        <div className="max-w-2xl">
          <ProjectForm
            initial={project}
            submitLabel="Enregistrer"
            onCancel={() => setEditing(false)}
            onSubmit={async (data) => {
              await api.updateProject(project.id, data)
              reload()
              setEditing(false)
            }}
          />
        </div>
      ) : (
        <dl className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white px-6">
          <Row label="Client">
            {project.client?.name}
            {project.client?.company ? ` — ${project.client.company}` : ''}
          </Row>
          <Row label="Statut">
            <StatusBadge status={project.status} />
          </Row>
          <Row label="Type">{TYPE_LABELS[project.type]}</Row>
          <Row label="Échéance">{formatDate(project.deadline)}</Row>
          <Row label="Description">{project.description ?? '—'}</Row>
          <Row label="Objectif">{project.objective ?? '—'}</Row>
        </dl>
      )}
    </>
  )
}
