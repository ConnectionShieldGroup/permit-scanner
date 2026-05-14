import { useCallback, useEffect, useState } from 'react';
import { supabase, SUPABASE_CONFIGURED } from '../lib/supabase';
import { MOCK_PERMITS } from '../lib/mock-permits';
import type {
  KanbanBoard,
  KanbanCard,
  KanbanColumn,
} from '../lib/types';

// Mock storage local — só pra dev sem Supabase. Pipeline começa VAZIO sempre.
const LS_KEY = 'permit-scanner.kanban.cards.v1';

function loadMockCards(): KanbanCard[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(LS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as KanbanCard[];
    return parsed.map(hydratePermit);
  } catch {
    return [];
  }
}

function hydratePermit(c: KanbanCard): KanbanCard {
  if (c.permit) return c;
  const permit = MOCK_PERMITS.find((p) => p.id === c.permit_id);
  return permit ? { ...c, permit } : c;
}

function saveMockCards(cards: KanbanCard[]) {
  if (typeof window === 'undefined') return;
  // strip permit pra nao bloatar localStorage
  const stripped = cards.map(({ permit, ...rest }) => rest);
  window.localStorage.setItem(LS_KEY, JSON.stringify(stripped));
}

function deriveBoardFromColumn(col: KanbanColumn): KanbanBoard {
  if (col === 'ativos') return 'ativos';
  if (col === 'reabordar' || col === 'descartado') return 'nao_efetivados';
  return 'pipeline';
}

export function useKanban(board?: KanbanBoard) {
  const [cards, setCards] = useState<KanbanCard[]>([]);
  const [loading, setLoading] = useState(true);

  const useMock =
    !SUPABASE_CONFIGURED ||
    (typeof window !== 'undefined' &&
      new URLSearchParams(window.location.search).has('mock'));

  const fetchData = useCallback(async () => {
    setLoading(true);
    if (useMock || !supabase) {
      const all = loadMockCards();
      setCards(board ? all.filter((c) => c.board === board) : all);
      setLoading(false);
      return;
    }
    try {
      let q = supabase
        .from('kanban_cards')
        .select('*, permit:permits(*)')
        .order('moved_at', { ascending: false });
      if (board) q = q.eq('board', board);
      const { data } = await q;
      setCards((data as KanbanCard[]) ?? []);
    } finally {
      setLoading(false);
    }
  }, [board, useMock]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Supabase Realtime — quando Reginaldo move card, Michel vê instantâneo
  useEffect(() => {
    if (useMock || !supabase) return;
    const sb = supabase;
    const channel = sb
      .channel('kanban-shared-' + (board ?? 'all'))
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'kanban_cards' },
        () => {
          fetchData();
        },
      )
      .subscribe();
    return () => {
      sb.removeChannel(channel);
    };
  }, [useMock, board, fetchData]);

  const moveCard = useCallback(
    async (cardId: string, newColumn: KanbanColumn) => {
      const newBoard = deriveBoardFromColumn(newColumn);

      if (useMock || !supabase) {
        const all = loadMockCards();
        const updated = all.map((c) =>
          c.id === cardId
            ? {
                ...c,
                column_status: newColumn,
                board: newBoard,
                moved_at: new Date().toISOString(),
              }
            : c,
        );
        saveMockCards(updated);
        setCards(board ? updated.filter((c) => c.board === board) : updated);
        return;
      }

      // Optimistic update local pra não esperar round-trip
      setCards((prev) =>
        prev.map((c) =>
          c.id === cardId
            ? { ...c, column_status: newColumn, board: newBoard, moved_at: new Date().toISOString() }
            : c,
        ),
      );
      await supabase
        .from('kanban_cards')
        .update({
          column_status: newColumn,
          board: newBoard,
          moved_at: new Date().toISOString(),
        })
        .eq('id', cardId);
      // Realtime vai disparar fetchData pra re-sincronizar
    },
    [useMock, board],
  );

  const addToPipeline = useCallback(
    async (permitId: string) => {
      if (useMock || !supabase) {
        const newCard: KanbanCard = {
          id: `card-${Date.now()}`,
          permit_id: permitId,
          board: 'pipeline',
          column_status: 'encontrado',
          notes: null,
          moved_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
        };
        const all = loadMockCards();
        // evita duplicata
        if (all.some((c) => c.permit_id === permitId)) return;
        const updated = [...all, newCard].map(hydratePermit);
        saveMockCards(updated);
        setCards(board ? updated.filter((c) => c.board === board) : updated);
        return;
      }

      // Em modo real, permitId JÁ é o UUID do banco (vem direto do select permits.*)
      // Verifica se já tá no pipeline (evita duplicata)
      const { data: existing } = await supabase
        .from('kanban_cards')
        .select('id')
        .eq('permit_id', permitId)
        .maybeSingle();
      if (existing) return;

      await supabase.from('kanban_cards').insert({
        permit_id: permitId,
        board: 'pipeline',
        column_status: 'encontrado',
      });
      // Realtime dispara fetchData
    },
    [useMock, board],
  );

  const updateNotes = useCallback(
    async (cardId: string, notes: string) => {
      if (useMock || !supabase) {
        const all = loadMockCards();
        const updated = all.map((c) => (c.id === cardId ? { ...c, notes } : c));
        saveMockCards(updated);
        setCards(board ? updated.filter((c) => c.board === board) : updated);
        return;
      }
      await supabase.from('kanban_cards').update({ notes }).eq('id', cardId);
      // Realtime dispara fetchData
    },
    [useMock, board],
  );

  return { cards, loading, moveCard, addToPipeline, updateNotes, refetch: fetchData };
}

// Export pro PermitsPage saber se permit ja esta no pipeline (modo mock só)
export function getPermitIdsInPipeline(): Set<string> {
  const all = loadMockCards();
  return new Set(all.map((c) => c.permit_id));
}
