import { createClient } from '@supabase/supabase-js';
import { Database } from '../types/supabase';

const supabaseUrl = 'https://bkcxawdyjfxlnexkuwde.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJrY3hhd2R5amZ4bG5leGt1d2RlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5MzQ4OTcsImV4cCI6MjA4NjUxMDg5N30.D5ervl7NLghCbEnELbQlIGTB_7tdLR_P0AyT0SDNdZI';

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    // iOS Safari/WebKit aggressively evicts localStorage in standalone PWA mode.
    // Explicitly set storage to localStorage and persist session to survive
    // app backgrounding / OS memory pressure on iPhone.
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    // Faster token refresh cycle helps iOS connections that drop silently
    flowType: 'implicit',
  },
  global: {
    headers: {
      // Prevent iOS WebKit from caching API responses.
      // Without these, iOS can serve stale data from its HTTP cache
      // even though the service worker was fixed to bypass API calls.
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
    },
  },
  realtime: {
    params: {
      // Shorter heartbeat keeps iOS WebSocket alive during brief backgrounding
      eventsPerSecond: 2,
    },
  },
});
