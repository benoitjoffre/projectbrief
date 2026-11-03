import {
  FEATURE_PRIORITIES,
  PRIORITY_LABELS,
  SCOPING_STATUS_LABELS,
  SCOPING_TYPES,
  SCOPING_TYPE_LABELS,
  SEVERITY_LABELS,
  TYPE_LABELS,
  type ProjectSummary,
  type ScopingItem,
} from '../../api/types'
import { formatDate } from '../../api/format'
import { ErrorMessage, Loading, ProgressBar, StatusBadge } from '../../components/ui'
import { useApi } from '../../hooks/useApi'
import { PRIORITY_STYLES } from './styles'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 sm:p-5">
      <h2 className="mb-3 text-base font-semibold text-slate-900">{title}</h2>
      {children}
    </section>
  )
}

const Empty = ({ text }: { text: string }) => <p className="text-sm text-slate-500">{text}</p>

function ItemList({ items }: { items: ScopingItem[] }) {
  return (
    <ul className="space-y-2 text-sm">
      {items.map((i) => (
        <li key={i.id}>
          <span className="font-medium text-slate-900">{i.title}</span>
          <span className="ml-2 text-xs text-slate-500">
            {SCOPING_STATUS_LABELS[i.status]}
            {i.severity ? ` · ${SEVERITY_LABELS[i.severity]}` : ''}
          </span>
          {i.resolution && <p className="text-slate-600">→ {i.resolution}</p>}
        </li>
      ))}
    </ul>
  )
}

export function SummaryPanel({ projectId }: { projectId: string }) {
  const { data: s, error, loading, reload } = useApi<ProjectSummary>(`/api/projects/${projectId}/summary`)
  if (loading) return <Loading />
  if (error) return <ErrorMessage message={error.message} onRetry={reload} />
  if (!s) return null

  const attention = s.openQuestions.length + s.unresolvedHighRisks.length

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <Section title="Projet">
          <dl className="space-y-1 text-sm">
            <div><dt className="inline text-slate-500">Client : </dt><dd className="inline">{s.client?.name}{s.client?.company ? ` — ${s.client.company}` : ''}</dd></div>
            <div><dt className="inline text-slate-500">Statut : </dt><dd className="inline"><StatusBadge status={s.project.status} /></dd></div>
            <div><dt className="inline text-slate-500">Type : </dt><dd className="inline">{TYPE_LABELS[s.project.type]}</dd></div>
            <div><dt className="inline text-slate-500">Échéance : </dt><dd className="inline">{formatDate(s.project.deadline)}</dd></div>
            {s.project.objective && <div className="whitespace-pre-wrap"><dt className="text-slate-500">Objectif</dt><dd>{s.project.objective}</dd></div>}
          </dl>
        </Section>
        <Section title="Découverte client">
          <p className="mb-2 text-sm">
            {s.discovery.reviewedQuestions} / {s.discovery.totalQuestions} questions validées ({s.discovery.percentage} %)
          </p>
          <ProgressBar percentage={s.discovery.percentage} label="Progression de la découverte" />
        </Section>
      </div>

      <Section title={`Points d’attention (${attention})`}>
        {attention === 0 ? (
          <Empty text="Aucune question ouverte ni risque élevé non résolu." />
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <h3 className="mb-1 text-sm font-medium text-slate-700">Questions ouvertes ({s.openQuestions.length})</h3>
              {s.openQuestions.length ? <ItemList items={s.openQuestions} /> : <Empty text="Aucune." />}
            </div>
            <div>
              <h3 className="mb-1 text-sm font-medium text-slate-700">Risques élevés non résolus ({s.unresolvedHighRisks.length})</h3>
              {s.unresolvedHighRisks.length ? <ItemList items={s.unresolvedHighRisks} /> : <Empty text="Aucun." />}
            </div>
          </div>
        )}
      </Section>

      <Section title={`Périmètre MVP (${s.mvp.length})`}>
        {s.mvp.length === 0 ? (
          <Empty text="Aucune fonctionnalité Must définie." />
        ) : (
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {s.mvp.map((f) => <li key={f.id}>{f.title}</li>)}
          </ul>
        )}
      </Section>

      <Section title="Fonctionnalités par priorité">
        <div className="grid gap-4 md:grid-cols-2">
          {FEATURE_PRIORITIES.map((p) => (
            <div key={p}>
              <h3 className={`mb-1 inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${PRIORITY_STYLES[p]}`}>
                {PRIORITY_LABELS[p]} ({s.features[p].length})
              </h3>
              {s.features[p].length ? (
                <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm">
                  {s.features[p].map((f) => <li key={f.id}>{f.title}</li>)}
                </ul>
              ) : (
                <p className="mt-1 text-sm text-slate-400">—</p>
              )}
            </div>
          ))}
        </div>
      </Section>

      <Section title="Cadrage">
        <p className="mb-3 text-sm text-slate-600">{s.decisionsCount} décision(s) documentée(s).</p>
        <div className="grid gap-4 md:grid-cols-2">
          {SCOPING_TYPES.map((t) => (
            <div key={t}>
              <h3 className="mb-1 text-sm font-medium text-slate-700">{SCOPING_TYPE_LABELS[t]} ({s.scopingItems[t].length})</h3>
              {s.scopingItems[t].length ? <ItemList items={s.scopingItems[t]} /> : <p className="text-sm text-slate-400">—</p>}
            </div>
          ))}
        </div>
      </Section>
    </div>
  )
}
