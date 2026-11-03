import { Link } from 'react-router-dom'
import type { Client } from '../api/types'
import { useApi } from '../hooks/useApi'
import { EmptyState, ErrorMessage, Loading, PageHeader, primaryButton } from '../components/ui'

export function ClientsPage() {
  const { data: clients, error, loading, reload } = useApi<Client[]>('/api/clients')

  return (
    <>
      <PageHeader
        title="Clients"
        action={
          <Link to="/clients/new" className={primaryButton}>
            Nouveau client
          </Link>
        }
      />
      {loading && <Loading />}
      {error && <ErrorMessage message={error.message} onRetry={reload} />}
      {clients && clients.length === 0 && (
        <EmptyState
          message="Aucun client pour le moment."
          action={
            <Link to="/clients/new" className={primaryButton}>
              Créer un client
            </Link>
          }
        />
      )}
      {clients && clients.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">Nom</th>
                <th className="px-4 py-3 font-medium">Entreprise</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Téléphone</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {clients.map((c) => (
                <tr key={c.id}>
                  <td className="px-4 py-3 font-medium text-slate-900">{c.name}</td>
                  <td className="px-4 py-3">{c.company ?? '—'}</td>
                  <td className="px-4 py-3">{c.email ?? '—'}</td>
                  <td className="px-4 py-3">{c.phone ?? '—'}</td>
                  <td className="px-4 py-3 text-right">
                    <Link to={`/projects/new?clientId=${c.id}`} className="text-indigo-600 hover:underline">
                      Nouveau projet
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
