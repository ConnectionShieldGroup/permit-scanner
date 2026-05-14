import { useMemo, useState } from 'react';
import { DragDropContext, Draggable, Droppable, type DropResult } from '@hello-pangea/dnd';
import { Plus, UserPlus, Search } from 'lucide-react';
import { useLeads } from '../hooks/useLeads';
import { LeadCard } from '../components/LeadCard';
import { LeadDialog } from '../components/LeadDialog';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Skeleton } from '../components/ui/skeleton';
import { LEAD_STATUS_COLUMNS, type Lead, type LeadStatus } from '../lib/types';

export default function CrmPipelinePage() {
  const { leads, loading, createLead, updateLead, moveLead, deleteLead } = useLeads();
  const [searchQuery, setSearchQuery] = useState('');
  const [openLead, setOpenLead] = useState<Lead | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return leads;
    return leads.filter(
      (l) =>
        l.name.toLowerCase().includes(q) ||
        (l.company?.toLowerCase().includes(q) ?? false) ||
        (l.email?.toLowerCase().includes(q) ?? false) ||
        (l.phone?.includes(q) ?? false),
    );
  }, [leads, searchQuery]);

  const stats = useMemo(() => {
    const byStatus = new Map<LeadStatus, number>();
    filtered.forEach((l) => byStatus.set(l.status, (byStatus.get(l.status) ?? 0) + 1));
    return byStatus;
  }, [filtered]);

  function handleDragEnd(result: DropResult) {
    const { destination, source, draggableId } = result;
    if (!destination) return;
    if (destination.droppableId === source.droppableId) return;
    moveLead(draggableId, destination.droppableId as LeadStatus);
  }

  function openNewLead() {
    setOpenLead(null);
    setDialogOpen(true);
  }

  function openExistingLead(lead: Lead) {
    setOpenLead(lead);
    setDialogOpen(true);
  }

  async function handleSave(patch: Partial<Lead>) {
    if (openLead) {
      await updateLead(openLead.id, patch);
    } else {
      await createLead(patch);
    }
  }

  return (
    <div>
      <header className="mb-6 flex items-end justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-gold-400 mb-2">
            <UserPlus className="h-3.5 w-3.5" />
            <span className="mono">CRM</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-white">
            Pipeline de Leads
          </h1>
          <p className="mt-1.5 text-sm text-text-secondary max-w-2xl">
            Gerencie clientes potenciais. Arraste entre colunas pra atualizar status. Clique no card pra editar e ver histórico.
          </p>
        </div>
        <Button onClick={openNewLead}>
          <Plus className="h-4 w-4" />
          Novo lead
        </Button>
      </header>

      <div className="mb-5 flex gap-3 items-center flex-wrap">
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por nome, empresa, email, telefone..."
            className="pl-9"
          />
        </div>
        <div className="text-xs text-text-muted mono">
          {filtered.length} {filtered.length === 1 ? 'lead' : 'leads'}
        </div>
      </div>

      {/* KPIs */}
      <div className="hidden md:grid mb-5 grid-cols-6 gap-2">
        {LEAD_STATUS_COLUMNS.map((col) => (
          <div
            key={col.key}
            className="rounded-xl border border-border bg-bg-card/40 px-3 py-2"
            style={{ borderTopWidth: 2, borderTopColor: col.accent }}
          >
            <div className="text-[10px] uppercase tracking-wider text-text-muted truncate">
              {col.label}
            </div>
            <div className="mt-0.5 text-lg font-semibold text-white mono">
              {stats.get(col.key) ?? 0}
            </div>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="flex gap-3 overflow-x-auto">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-96 w-72 shrink-0 rounded-2xl" />
          ))}
        </div>
      ) : (
        <DragDropContext onDragEnd={handleDragEnd}>
          <div className="flex gap-3 overflow-x-auto pb-4 -mx-2 px-2">
            {LEAD_STATUS_COLUMNS.map((col) => {
              const colLeads = filtered.filter((l) => l.status === col.key);
              return (
                <div
                  key={col.key}
                  className="w-72 shrink-0 rounded-2xl border border-border bg-bg-card/30"
                >
                  <div
                    className="px-3 py-2.5 border-b border-border/60 flex items-center justify-between"
                    style={{ borderTopWidth: 2, borderTopColor: col.accent, borderTopLeftRadius: 14, borderTopRightRadius: 14 }}
                  >
                    <span className="text-xs font-semibold text-white uppercase tracking-wider">
                      {col.label}
                    </span>
                    <span className="text-xs mono text-text-muted">
                      {colLeads.length}
                    </span>
                  </div>
                  <Droppable droppableId={col.key}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={`p-2 space-y-2 min-h-[200px] ${snapshot.isDraggingOver ? 'bg-gold-400/5' : ''}`}
                      >
                        {colLeads.map((lead, idx) => (
                          <Draggable key={lead.id} draggableId={lead.id} index={idx}>
                            {(prov) => (
                              <div
                                ref={prov.innerRef}
                                {...prov.draggableProps}
                                {...prov.dragHandleProps}
                              >
                                <LeadCard lead={lead} onClick={openExistingLead} />
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                        {colLeads.length === 0 && (
                          <div className="text-center text-xs text-text-muted py-8">
                            Vazio
                          </div>
                        )}
                      </div>
                    )}
                  </Droppable>
                </div>
              );
            })}
          </div>
        </DragDropContext>
      )}

      <LeadDialog
        lead={openLead}
        open={dialogOpen}
        onClose={() => { setDialogOpen(false); setOpenLead(null); }}
        onSave={handleSave}
        onDelete={openLead ? deleteLead : undefined}
      />
    </div>
  );
}
