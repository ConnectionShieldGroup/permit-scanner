import { Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import PermitsPage from './pages/Permits';
import KanbanPipelinePage from './pages/KanbanPipeline';
import KanbanAtivosPage from './pages/KanbanAtivos';
import KanbanNaoEfetivadosPage from './pages/KanbanNaoEfetivados';
import { Toaster } from './components/ui/toaster';

export default function App() {
  return (
    <>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<PermitsPage />} />
          <Route path="kanban" element={<KanbanPipelinePage />} />
          <Route path="kanban/ativos" element={<KanbanAtivosPage />} />
          <Route
            path="kanban/nao-efetivados"
            element={<KanbanNaoEfetivadosPage />}
          />
          <Route path="*" element={<PermitsPage />} />
        </Route>
      </Routes>
      <Toaster />
    </>
  );
}
