/**
 * Safe localStorage wrapper with in-memory fallback.
 * 
 * iOS Safari in standalone PWA mode aggressively evicts localStorage:
 *  - After ~7 days of inactivity
 *  - Under memory pressure (backgrounded app)
 *  - In private browsing mode (quota = 0)
 * 
 * This module wraps every localStorage call in try/catch and mirrors
 * writes to an in-memory Map so reads never fail even if iOS has
 * cleared the store. Data survives within a single app session;
 * for cross-session persistence, the app relies on Supabase as the
 * source of truth.
 */

const memoryStore = new Map<string, string>();

export const safeStorage = {
  getItem(key: string): string | null {
    try {
      const val = localStorage.getItem(key);
      if (val !== null) {
        // Keep memory mirror up to date with whatever is in localStorage
        memoryStore.set(key, val);
        return val;
      }
    } catch {
      // localStorage threw — fall through to memory
    }
    return memoryStore.get(key) ?? null;
  },

  setItem(key: string, value: string): void {
    // Always write to memory first (guaranteed to work)
    memoryStore.set(key, value);
    try {
      localStorage.setItem(key, value);
    } catch {
      // Quota exceeded or storage unavailable — memory copy is the fallback
    }
  },

  removeItem(key: string): void {
    memoryStore.delete(key);
    try {
      localStorage.removeItem(key);
    } catch {
      // Storage unavailable — memory already cleared
    }
  },
};

export default safeStorage;
