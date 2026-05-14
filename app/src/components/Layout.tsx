import { NavLink, Outlet } from 'react-router-dom';
import { Activity, Database, KanbanSquare, LogOut, ScanLine, Target, Users, XCircle } from 'lucide-react';
import { cn } from '../lib/cn';
import { SUPABASE_CONFIGURED } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';

const NAV = [
  { to: '/', label: 'Permits', icon: Database, end: true, role: null },
  { to: '/kanban', label: 'Pipeline', icon: KanbanSquare, end: false, role: null },
  { to: '/kanban/ativos', label: 'Ativos', icon: Activity, end: true, role: null },
  { to: '/kanban/nao-efetivados', label: 'Não Efetivados', icon: XCircle, end: true, role: null },
  { to: '/crm', label: 'CRM', icon: Target, end: false, role: null },
  { to: '/admin/users', label: 'Usuários', icon: Users, end: true, role: 'admin' as const },
];

export function Layout() {
  const { user, role, signOut } = useAuth();

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-bg-primary/80 backdrop-blur-xl">
        <div className="mx-auto max-w-7xl px-6 py-4 flex items-center justify-between gap-6">
          <div className="flex items-center gap-2.5">
            <div className="relative">
              <ScanLine className="h-6 w-6 text-gold-300" strokeWidth={2.25} />
              <span className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-gold-400 animate-pulse-dot" />
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-base font-bold tracking-tight text-white">
                PERMIT
              </span>
              <span className="text-base font-bold tracking-tight text-gold-gradient">
                SCANNER
              </span>
            </div>
          </div>

          <nav className="flex items-center gap-1">
            {NAV.filter((n) => !n.role || n.role === role).map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  cn(
                    'relative flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-all',
                    isActive
                      ? 'text-gold-300 bg-gold-400/5'
                      : 'text-text-secondary hover:text-white',
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon className="h-4 w-4" />
                    <span className="hidden sm:inline">{label}</span>
                    {isActive && (
                      <span className="absolute -bottom-px left-3 right-3 h-px bg-gold-gradient" />
                    )}
                  </>
                )}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-3 text-xs">
            <div className="hidden md:flex items-center gap-2">
              <span
                className={cn(
                  'h-2 w-2 rounded-full',
                  SUPABASE_CONFIGURED ? 'bg-success animate-pulse-dot' : 'bg-gold-400',
                )}
              />
              <span className="mono text-text-muted">
                {SUPABASE_CONFIGURED ? 'LIVE' : 'MOCK'}
              </span>
            </div>
            {user && (
              <div className="flex items-center gap-2">
                <span className="hidden lg:inline text-text-secondary mono truncate max-w-[180px]">
                  {user.email}
                </span>
                <button
                  onClick={() => signOut()}
                  className="flex items-center gap-1.5 rounded-xl border border-border bg-bg-card px-2.5 py-1.5 text-text-secondary hover:text-white hover:border-gold-400/40 transition-all"
                  title="Sair"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Sair</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 mx-auto w-full max-w-7xl px-6 py-8">
        <Outlet />
      </main>

      <footer className="border-t border-border/60 mt-12">
        <div className="mx-auto max-w-7xl px-6 py-5 flex items-center justify-between text-xs text-text-muted">
          <span className="mono">Powered by Connection Glass + Shield Pro</span>
          <span className="mono opacity-60">v0.2.0</span>
        </div>
      </footer>
    </div>
  );
}
