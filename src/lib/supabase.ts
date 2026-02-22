import { createClient } from '@supabase/supabase-js';
import { Database } from '../types/supabase';

const supabaseUrl = 'https://bkcxawdyjfxlnexkuwde.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJrY3hhd2R5amZ4bG5leGt1d2RlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5MzQ4OTcsImV4cCI6MjA4NjUxMDg5N30.D5ervl7NLghCbEnELbQlIGTB_7tdLR_P0AyT0SDNdZI';

// In-memory fallback when localStorage is unavailable
// (e.g. mobile Safari private browsing, quota exceeded, iOS memory pressure)
const memoryStorage: Record<string, string> = {};
const safeStorage = {
  getItem: (key: string): string | null => {
    try { return localStorage.getItem(key); } catch { return memoryStorage[key] ?? null; }
  },
  setItem: (key: string, value: string): void => {
    try { localStorage.setItem(key, value); } catch { memoryStorage[key] = value; }
  },
  removeItem: (key: string): void => {
    try { localStorage.removeItem(key); } catch { delete memoryStorage[key]; }
  },
};

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    // Use safeStorage for iOS Safari/WebKit resilience —
    // iOS aggressively evicts localStorage in standalone PWA mode.
    storage: safeStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    // PKCE is recommended for PWA/mobile — more reliable token refresh on iOS
    // than implicit flow, which relies on URL hash fragments that iOS handles poorly
    flowType: 'pkce',
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
