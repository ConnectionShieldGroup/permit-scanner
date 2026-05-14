import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { MessageSquare, Phone, Mail, CalendarClock, RefreshCw, Trash2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { useToast } from './ui/use-toast';
import { useLeadInteractions } from '../hooks/useLeads';
import {
  type Lead,
  type LeadInteraction,
  type LeadStatus,
  type LeadTemperature,
  LEAD_STATUS_COLUMNS,
} from '../lib/types';

interface LeadDialogProps {
  lead: Lead | null; // null = criar novo
  open: boolean;
  onClose: () => void;
  onSave: (patch: Partial<Lead>) => Promise<void> | void;
  onDelete?: (id: string) => Promise<void> | void;
}

const INTERACTION_ICONS = {
  note: MessageSquare,
  call: Phone,
  email: Mail,
  meeting: CalendarClock,
  status_change: RefreshCw,
} as const;

export function LeadDialog({ lead, open, onClose, onSave, onDelete }: LeadDialogProps) {
  const { toast } = useToast();
  const [name, setName] = useState('');
  const [lastName, setLastName] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [ownerCompany, setOwnerCompany] = useState('');
  const [company, setCompany] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [status, setStatus] = useState<LeadStatus>('novo');
  const [temperature, setTemperature] = useState<LeadTemperature>('morno');
  const [estimatedValue, setEstimatedValue] = useState('');
  const [source, setSource] = useState('');
  const [nextFollowup, setNextFollowup] = useState('');
  const [notes, setNotes] = useState('');
  const [newInteraction, setNewInteraction] = useState('');
  const [interactionType, setInteractionType] = useState<LeadInteraction['type']>('note');
  const [saving, setSaving] = useState(false);

  const { interactions, addInteraction } = useLeadInteractions(lead?.id ?? null);

  useEffect(() => {
    if (!open) return;
    setName(lead?.name ?? '');
    setLastName(lead?.last_name ?? '');
    setAddress(lead?.address ?? '');
    setCity(lead?.city ?? '');
    setState(lead?.state ?? '');
    setZipCode(lead?.zip_code ?? '');
    setOwnerCompany(lead?.owner_company ?? '');
    setCompany(lead?.company ?? '');
    setEmail(lead?.email ?? '');
    setPhone(lead?.phone ?? '');
    setStatus(lead?.status ?? 'novo');
    setTemperature((lead?.temperature as LeadTemperature) ?? 'morno');
    setEstimatedValue(lead?.estimated_value ? String(lead.estimated_value) : '');
    setSource(lead?.source ?? '');
    setNextFollowup(lead?.next_followup_date ?? '');
    setNotes(lead?.notes ?? '');
    setNewInteraction('');
    setInteractionType('note');
  }, [lead, open]);

  async function handleSave() {
    if (!name.trim()) {
      toast({ title: 'Erro', description: 'Nome é obrigatório.' });
      return;
    }
    setSaving(true);
    try {
      await onSave({
        name: name.trim(),
        last_name: lastName.trim() || null,
        address: address.trim() || null,
        city: city.trim() || null,
        state: state.trim() || null,
        zip_code: zipCode.trim() || null,
        owner_company: ownerCompany.trim() || null,
        company: company.trim() || null,
        email: email.trim() || null,
        phone: phone.trim() || null,
        status,
        temperature,
        estimated_value: estimatedValue ? parseFloat(estimatedValue) : null,
        source: source.trim() || null,
        next_followup_date: nextFollowup || null,
        notes: notes.trim() || null,
      });
      toast({ title: lead ? 'Lead atualizado' : 'Lead criado', description: name });
      onClose();
    } catch (err) {
      toast({ title: 'Erro', description: err instanceof Error ? err.message : 'Erro desconhecido' });
    } finally {
      setSaving(false);
    }
  }

  async function handleAddInteraction() {
    if (!newInteraction.trim()) return;
    await addInteraction(interactionType, newInteraction.trim());
    setNewInteraction('');
  }

  async function handleDelete() {
    if (!lead || !onDelete) return;
    if (!window.confirm(`Excluir lead "${lead.name}"? Esta ação não pode ser desfeita.`)) return;
    await onDelete(lead.id);
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{lead ? 'Editar lead' : 'Novo lead'}</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="lead-name">Nome *</Label>
            <Input id="lead-name" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="lead-lastname">Sobrenome</Label>
            <Input id="lead-lastname" value={lastName} onChange={(e) => setLastName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="lead-company">Empresa do lead</Label>
            <Input id="lead-company" value={company} onChange={(e) => setCompany(e.target.value)} />
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Label htmlFor="lead-address">Endereço (rua + número)</Label>
            <Input id="lead-address" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="123 Main Street" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="lead-city">Cidade</Label>
            <Input id="lead-city" value={city} onChange={(e) => setCity(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="lead-state">Estado</Label>
              <Input id="lead-state" value={state} onChange={(e) => setState(e.target.value)} placeholder="MA" maxLength={2} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lead-zip">Zip</Label>
              <Input id="lead-zip" value={zipCode} onChange={(e) => setZipCode(e.target.value)} placeholder="02180" />
            </div>
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Label htmlFor="lead-owner-company">Empresa proprietária do lead (Shield pro inc / Connection Glass / etc.)</Label>
            <Input id="lead-owner-company" value={ownerCompany} onChange={(e) => setOwnerCompany(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="lead-email">Email</Label>
            <Input id="lead-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="lead-phone">Telefone</Label>
            <Input id="lead-phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as LeadStatus)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {LEAD_STATUS_COLUMNS.map((c) => (
                  <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Temperatura</Label>
            <Select value={temperature} onValueChange={(v) => setTemperature(v as LeadTemperature)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="quente">Quente</SelectItem>
                <SelectItem value="morno">Morno</SelectItem>
                <SelectItem value="frio">Frio</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="lead-value">Valor estimado (USD)</Label>
            <Input
              id="lead-value"
              type="number"
              step="100"
              value={estimatedValue}
              onChange={(e) => setEstimatedValue(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="lead-followup">Próximo follow-up</Label>
            <Input
              id="lead-followup"
              type="date"
              value={nextFollowup}
              onChange={(e) => setNextFollowup(e.target.value)}
            />
          </div>

          <div className="space-y-1.5 md:col-span-2">
            <Label htmlFor="lead-source">Origem (de onde veio)</Label>
            <Input
              id="lead-source"
              value={source}
              onChange={(e) => setSource(e.target.value)}
              placeholder="Ex: Permit Scanner, indicação, site, etc."
            />
          </div>

          <div className="space-y-1.5 md:col-span-2">
            <Label htmlFor="lead-notes">Notas gerais</Label>
            <textarea
              id="lead-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full rounded-xl border border-border bg-bg-card px-4 py-2.5 text-sm text-white placeholder:text-text-muted outline-none transition-all focus:border-gold-400 focus:ring-2 focus:ring-gold-400/20 resize-none"
            />
          </div>
        </div>

        {/* Histórico de interações — só se já existe o lead */}
        {lead && (
          <div className="mt-6 pt-6 border-t border-border">
            <h3 className="text-sm font-semibold text-white mb-3">Histórico de interações</h3>

            <div className="flex gap-2 mb-3">
              <Select value={interactionType} onValueChange={(v) => setInteractionType(v as LeadInteraction['type'])}>
                <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="note">Nota</SelectItem>
                  <SelectItem value="call">Ligação</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="meeting">Reunião</SelectItem>
                </SelectContent>
              </Select>
              <Input
                value={newInteraction}
                onChange={(e) => setNewInteraction(e.target.value)}
                placeholder="O que aconteceu..."
                onKeyDown={(e) => e.key === 'Enter' && handleAddInteraction()}
              />
              <Button onClick={handleAddInteraction} disabled={!newInteraction.trim()}>
                Adicionar
              </Button>
            </div>

            {interactions.length === 0 ? (
              <p className="text-xs text-text-muted">Nenhuma interação registrada ainda.</p>
            ) : (
              <ul className="space-y-2 max-h-60 overflow-y-auto">
                {interactions.map((i) => {
                  const Icon = INTERACTION_ICONS[i.type];
                  return (
                    <li key={i.id} className="flex items-start gap-2 text-sm">
                      <Icon className="h-3.5 w-3.5 text-gold-400 shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className="text-text-secondary">{i.content}</p>
                        <p className="text-[10px] text-text-muted mono mt-0.5">
                          {format(new Date(i.created_at), 'MMM d, HH:mm')}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}

        <DialogFooter>
          {lead && onDelete && (
            <Button
              variant="ghost"
              onClick={handleDelete}
              className="text-red-400 hover:text-red-300 hover:bg-red-400/10 mr-auto"
            >
              <Trash2 className="h-4 w-4" />
              Excluir
            </Button>
          )}
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Salvando...' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
