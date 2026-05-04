import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const SUPABASE_CONFIGURED = Boolean(url && anon);

export const supabase: SupabaseClient | null = SUPABASE_CONFIGURED
  ? createClient(url as string, anon as string, {
      auth: { persistSession: false },
    })
  : null;

if (!SUPABASE_CONFIGURED && import.meta.env.DEV) {
  console.info(
    '[permit-scanner] Supabase NOT configured — running in MOCK mode. ' +
      'Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local to connect.'
  );
}
