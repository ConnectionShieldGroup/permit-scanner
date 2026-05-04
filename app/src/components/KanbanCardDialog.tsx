import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import {
  Calendar,
  DollarSign,
  ExternalLink,
  Mail,
  MapPin,
  Phone,
  User2,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import {
  type KanbanCard,
  WORK_TYPE_LABELS,
  WORK_TYPE_COLORS,
} from '../lib/types';
import { buildRouteUrl, formatAddressForMaps } from '../lib/google-maps';
import { useToast } from './ui/use-toast';

const USD = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

interface KanbanCardDialogProps {
  card: KanbanCard | null;
  onClose: () => void;
  onSaveNotes: (notes: string) => void;
}

export function KanbanCardDialog({
  card,
  onClose,
  onSaveNotes,
}: KanbanCardDialogProps) {
  const [notes, setNotes] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    setNotes(card?.notes ?? '');
  }, [card]);

  if (!card?.permit) return null;
  const p = card.permit;
  const workColor = WORK_TYPE_COLORS[p.work_type];

  function openInMaps() {
    const url = buildRouteUrl([formatAddressForMaps(p.address, p.city, p.state)]);
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  function save() {
    onSaveNotes(notes);
    toast({ title: 'Notes saved', description: 'Card updated successfully.' });
    onClose();
  }

  return (
    <Dialog open={!!card} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <div className="flex items-center gap-2 text-xs mono text-text-muted mb-1">
            <span>{p.permit_number}</span>
            <span className="opacity-40">•</span>
            <Calendar className="h-3 w-3" />
            <span>{format(new Date(p.permit_date), 'MMM d, yyyy')}</span>
          </div>
          <DialogTitle>{p.address}</DialogTitle>
          <DialogDescription className="flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5 text-gold-400/70" />
            {p.city}, {p.state}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Badge
              style={{
                borderColor: `${workColor}40`,
                backgroundColor: `${workColor}12`,
                color: workColor,
              }}
            >
              {WORK_TYPE_LABELS[p.work_type]}
            </Badge>
            {p.estimated_value && (
              <span className="inline-flex items-center gap-1 text-sm mono text-white">
                <DollarSign className="h-3.5 w-3.5 text-text-muted" />
                {USD.format(p.estimated_value)}
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <DetailRow icon={User2} label="Applicant">
              {p.applicant_name ?? '—'}
            </DetailRow>
            <DetailRow icon={Phone} label="Phone">
              {p.phone ? (
                <a href={`tel:${p.phone}`} className="hover:text-gold-300 mono">
                  {p.phone}
                </a>
              ) : (
                <span className="text-text-muted">—</span>
              )}
            </DetailRow>
            <DetailRow icon={Mail} label="Email" className="sm:col-span-2">
              {p.email ? (
                <a
                  href={`mailto:${p.email}`}
                  className="hover:text-gold-300 break-all"
                >
                  {p.email}
                </a>
              ) : (
                <span className="text-text-muted">—</span>
              )}
            </DetailRow>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="notes">Notes</Label>
            <textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              placeholder="Add follow-up notes, contacts, next steps..."
              className="w-full rounded-xl border border-border bg-bg-card px-4 py-2.5 text-sm text-white placeholder:text-text-muted outline-none transition-all focus:border-gold-400 focus:ring-2 focus:ring-gold-400/20 resize-none"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={openInMaps}>
            <ExternalLink className="h-4 w-4" />
            Open in Maps
          </Button>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save}>Save notes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DetailRow({
  icon: Icon,
  label,
  children,
  className,
}: {
  icon: React.ElementType;
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <div className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-text-muted mb-1">
        <Icon className="h-3 w-3" />
        {label}
      </div>
      <div className="text-sm text-text-secondary">{children}</div>
    </div>
  );
}
