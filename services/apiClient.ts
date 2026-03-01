/**
 * API Client — Generic fetch wrapper for the RR Foam Pro REST API
 *
 * Handles:
 * - JWT Bearer token injection
 * - Token refresh on 401
 * - JSON request/response handling
 * - Offline detection + error standardization
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// ─── Token Storage ──────────────────────────────────────────────────────────

const TOKEN_KEY = 'rr_access_token';
const REFRESH_KEY = 'rr_refresh_token';

export function getAccessToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_KEY);
}

export function setTokens(accessToken: string, refreshToken: string): void {
  localStorage.setItem(TOKEN_KEY, accessToken);
  localStorage.setItem(REFRESH_KEY, refreshToken);
}

export function clearTokens(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

// ─── Request Helper ─────────────────────────────────────────────────────────

interface ApiResponse<T = unknown> {
  data: T | null;
  error: string | null;
  status: number;
}

let isRefreshing = false;
let refreshPromise: Promise<boolean> | null = null;

async function tryRefreshToken(): Promise<boolean> {
  if (isRefreshing && refreshPromise) return refreshPromise;

  isRefreshing = true;
  refreshPromise = (async () => {
    try {
      const refreshToken = getRefreshToken();
      if (!refreshToken) return false;

      const res = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });

      if (!res.ok) return false;

      const data = await res.json();
      setTokens(data.accessToken, data.refreshToken);
      return true;
    } catch {
      return false;
    } finally {
      isRefreshing = false;
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

export async function apiRequest<T = unknown>(
  path: string,
  options: RequestInit = {},
): Promise<ApiResponse<T>> {
  const token = getAccessToken();

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  if (token) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
  }

  try {
    let res = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers,
    });

    // Auto-refresh on 401
    if (res.status === 401 && token) {
      const refreshed = await tryRefreshToken();
      if (refreshed) {
        const newToken = getAccessToken();
        (headers as Record<string, string>)['Authorization'] = `Bearer ${newToken}`;
        res = await fetch(`${API_BASE_URL}${path}`, {
          ...options,
          headers,
        });
      }
    }

    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: res.statusText }));
      return { data: null, error: body.error || `Request failed (${res.status})`, status: res.status };
    }

    const data = await res.json();
    return { data: data as T, error: null, status: res.status };
  } catch (err) {
    if (!navigator.onLine) {
      return { data: null, error: 'You are offline', status: 0 };
    }
    return { data: null, error: (err as Error).message || 'Network error', status: 0 };
  }
}

// ─── Convenience methods ────────────────────────────────────────────────────

export const api = {
  get: <T = unknown>(path: string) =>
    apiRequest<T>(path, { method: 'GET' }),

  post: <T = unknown>(path: string, body: unknown) =>
    apiRequest<T>(path, { method: 'POST', body: JSON.stringify(body) }),

  patch: <T = unknown>(path: string, body: unknown) =>
    apiRequest<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),

  delete: <T = unknown>(path: string) =>
    apiRequest<T>(path, { method: 'DELETE' }),
};

// ─── WebSocket ──────────────────────────────────────────────────────────────

export function getWsUrl(): string {
  const base = API_BASE_URL.replace(/^http/, 'ws');
  const token = getAccessToken();
  return `${base}/ws?token=${token}`;
}
