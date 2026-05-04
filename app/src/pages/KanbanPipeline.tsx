import { useMemo } from 'react';
import { KanbanSquare } from 'lucide-react';
import { KanbanBoard } from '../components/KanbanBoard';
import { EmptyState } from '../components/EmptyState';
import { Skeleton } from '../components/ui/skeleton';
import { useKanban } from '../hooks/useKanban';
import { useToast } from '../components/ui/use-toast';
import { PIPELINE_COLUMNS, type KanbanColumn } from '../lib/types';

const PIPELINE_KEYS = new Set<KanbanColumn>(
  PIPELINE_COLUMNS.map((c) => c.key),
);

export default function KanbanPipelinePage() {
  const { cards, loading, moveCard, updateNotes } = useKanban('pipeline');
  const { toast } = useToast();

  // Filter cards: pipeline keys only (in case of stale move)
  const pipelineCards = useMemo(
    () => cards.filter((c) => PIPELINE_KEYS.has(c.column_status)),
    [cards],
  );

  const stats = useMemo(() => {
    const byCol = new Map<string, number>();
    pipelineCards.forEach((c) =>
      byCol.set(c.column_status, (byCol.get(c.column_status) ?? 0) + 1),
    );
    return byCol;
  }, [pipelineCards]);

  async function handleMove(cardId: string, newColumn: KanbanColumn) {
    const card = cards.find((c) => c.id === cardId);
    await moveCard(cardId, newColumn);

    // Mensagem contextual quando sai do pipeline
    if (newColumn === 'cliente') {
      toast({
        title: 'Cliente fechado',
        description: `${card?.permit?.address ?? 'Card'} movido para Clientes Ativos.`,
      });
    } else if (newColumn === 'nao_fechado') {
      toast({
        title: 'Movido para Não Efetivados',
        description: `${card?.permit?.address ?? 'Card'} arquivado em Reabordar.`,
      });
    }
  }

  return (
    <div>
      <header className="mb-6">
        <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-gold-400 mb-2">
          <KanbanSquare className="h-3.5 w-3.5" />
          <span className="mono">Sales pipeline</span>
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-white">
          Pipeline de prospecção
        </h1>
        <p className="mt-1.5 text-sm text-text-secondary max-w-2xl">
          Arraste cards entre colunas para avançar o lead. Soltar em{' '}
          <span className="text-success font-medium">Cliente</span> move para Ativos;{' '}
          <span className="text-danger font-medium">Não fechado</span> arquiva em
          Não Efetivados.
        </p>
      </header>

      {/* KPIs por coluna */}
      <div className="hidden md:grid mb-5 grid-cols-6 gap-2">
        {PIPELINE_COLUMNS.map((col) => (
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
      ) : pipelineCards.length === 0 ? (
        <EmptyState
          icon={KanbanSquare}
          title="Pipeline vazio"
          description="Vá para Permits e adicione prospects ao pipeline para começar."
        />
      ) : (
        <KanbanBoard
          board="pipeline"
          columns={PIPELINE_COLUMNS}
          cards={pipelineCards}
          onMove={handleMove}
          onUpdateNotes={updateNotes}
        />
      )}
    </div>
  );
}
