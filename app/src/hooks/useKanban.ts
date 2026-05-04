import { useCallback, useEffect, useState } from 'react';
import { supabase, SUPABASE_CONFIGURED } from '../lib/supabase';
import { MOCK_PERMITS } from '../lib/mock-permits';
import type {
  KanbanBoard,
  KanbanCard,
  KanbanColumn,
} from '../lib/types';

// Mock storage local — persiste em localStorage pra estado nao sumir on reload
const LS_KEY = 'permit-scanner.kanban.cards.v1';

function loadMockCards(): KanbanCard[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(LS_KEY);
    if (!raw) return seedMockCards();
    const parsed = JSON.parse(raw) as KanbanCard[];
    return parsed.map(hydratePermit);
  } catch {
    return seedMockCards();
  }
}

function hydratePermit(c: KanbanCard): KanbanCard {
  if (c.permit) return c;
  const permit = MOCK_PERMITS.find((p) => p.id === c.permit_id);
  return permit ? { ...c, permit } : c;
}

function seedMockCards(): KanbanCard[] {
  // Pre-popula 4 cards no pipeline para nao iniciar vazio
  const seed: KanbanCard[] = [
    {
      id: 'card-001',
      permit_id: 'mock-002',
      board: 'pipeline',
      column_status: 'visitado',
      notes: 'Visitei na quarta. Owner estava receptivo.',
      moved_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    },
    {
      id: 'card-002',
      permit_id: 'mock-005',
      board: 'pipeline',
      column_status: 'apresentacao',
      notes: 'Enviei deck institucional sexta.',
      moved_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    },
    {
      id: 'card-003',
      permit_id: 'mock-007',
      board: 'pipeline',
      column_status: 'proposta',
      notes: 'Proposta de $18,500 — aguardando assinatura.',
      moved_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    },
    {
      id: 'card-004',
      permit_id: 'mock-009',
      board: 'ativos',
      column_status: 'ativos',
      notes: 'Fechou — instalação agendada pra próxima semana.',
      moved_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    },
  ];
  saveMockCards(seed);
  return seed.map(hydratePermit);
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
      await new Promise((r) => setTimeout(r, 200));
      const all = loadMockCards();
      setCards(board ? all.filter((c) => c.board === board) : all);
      setLoading(false);
      return;
    }
    try {
      let q = supabase.from('kanban_cards').select('*, permit:permits(*)');
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

      await supabase
        .from('kanban_cards')
        .update({
          column_status: newColumn,
          board: newBoard,
          moved_at: new Date().toISOString(),
        })
        .eq('id', cardId);
      fetchData();
    },
    [useMock, board, fetchData],
  );

  const addToPipeline = useCallback(
    async (permitId: string) => {
      const newCard: KanbanCard = {
        id: `card-${Date.now()}`,
        permit_id: permitId,
        board: 'pipeline',
        column_status: 'encontrado',
        notes: null,
        moved_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
      };

      if (useMock || !supabase) {
        const all = loadMockCards();
        // evita duplicata
        if (all.some((c) => c.permit_id === permitId)) return;
        const updated = [...all, newCard].map(hydratePermit);
        saveMockCards(updated);
        setCards(board ? updated.filter((c) => c.board === board) : updated);
        return;
      }

      await supabase.from('kanban_cards').insert({
        permit_id: permitId,
        board: 'pipeline',
        column_status: 'encontrado',
      });
      fetchData();
    },
    [useMock, board, fetchData],
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
      fetchData();
    },
    [useMock, board, fetchData],
  );

  return { cards, loading, moveCard, addToPipeline, updateNotes, refetch: fetchData };
}

// Export pro PermitsPage saber se permit ja esta no pipeline
export function getPermitIdsInPipeline(): Set<string> {
  const all = loadMockCards();
  return new Set(all.map((c) => c.permit_id));
}
