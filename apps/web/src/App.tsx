import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { ClientNewPage } from './pages/ClientNewPage'
import { ClientsPage } from './pages/ClientsPage'
import { DashboardPage } from './pages/DashboardPage'
import { ProjectDetailPage } from './pages/ProjectDetailPage'
import { ProjectNewPage } from './pages/ProjectNewPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<DashboardPage />} />
          <Route path="clients" element={<ClientsPage />} />
          <Route path="clients/new" element={<ClientNewPage />} />
          <Route path="projects/new" element={<ProjectNewPage />} />
          <Route path="projects/:id" element={<ProjectDetailPage />} />
          <Route path="*" element={<p className="text-slate-500">Page introuvable.</p>} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
