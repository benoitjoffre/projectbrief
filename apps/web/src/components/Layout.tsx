import { NavLink, Outlet } from 'react-router-dom'

const link = ({ isActive }: { isActive: boolean }) =>
  `rounded-md px-3 py-2 text-sm font-medium ${
    isActive ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-100'
  }`

export function Layout() {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <nav className="mx-auto flex max-w-5xl flex-wrap items-center gap-1 px-4 py-3">
          <span className="mr-4 text-lg font-bold text-indigo-600">ProjectBrief</span>
          <NavLink to="/" end className={link}>
            Tableau de bord
          </NavLink>
          <NavLink to="/clients" className={link}>
            Clients
          </NavLink>
        </nav>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  )
}
