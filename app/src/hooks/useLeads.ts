import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { Lead, LeadInteraction, LeadStatus } from '../lib/types';

export function useLeads() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from('leads_full')
      .select('*')
      .order('updated_at', { ascending: false });
    setLeads((data as Lead[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Realtime updates
  useEffect(() => {
    if (!supabase) return;
    const sb = supabase;
    const ch = sb
      .channel('leads-shared')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, () => {
        fetchAll();
      })
      .subscribe();
    return () => {
      sb.removeChannel(ch);
    };
  }, [fetchAll]);

  const createLead = useCallback(async (payload: Partial<Lead>) => {
    if (!supabase) return null;
    const { data: userData } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from('leads')
      .insert({
        name: payload.name,
        company: payload.company || null,
        email: payload.email || null,
        phone: payload.phone || null,
        status: payload.status || 'novo',
        temperature: payload.temperature || 'morno',
        estimated_value: payload.estimated_value || null,
        owner_id: payload.owner_id || userData.user?.id || null,
        source: payload.source || null,
        notes: payload.notes || null,
        next_followup_date: payload.next_followup_date || null,
        permit_id: payload.permit_id || null,
        created_by: userData.user?.id || null,
      })
      .select()
      .single();
    if (error) throw error;
    // Refetch imediato pra não depender só do realtime
    await fetchAll();
    return data;
  }, [fetchAll]);

  const updateLead = useCallback(async (id: string, patch: Partial<Lead>) => {
    if (!supabase) return;
    // Filtra campos válidos
    const updates: Record<string, unknown> = {};
    const fields = [
      'name', 'last_name', 'company', 'email', 'phone',
      'address', 'city', 'state', 'zip_code',
      'status', 'temperature',
      'estimated_value', 'owner_id', 'owner_company', 'source', 'notes', 'next_followup_date',
    ] as const;
    for (const f of fields) {
      if (f in patch) updates[f] = (patch as Record<string, unknown>)[f];
    }
    // Optimistic local update
    setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } as Lead : l)));
    const { error } = await supabase.from('leads').update(updates).eq('id', id);
    if (error) throw error;
  }, []);

  const moveLead = useCallback(async (id: string, newStatus: LeadStatus) => {
    await updateLead(id, { status: newStatus });
    if (!supabase) return;
    const { data: userData } = await supabase.auth.getUser();
    await supabase.from('lead_interactions').insert({
      lead_id: id,
      type: 'status_change',
      content: `Status alterado para ${newStatus}`,
      created_by: userData.user?.id ?? null,
    });
  }, [updateLead]);

  const deleteLead = useCallback(async (id: string) => {
    if (!supabase) return;
    setLeads((prev) => prev.filter((l) => l.id !== id));
    await supabase.from('leads').delete().eq('id', id);
  }, []);

  return { leads, loading, refetch: fetchAll, createLead, updateLead, moveLead, deleteLead };
}

export function useLeadInteractions(leadId: string | null) {
  const [interactions, setInteractions] = useState<LeadInteraction[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchAll = useCallback(async () => {
    if (!supabase || !leadId) {
      setInteractions([]);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from('lead_interactions')
      .select('*')
      .eq('lead_id', leadId)
      .order('created_at', { ascending: false });
    setInteractions((data as LeadInteraction[]) ?? []);
    setLoading(false);
  }, [leadId]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const addInteraction = useCallback(
    async (type: LeadInteraction['type'], content: string) => {
      if (!supabase || !leadId || !content.trim()) return;
      const { data: userData } = await supabase.auth.getUser();
      await supabase.from('lead_interactions').insert({
        lead_id: leadId,
        type,
        content: content.trim(),
        created_by: userData.user?.id ?? null,
      });
      fetchAll();
    },
    [leadId, fetchAll]
  );

  return { interactions, loading, addInteraction, refetch: fetchAll };
}
