import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Database, Search } from 'lucide-react';
import { FiltersBar } from '../components/FiltersBar';
import { PermitCard, PermitCardSkeleton } from '../components/PermitCard';
import { PermitDetailDialog } from '../components/PermitDetailDialog';
import { RouteButton } from '../components/RouteButton';
import { EmptyState } from '../components/EmptyState';
import { usePermits } from '../hooks/usePermits';
import { useKanban } from '../hooks/useKanban';
import { useToast } from '../components/ui/use-toast';
import { ACTIVE_CITIES, type Permit, type PermitFilters } from '../lib/types';

export default function PermitsPage() {
  // Sem city default — mostra TODAS as cidades ativas (V1: 4 cidades MA)
  const [filters, setFilters] = useState<PermitFilters>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [detailPermit, setDetailPermit] = useState<Permit | null>(null);

  const navigate = useNavigate();
  const { permits, loading, isMock } = usePermits(filters);
  const { cards, addToPipeline } = useKanban();
  const { toast } = useToast();

  // Só considera "in pipeline" se o card de fato estiver no board pipeline
  // (cards em ativos/nao_efetivados liberam o "Add to pipeline" pra trazer de volta)
  const inPipeline = useMemo(
    () => new Set(cards.filter((c) => c.board === 'pipeline').map((c) => c.permit_id)),
    [cards],
  );

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return permits;
    return permits.filter(
      (p) =>
        p.address.toLowerCase().includes(q) ||
        p.applicant_name?.toLowerCase().includes(q) ||
        p.permit_number.toLowerCase().includes(q),
    );
  }, [permits, searchQuery]);

  const selectedPermits = useMemo(
    () => filtered.filter((p) => selectedIds.has(p.id)),
    [filtered, selectedIds],
  );

  function handleAddToPipeline(p: Permit) {
    addToPipeline(p.id);
    toast({
      title: 'Added to pipeline',
      description: `${p.address} → Permits encontrados`,
    });
    navigate('/kanban');
  }

  function toggleRoute(p: Permit, selected: boolean) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (selected) next.add(p.id);
      else next.delete(p.id);
      return next;
    });
  }

  return (
    <div>
      <header className="mb-6 flex items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-gold-400 mb-2">
            <Database className="h-3.5 w-3.5" />
            <span className="mono">Live permits feed</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-white">
            Building permits in{' '}
            <span className="text-gold-gradient">
              {filters.city ? `${filters.city}, MA` : `${ACTIVE_CITIES.length} MA cities`}
            </span>
          </h1>
          <p className="mt-1.5 text-sm text-text-secondary max-w-2xl">
            {filtered.length} relevant residential permits from the latest
            reporting periods. Click any permit to see full details, add to
            pipeline, or select multiple to build a multi-stop visit route.
          </p>
        </div>
        {isMock && (
          <span className="hidden md:inline-flex items-center gap-1.5 rounded-full border border-gold-400/30 bg-gold-400/10 px-3 py-1 text-xs mono text-gold-300">
            <span className="h-1.5 w-1.5 rounded-full bg-gold-400 animate-pulse-dot" />
            Mock mode
          </span>
        )}
      </header>

      <FiltersBar
        filters={filters}
        searchQuery={searchQuery}
        onFiltersChange={setFilters}
        onSearchChange={setSearchQuery}
        resultCount={filtered.length}
      />

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <PermitCardSkeleton key={i} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Search}
          title="No permits match your filters"
          description="Try widening the date range or clearing the work type filter."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 animate-fade-in">
          {filtered.map((permit) => (
            <PermitCard
              key={permit.id}
              permit={permit}
              variant="list"
              selected={selectedIds.has(permit.id)}
              alreadyInPipeline={inPipeline.has(permit.id)}
              onAddToPipeline={handleAddToPipeline}
              onSelectForRoute={toggleRoute}
              onClick={setDetailPermit}
            />
          ))}
        </div>
      )}

      <RouteButton
        selected={selectedPermits}
        onClear={() => setSelectedIds(new Set())}
      />

      <PermitDetailDialog
        permit={detailPermit}
        open={!!detailPermit}
        onOpenChange={(open) => !open && setDetailPermit(null)}
        onAddToPipeline={(p) => {
          handleAddToPipeline(p);
          setDetailPermit(null);
        }}
        alreadyInPipeline={detailPermit ? inPipeline.has(detailPermit.id) : false}
      />
    </div>
  );
}
