import { NavLink, Outlet } from 'react-router-dom';
import { Activity, Database, KanbanSquare, ScanLine, XCircle } from 'lucide-react';
import { cn } from '../lib/cn';
import { SUPABASE_CONFIGURED } from '../lib/supabase';

const NAV = [
  { to: '/', label: 'Permits', icon: Database, end: true },
  { to: '/kanban', label: 'Pipeline', icon: KanbanSquare, end: false },
  { to: '/kanban/ativos', label: 'Ativos', icon: Activity, end: true },
  { to: '/kanban/nao-efetivados', label: 'Não Efetivados', icon: XCircle, end: true },
];

export function Layout() {
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
            {NAV.map(({ to, label, icon: Icon, end }) => (
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

          <div className="hidden md:flex items-center gap-2 text-xs">
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
        </div>
      </header>

      <main className="flex-1 mx-auto w-full max-w-7xl px-6 py-8">
        <Outlet />
      </main>

      <footer className="border-t border-border/60 mt-12">
        <div className="mx-auto max-w-7xl px-6 py-5 flex items-center justify-between text-xs text-text-muted">
          <span className="mono">Powered by Connection Glass + Shield Pro</span>
          <span className="mono opacity-60">v0.1.0</span>
        </div>
      </footer>
    </div>
  );
}
