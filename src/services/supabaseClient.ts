import { createClient } from '@supabase/supabase-js';

const rawUrl = (import.meta.env.VITE_SUPABASE_URL || '').trim().replace(/^["']|["']$/g, '').replace(/\/+$/, '');
const rawAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim().replace(/^["']|["']$/g, '');

const isValidUrl = (url: string): boolean => {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
};

const supabaseUrl = isValidUrl(rawUrl) ? rawUrl : 'https://placeholder.supabase.co';
const supabaseAnonKey = rawAnonKey || 'placeholder';

// Instantiate the Supabase client safely
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
let historyClientSequence = 0;

export async function getHistoryClient(owner: string) {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error || !session || session.user.id !== owner) throw new Error('History sync paused because the account changed.');
  // Freeze the request identity. The shared client's token can change during logout/login.
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${session.access_token}` } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: `jobtic-history-request-${++historyClientSequence}` }
  });
}

// Helper check to verify if the keys are correctly populated
export const isSupabaseConfigured = (): boolean => {
  return (
    isValidUrl(rawUrl) &&
    rawUrl !== 'https://placeholder.supabase.co' &&
    !!rawAnonKey &&
    rawAnonKey !== 'YOUR_SUPABASE_ANON_KEY_HERE' &&
    rawAnonKey !== 'placeholder'
  );
};
