import * as React from 'react';
import { Inbox, type LucideIcon } from 'lucide-react';
import { cn } from '../lib/cn';

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center py-16 px-6 rounded-2xl border border-dashed border-border bg-bg-card/30',
        className,
      )}
    >
      <div className="relative mb-4">
        <div className="absolute inset-0 rounded-full bg-gold-400/10 blur-2xl" />
        <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl border border-border bg-bg-card">
          <Icon className="h-6 w-6 text-gold-300" />
        </div>
      </div>
      <h3 className="text-lg font-semibold text-white tracking-tight">{title}</h3>
      {description && (
        <p className="mt-1.5 max-w-sm text-sm text-text-secondary leading-relaxed">
          {description}
        </p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
