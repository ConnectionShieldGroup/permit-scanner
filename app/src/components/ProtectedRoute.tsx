import { Navigate } from 'react-router-dom';
import { useAuth, type UserRole } from '../hooks/useAuth';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireRole?: UserRole;
}

export function ProtectedRoute({ children, requireRole }: ProtectedRouteProps) {
  const { user, role, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg-primary">
        <div className="text-text-secondary mono text-sm">Carregando...</div>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  if (requireRole && role !== requireRole) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg-primary">
        <div className="rounded-2xl border border-border bg-bg-card p-8 max-w-md">
          <h1 className="text-lg font-semibold text-white mb-2">Acesso negado</h1>
          <p className="text-sm text-text-secondary">
            Essa área é restrita a administradores.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
