import { format } from 'date-fns';
import {
  Calendar,
  CheckCircle2,
  DollarSign,
  ExternalLink,
  GripVertical,
  Mail,
  MapPin,
  Phone,
  Plus,
  User2,
} from 'lucide-react';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { cn } from '../lib/cn';
import { type Permit, WORK_TYPE_LABELS, WORK_TYPE_COLORS } from '../lib/types';

const USD = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

interface PermitCardProps {
  permit: Permit;
  variant?: 'list' | 'kanban';
  onAddToPipeline?: (permit: Permit) => void;
  onSelectForRoute?: (permit: Permit, selected: boolean) => void;
  onClick?: (permit: Permit) => void;
  selected?: boolean;
  alreadyInPipeline?: boolean;
  dragHandle?: boolean;
  className?: string;
}

export function PermitCard({
  permit,
  variant = 'list',
  onAddToPipeline,
  onSelectForRoute,
  onClick,
  selected = false,
  alreadyInPipeline = false,
  dragHandle = false,
  className,
}: PermitCardProps) {
  const workColor = WORK_TYPE_COLORS[permit.work_type];

  if (variant === 'kanban') {
    return (
      <div
        className={cn(
          'group relative rounded-xl border border-border bg-bg-card p-3 cursor-pointer',
          'transition-all duration-200',
          'hover:border-gold-400/60 hover:shadow-card-hover hover:-translate-y-0.5',
          selected && 'border-gold-400 ring-2 ring-gold-400/30',
          className,
        )}
        onClick={() => onClick?.(permit)}
      >
        <div className="flex items-start gap-2">
          {dragHandle && (
            <div className="pt-0.5 text-text-muted opacity-40 group-hover:opacity-100 transition-opacity">
              <GripVertical className="h-4 w-4" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-semibold text-white leading-snug truncate">
              {permit.address}
            </h4>
            {permit.description && (
              <p className="mt-1 text-[11px] text-text-secondary line-clamp-2 leading-snug">
                {permit.description}
              </p>
            )}
            <div className="mt-1 flex items-center gap-1.5 text-xs text-text-muted">
              <span className="mono">{permit.permit_number}</span>
              <span className="opacity-40">•</span>
              <span>Issued {format(new Date(permit.permit_date), 'MMM d, yyyy')}</span>
            </div>
            <div className="mt-2 flex items-center gap-1.5 flex-wrap">
              <span
                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium border"
                style={{
                  borderColor: `${workColor}30`,
                  backgroundColor: `${workColor}10`,
                  color: workColor,
                }}
              >
                {WORK_TYPE_LABELS[permit.work_type]}
              </span>
              {permit.estimated_value && (
                <span className="text-[11px] text-text-secondary mono">
                  {USD.format(permit.estimated_value)}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // variant === 'list'
  return (
    <div
      className={cn(
        'group relative rounded-2xl border border-border bg-bg-card overflow-hidden',
        'transition-all duration-300',
        'hover:border-gold-400/60 hover:shadow-card-hover hover:-translate-y-0.5',
        selected && 'border-gold-400 ring-2 ring-gold-400/20',
        onClick && 'cursor-pointer',
        className,
      )}
      onClick={() => onClick?.(permit)}
    >
      {/* Top accent bar coloring por work_type */}
      <div
        className="h-0.5 w-full"
        style={{
          background: `linear-gradient(90deg, ${workColor}, ${workColor}40, transparent)`,
        }}
      />
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 text-xs mono text-text-muted mb-1.5">
              <span>{permit.permit_number}</span>
              <span className="opacity-40">•</span>
              <Calendar className="h-3 w-3" />
              <span>Issued {format(new Date(permit.permit_date), 'MMM d, yyyy')}</span>
            </div>
            <h3 className="text-lg font-semibold text-white leading-tight tracking-tight">
              {permit.address}
            </h3>
            <div className="mt-1 flex items-center gap-1 text-xs text-text-secondary">
              <MapPin className="h-3 w-3 text-gold-400/70" />
              <span>
                {permit.city}, {permit.state}
              </span>
            </div>
            {permit.description && (
              <p className="mt-2 text-sm text-text-secondary leading-snug line-clamp-2">
                {permit.description}
              </p>
            )}
          </div>
          <Badge
            variant="default"
            className="shrink-0"
            style={{
              borderColor: `${workColor}40`,
              backgroundColor: `${workColor}12`,
              color: workColor,
            }}
          >
            {WORK_TYPE_LABELS[permit.work_type]}
          </Badge>
        </div>

        {/* Applicant + value */}
        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <div className="flex items-start gap-2 min-w-0">
            <User2 className="h-3.5 w-3.5 text-text-muted shrink-0 mt-0.5" />
            <span className="text-text-secondary truncate">
              {permit.applicant_name ?? '—'}
            </span>
          </div>
          <div className="flex items-start gap-2 min-w-0 justify-end">
            <DollarSign className="h-3.5 w-3.5 text-text-muted shrink-0 mt-0.5" />
            <span
              className={cn(
                'mono text-right',
                permit.estimated_value ? 'text-white' : 'text-text-muted',
              )}
            >
              {permit.estimated_value
                ? USD.format(permit.estimated_value)
                : 'No value'}
            </span>
          </div>
        </div>

        {/* Contact row */}
        {(permit.phone || permit.email) && (
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs">
            {permit.phone && (
              <a
                href={`tel:${permit.phone}`}
                className="flex items-center gap-1.5 text-text-secondary hover:text-gold-300 transition-colors"
                onClick={(e) => e.stopPropagation()}
              >
                <Phone className="h-3 w-3" />
                <span className="mono">{permit.phone}</span>
              </a>
            )}
            {permit.email && (
              <a
                href={`mailto:${permit.email}`}
                className="flex items-center gap-1.5 text-text-secondary hover:text-gold-300 transition-colors"
                onClick={(e) => e.stopPropagation()}
              >
                <Mail className="h-3 w-3" />
                <span className="truncate">{permit.email}</span>
              </a>
            )}
          </div>
        )}
      </div>

      {/* Footer actions */}
      {(onAddToPipeline || onSelectForRoute) && (
        <div className="flex items-stretch border-t border-border/60 divide-x divide-border/60">
          {onAddToPipeline && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (!alreadyInPipeline) onAddToPipeline(permit);
              }}
              disabled={alreadyInPipeline}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 px-4 py-3 text-xs font-medium transition-colors',
                alreadyInPipeline
                  ? 'text-success cursor-default'
                  : 'text-text-secondary hover:bg-gold-400/5 hover:text-gold-300',
              )}
            >
              {alreadyInPipeline ? (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  In pipeline
                </>
              ) : (
                <>
                  <Plus className="h-3.5 w-3.5" />
                  Add to pipeline
                </>
              )}
            </button>
          )}
          {onSelectForRoute && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onSelectForRoute(permit, !selected);
              }}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 px-4 py-3 text-xs font-medium transition-colors',
                selected
                  ? 'bg-gold-400/10 text-gold-300'
                  : 'text-text-secondary hover:bg-gold-400/5 hover:text-gold-300',
              )}
            >
              <MapPin className="h-3.5 w-3.5" />
              {selected ? 'Selected for route' : 'Select for route'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export function PermitCardSkeleton() {
  return (
    <div className="rounded-2xl border border-border bg-bg-card overflow-hidden animate-pulse">
      <div className="h-0.5 w-full bg-bg-secondary" />
      <div className="p-5 space-y-3">
        <div className="h-3 w-32 rounded bg-bg-secondary" />
        <div className="h-5 w-3/4 rounded bg-bg-secondary" />
        <div className="h-3 w-24 rounded bg-bg-secondary" />
        <div className="grid grid-cols-2 gap-3 pt-2">
          <div className="h-3 w-full rounded bg-bg-secondary" />
          <div className="h-3 w-full rounded bg-bg-secondary" />
        </div>
      </div>
      <div className="h-11 border-t border-border bg-bg-secondary/40" />
    </div>
  );
}
