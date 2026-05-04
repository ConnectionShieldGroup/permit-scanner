import { format } from 'date-fns';
import {
  Calendar,
  CheckCircle2,
  DollarSign,
  ExternalLink,
  FileText,
  Mail,
  MapPin,
  Phone,
  Plus,
  User2,
  Building2,
  Hash,
} from 'lucide-react';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { type Permit, WORK_TYPE_LABELS, WORK_TYPE_COLORS } from '../lib/types';

const USD = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

interface PermitDetailDialogProps {
  permit: Permit | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddToPipeline?: (permit: Permit) => void;
  alreadyInPipeline?: boolean;
}

export function PermitDetailDialog({
  permit,
  open,
  onOpenChange,
  onAddToPipeline,
  alreadyInPipeline = false,
}: PermitDetailDialogProps) {
  if (!permit) return null;

  const workColor = WORK_TYPE_COLORS[permit.work_type];
  const ownerName = (permit.raw_data?.owner_name as string | undefined) || null;
  const mapBlockLot = (permit.raw_data?.map_block_lot as string | undefined) || null;
  const zone = (permit.raw_data?.zone as string | undefined) || null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Top accent */}
        <div
          className="-mt-6 -mx-6 mb-2 h-1 rounded-t-lg"
          style={{
            background: `linear-gradient(90deg, ${workColor}, ${workColor}40, transparent)`,
          }}
        />

        <DialogHeader className="pt-2">
          <div className="flex items-center gap-2 text-xs mono text-text-muted mb-1">
            <span>{permit.city}, {permit.state}</span>
            <span className="opacity-40">•</span>
            <span>{permit.permit_number}</span>
          </div>
          <DialogTitle className="text-2xl font-bold tracking-tight text-white leading-tight">
            {permit.address}
          </DialogTitle>
          <div className="mt-2 flex items-center gap-2 flex-wrap">
            <Badge
              variant="default"
              style={{
                borderColor: `${workColor}40`,
                backgroundColor: `${workColor}12`,
                color: workColor,
              }}
            >
              {WORK_TYPE_LABELS[permit.work_type]}
            </Badge>
          </div>

          {/* Datas formais do permit — explícitas pra não confundir com data de scrape */}
          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
            {permit.application_date && (
              <div>
                <div className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-text-muted mb-1">
                  <Calendar className="h-3 w-3" />
                  <span>Application date</span>
                </div>
                <div className="text-text-primary mono">
                  {format(new Date(permit.application_date), 'MMM d, yyyy')}
                </div>
              </div>
            )}
            <div>
              <div className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-gold-400 mb-1">
                <Calendar className="h-3 w-3" />
                <span>Permit issued</span>
              </div>
              <div className="text-white mono font-semibold">
                {format(new Date(permit.permit_date), 'MMM d, yyyy')}
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-5 mt-4">
          {/* Description */}
          {permit.description && (
            <Section icon={FileText} label="Description">
              <p className="text-sm text-text-primary leading-relaxed">
                {permit.description}
              </p>
            </Section>
          )}

          {/* Estimated value — destacado */}
          {permit.estimated_value && (
            <div className="rounded-xl border border-gold-400/30 bg-gold-400/5 p-4">
              <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-gold-400 mb-1">
                <DollarSign className="h-3.5 w-3.5" />
                <span>Estimated Project Value</span>
              </div>
              <div className="text-3xl font-bold text-white mono">
                {USD.format(permit.estimated_value)}
              </div>
            </div>
          )}

          {/* Applicant */}
          <Section icon={User2} label="Applicant">
            <div className="space-y-2">
              <p className="text-sm font-semibold text-white">
                {permit.applicant_name ?? '—'}
              </p>
              <div className="flex flex-col gap-1.5 text-sm">
                {permit.phone && (
                  <a
                    href={`tel:${permit.phone}`}
                    className="inline-flex items-center gap-2 text-text-secondary hover:text-gold-300 transition-colors w-fit"
                  >
                    <Phone className="h-3.5 w-3.5" />
                    <span className="mono">{permit.phone}</span>
                  </a>
                )}
                {permit.email && (
                  <a
                    href={`mailto:${permit.email}`}
                    className="inline-flex items-center gap-2 text-text-secondary hover:text-gold-300 transition-colors w-fit"
                  >
                    <Mail className="h-3.5 w-3.5" />
                    <span>{permit.email}</span>
                  </a>
                )}
                {!permit.phone && !permit.email && (
                  <span className="text-xs text-text-muted italic">
                    No contact info available
                  </span>
                )}
              </div>
            </div>
          </Section>

          {/* Owner */}
          {ownerName && (
            <Section icon={Building2} label="Owner">
              <p className="text-sm text-text-primary">{ownerName}</p>
            </Section>
          )}

          {/* Property details */}
          {(mapBlockLot || zone) && (
            <Section icon={MapPin} label="Property">
              <div className="grid grid-cols-2 gap-3 text-sm">
                {mapBlockLot && (
                  <div>
                    <div className="text-xs text-text-muted">Map / Block / Lot</div>
                    <div className="mono text-text-primary">{mapBlockLot}</div>
                  </div>
                )}
                {zone && (
                  <div>
                    <div className="text-xs text-text-muted">Zoning</div>
                    <div className="mono text-text-primary">{zone}</div>
                  </div>
                )}
              </div>
            </Section>
          )}

          {/* Status */}
          {permit.status_source && (
            <Section icon={Hash} label="Status">
              <Badge variant="default" className="text-xs">
                {permit.status_source}
              </Badge>
            </Section>
          )}
        </div>

        {/* Footer actions */}
        <div className="mt-6 pt-5 border-t border-border flex items-center gap-3 flex-wrap">
          {onAddToPipeline && (
            <Button
              variant="default"
              onClick={() => onAddToPipeline(permit)}
              disabled={alreadyInPipeline}
              className="flex-1 sm:flex-initial"
            >
              {alreadyInPipeline ? (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Already in pipeline
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  Add to pipeline
                </>
              )}
            </Button>
          )}
          {/* Source link aponta pra lista pública (publicview.php).
              residentialview.php direto não preenche dados (PermitEyes carrega
              campos via JS interno). Aqui Reginaldo pode buscar pelo permit_number
              se quiser conferir a fonte original. */}
          <a
            href={`https://permiteyes.us/${permit.city.toLowerCase()}/publicview.php`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm text-text-secondary hover:text-gold-300 transition-colors"
            title={`Open city permit portal — search for ${permit.permit_number}`}
          >
            <ExternalLink className="h-3.5 w-3.5" />
            <span>View source on city portal</span>
          </a>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Section({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ElementType;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-text-muted mb-2">
        <Icon className="h-3 w-3" />
        <span>{label}</span>
      </div>
      {children}
    </div>
  );
}
