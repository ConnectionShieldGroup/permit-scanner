import { Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { ProtectedRoute } from './components/ProtectedRoute';
import PermitsPage from './pages/Permits';
import KanbanPipelinePage from './pages/KanbanPipeline';
import KanbanAtivosPage from './pages/KanbanAtivos';
import KanbanNaoEfetivadosPage from './pages/KanbanNaoEfetivados';
import CrmPipelinePage from './pages/CrmPipeline';
import LoginPage from './pages/Login';
import AdminUsersPage from './pages/AdminUsers';
import { Toaster } from './components/ui/toaster';

export default function App() {
  return (
    <>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<PermitsPage />} />
          <Route path="kanban" element={<KanbanPipelinePage />} />
          <Route path="kanban/ativos" element={<KanbanAtivosPage />} />
          <Route path="kanban/nao-efetivados" element={<KanbanNaoEfetivadosPage />} />
          <Route path="crm" element={<CrmPipelinePage />} />
          <Route
            path="admin/users"
            element={
              <ProtectedRoute requireRole="admin">
                <AdminUsersPage />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<PermitsPage />} />
        </Route>
      </Routes>
      <Toaster />
    </>
  );
}
