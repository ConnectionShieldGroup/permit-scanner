import { useCallback, useEffect, useState } from 'react';
import { supabase, SUPABASE_CONFIGURED } from '../lib/supabase';
import { MOCK_PERMITS } from '../lib/mock-permits';
import type { Permit, PermitFilters } from '../lib/types';

function applyFilters(permits: Permit[], f?: PermitFilters): Permit[] {
  if (!f) return permits;
  return permits.filter((p) => {
    if (f.city && p.city !== f.city) return false;
    if (f.work_type && p.work_type !== f.work_type) return false;
    if (f.month_start && new Date(p.permit_date) < new Date(f.month_start)) return false;
    if (f.month_end && new Date(p.permit_date) > new Date(f.month_end)) return false;
    return true;
  });
}

export function usePermits(filters?: PermitFilters) {
  const [permits, setPermits] = useState<Permit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const useMock =
    !SUPABASE_CONFIGURED ||
    (typeof window !== 'undefined' &&
      new URLSearchParams(window.location.search).has('mock'));

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    if (useMock || !supabase) {
      // Simulate network delay para skeleton ficar visivel
      await new Promise((r) => setTimeout(r, 300));
      setPermits(applyFilters(MOCK_PERMITS, filters));
      setLoading(false);
      return;
    }

    try {
      let q = supabase
        .from('permits')
        .select('*')
        .order('permit_date', { ascending: false })
        .limit(5000); // Supabase default é 1000 — bump pra cobrir total atual + margem

      if (filters?.city) q = q.eq('city', filters.city);
      if (filters?.work_type) q = q.eq('work_type', filters.work_type);
      if (filters?.month_start) q = q.gte('permit_date', filters.month_start);
      if (filters?.month_end) q = q.lte('permit_date', filters.month_end);

      const { data, error: err } = await q;
      if (err) throw err;
      setPermits((data as Permit[]) ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load permits');
      setPermits([]);
    } finally {
      setLoading(false);
    }
  }, [
    filters?.city,
    filters?.work_type,
    filters?.month_start,
    filters?.month_end,
    useMock,
  ]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { permits, loading, error, refetch: fetchData, isMock: useMock };
}
