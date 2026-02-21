import { createClient } from '@supabase/supabase-js';
import { Database } from '../types/supabase';

const supabaseUrl = 'https://bkcxawdyjfxlnexkuwde.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJrY3hhd2R5amZ4bG5leGt1d2RlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5MzQ4OTcsImV4cCI6MjA4NjUxMDg5N30.D5ervl7NLghCbEnELbQlIGTB_7tdLR_P0AyT0SDNdZI';

// In-memory fallback when localStorage is unavailable
// (e.g. mobile Safari private browsing, quota exceeded)
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
    storage: safeStorage,
    persistSession: true,
    detectSessionInUrl: true,
  },
});
