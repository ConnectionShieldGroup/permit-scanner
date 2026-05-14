import { Building2, Calendar, DollarSign, Flame, Mail, Phone, User2 } from 'lucide-react';
import { format } from 'date-fns';
import type { Lead, LeadTemperature } from '../lib/types';
import { TEMPERATURE_COLORS } from '../lib/types';
import { cn } from '../lib/cn';

const USD = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

interface LeadCardProps {
  lead: Lead;
  onClick?: (lead: Lead) => void;
}

export function LeadCard({ lead, onClick }: LeadCardProps) {
  const tempColor = lead.temperature ? TEMPERATURE_COLORS[lead.temperature as LeadTemperature] : null;

  return (
    <div
      className={cn(
        'group relative rounded-xl border border-border bg-bg-card p-3 cursor-pointer',
        'transition-all duration-200',
        'hover:border-gold-400/60 hover:shadow-card-hover hover:-translate-y-0.5',
      )}
      onClick={() => onClick?.(lead)}
    >
      {tempColor && (
        <div className="absolute right-2 top-2 flex items-center gap-1 text-[10px] mono" style={{ color: tempColor }}>
          <Flame className="h-3 w-3" />
          {lead.temperature}
        </div>
      )}

      <h4 className="text-sm font-semibold text-white leading-snug truncate pr-12">
        {lead.name}
      </h4>

      {lead.company && (
        <div className="mt-1 flex items-center gap-1.5 text-xs text-text-secondary truncate">
          <Building2 className="h-3 w-3 shrink-0" />
          <span className="truncate">{lead.company}</span>
        </div>
      )}

      <div className="mt-2 space-y-1">
        {lead.phone && (
          <div className="flex items-center gap-1.5 text-[11px] text-text-secondary mono">
            <Phone className="h-3 w-3" />
            <span>{lead.phone}</span>
          </div>
        )}
        {lead.email && (
          <div className="flex items-center gap-1.5 text-[11px] text-text-secondary truncate">
            <Mail className="h-3 w-3 shrink-0" />
            <span className="truncate">{lead.email}</span>
          </div>
        )}
      </div>

      <div className="mt-2 flex items-center justify-between gap-2 text-[11px]">
        {lead.estimated_value ? (
          <span className="inline-flex items-center gap-1 text-success mono font-medium">
            <DollarSign className="h-3 w-3" />
            {USD.format(lead.estimated_value)}
          </span>
        ) : (
          <span />
        )}
        {lead.next_followup_date && (
          <span className="inline-flex items-center gap-1 text-gold-300 mono">
            <Calendar className="h-3 w-3" />
            {format(new Date(lead.next_followup_date), 'MMM d')}
          </span>
        )}
      </div>

      {lead.owner_email && (
        <div className="mt-2 pt-2 border-t border-border/50 flex items-center gap-1.5 text-[10px] text-text-muted mono truncate">
          <User2 className="h-3 w-3 shrink-0" />
          <span className="truncate">{lead.owner_email.split('@')[0]}</span>
        </div>
      )}
    </div>
  );
}
