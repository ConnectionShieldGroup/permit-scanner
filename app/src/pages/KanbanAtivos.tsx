import { Activity } from 'lucide-react';
import { KanbanBoard } from '../components/KanbanBoard';
import { EmptyState } from '../components/EmptyState';
import { Skeleton } from '../components/ui/skeleton';
import { useKanban } from '../hooks/useKanban';
import { useToast } from '../components/ui/use-toast';
import { ATIVOS_COLUMNS, type KanbanColumn } from '../lib/types';

export default function KanbanAtivosPage() {
  const { cards, loading, moveCard, updateNotes, removeCard } = useKanban('ativos');
  const { toast } = useToast();

  async function handleMove(cardId: string, newColumn: KanbanColumn) {
    await moveCard(cardId, newColumn);
    if (newColumn !== 'ativos') {
      toast({
        title: 'Cliente movido de volta',
        description: 'Card retornou para o pipeline.',
      });
    }
  }

  return (
    <div>
      <header className="mb-6">
        <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-success mb-2">
          <Activity className="h-3.5 w-3.5" />
          <span className="mono">Active customers</span>
        </div>
        <div className="flex items-baseline gap-3 flex-wrap">
          <h1 className="text-3xl font-bold tracking-tight text-white">
            Clientes Ativos
          </h1>
          <span className="text-lg mono text-text-secondary">
            {cards.length} {cards.length === 1 ? 'cliente' : 'clientes'}
          </span>
        </div>
        <p className="mt-1.5 text-sm text-text-secondary max-w-2xl">
          Contratos fechados em andamento. Arraste para fora caso precise reverter
          ao pipeline.
        </p>
      </header>

      {loading ? (
        <Skeleton className="h-96 w-full rounded-2xl" />
      ) : cards.length === 0 ? (
        <EmptyState
          icon={Activity}
          title="Nenhum cliente ativo ainda"
          description="Quando você fechar um lead no pipeline, ele aparecerá aqui automaticamente."
        />
      ) : (
        <KanbanBoard
          board="ativos"
          columns={ATIVOS_COLUMNS}
          cards={cards}
          onMove={handleMove}
          onUpdateNotes={updateNotes}
          onRemove={removeCard}
        />
      )}
    </div>
  );
}
