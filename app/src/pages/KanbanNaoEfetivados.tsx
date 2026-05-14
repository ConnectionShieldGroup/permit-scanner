import { useMemo } from 'react';
import { differenceInDays } from 'date-fns';
import { XCircle, Clock } from 'lucide-react';
import { KanbanBoard } from '../components/KanbanBoard';
import { EmptyState } from '../components/EmptyState';
import { Skeleton } from '../components/ui/skeleton';
import { useKanban } from '../hooks/useKanban';
import { NAO_EFETIVADOS_COLUMNS } from '../lib/types';

export default function KanbanNaoEfetivadosPage() {
  const { cards, loading, moveCard, updateNotes, removeCard } = useKanban('nao_efetivados');

  const stats = useMemo(() => {
    const reabordar = cards.filter((c) => c.column_status === 'reabordar');
    const oldest = reabordar.reduce<number>((max, c) => {
      const days = differenceInDays(new Date(), new Date(c.moved_at));
      return Math.max(max, days);
    }, 0);
    return {
      reabordar: reabordar.length,
      descartado: cards.filter((c) => c.column_status === 'descartado').length,
      oldestDays: oldest,
    };
  }, [cards]);

  return (
    <div>
      <header className="mb-6">
        <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-danger mb-2">
          <XCircle className="h-3.5 w-3.5" />
          <span className="mono">Not closed</span>
        </div>
        <div className="flex items-baseline gap-3 flex-wrap">
          <h1 className="text-3xl font-bold tracking-tight text-white">
            Não Efetivados
          </h1>
          <span className="text-lg mono text-text-secondary">
            {cards.length} {cards.length === 1 ? 'card' : 'cards'}
          </span>
        </div>
        <p className="mt-1.5 text-sm text-text-secondary max-w-2xl">
          Leads que não fecharam. <span className="text-gold-300">Reabordar</span>{' '}
          fica em rotação para follow-up futuro.{' '}
          <span className="text-text-muted">Descartado</span> some do radar.
        </p>
      </header>

      {/* Mini stats */}
      <div className="mb-5 grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="rounded-xl border border-border bg-bg-card/40 p-3">
          <div className="text-[10px] uppercase tracking-wider text-text-muted">
            Reabordar
          </div>
          <div className="mt-0.5 text-2xl font-bold text-gold-300 mono">
            {stats.reabordar}
          </div>
        </div>
        <div className="rounded-xl border border-border bg-bg-card/40 p-3">
          <div className="text-[10px] uppercase tracking-wider text-text-muted">
            Descartado
          </div>
          <div className="mt-0.5 text-2xl font-bold text-text-secondary mono">
            {stats.descartado}
          </div>
        </div>
        {stats.oldestDays > 0 && (
          <div className="rounded-xl border border-gold-400/30 bg-gold-400/5 p-3">
            <div className="text-[10px] uppercase tracking-wider text-gold-300 flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Última tentativa
            </div>
            <div className="mt-0.5 text-2xl font-bold text-white mono">
              {stats.oldestDays}d
            </div>
          </div>
        )}
      </div>

      {loading ? (
        <Skeleton className="h-96 w-full rounded-2xl" />
      ) : cards.length === 0 ? (
        <EmptyState
          icon={XCircle}
          title="Nenhum card aqui"
          description="Cards aparecem aqui quando você move alguém para 'Não fechado' no pipeline."
        />
      ) : (
        <KanbanBoard
          board="nao_efetivados"
          columns={NAO_EFETIVADOS_COLUMNS}
          cards={cards}
          onMove={moveCard}
          onUpdateNotes={updateNotes}
          onRemove={removeCard}
        />
      )}
    </div>
  );
}
