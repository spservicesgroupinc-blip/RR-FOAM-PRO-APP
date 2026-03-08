/**
 * Supabase client — singleton instance shared across the app.
 *
 * Uses the safeStorage adapter so that iOS Safari private-browsing mode
 * (which throws on every localStorage write) never breaks session persistence.
 * Supabase auth tokens are mirrored to an in-memory fallback automatically.
 */

import { createClient } from '@supabase/supabase-js';
import safeStorage from '../../utils/safeStorage';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    '[Supabase] VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY is not set. ' +
    'Authentication will not work until these environment variables are configured.'
  );
}

export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '', {
  auth: {
    storage: safeStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});
