/**
 * Auth Service — Custom JWT authentication
 *
 * Admin: email/password login → JWT
 * Crew: company name + PIN → JWT
 */

import { api, setTokens, clearTokens, getAccessToken } from './apiClient';
import { UserSession } from '../types';

const SESSION_KEY = 'rr_session';

// ─── Session persistence ────────────────────────────────────────────────────

function saveSession(session: UserSession): void {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

function loadSession(): UserSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as UserSession;
  } catch {
    return null;
  }
}

function clearSession(): void {
  localStorage.removeItem(SESSION_KEY);
}

// ─── Auth API ───────────────────────────────────────────────────────────────

export async function signUpAdmin(
  email: string,
  password: string,
  companyName: string,
  username: string,
): Promise<UserSession> {
  const { data, error } = await api.post<{
    session: UserSession;
    accessToken: string;
    refreshToken: string;
  }>('/api/auth/signup', { email, password, companyName, username });

  if (error || !data) {
    throw new Error(error || 'Signup failed');
  }

  setTokens(data.accessToken, data.refreshToken);
  const session: UserSession = {
    ...data.session,
    spreadsheetId: data.session.organizationId, // backward compat
    token: data.accessToken,
  };
  saveSession(session);
  return session;
}

export async function signInAdmin(
  email: string,
  password: string,
): Promise<UserSession> {
  const { data, error } = await api.post<{
    session: UserSession;
    accessToken: string;
    refreshToken: string;
  }>('/api/auth/login', { email, password });

  if (error || !data) {
    throw new Error(error || 'Login failed');
  }

  setTokens(data.accessToken, data.refreshToken);
  const session: UserSession = {
    ...data.session,
    spreadsheetId: data.session.organizationId,
    token: data.accessToken,
  };
  saveSession(session);
  return session;
}

export async function signInCrew(
  companyName: string,
  pin: string,
  crewName: string,
): Promise<UserSession> {
  const { data, error } = await api.post<{
    session: UserSession;
    accessToken: string;
    refreshToken: string;
  }>('/api/auth/crew-login', { companyName, pin, crewName });

  if (error || !data) {
    throw new Error(error || 'Crew login failed');
  }

  setTokens(data.accessToken, data.refreshToken);
  const session: UserSession = {
    ...data.session,
    spreadsheetId: data.session.organizationId,
    token: data.accessToken,
  };
  saveSession(session);
  return session;
}

export async function signOut(): Promise<void> {
  clearTokens();
  clearSession();
}

export async function getCurrentSession(): Promise<UserSession | null> {
  // First check localStorage
  const cached = loadSession();
  if (!cached) return null;

  // Verify token is still valid
  const token = getAccessToken();
  if (!token) {
    clearSession();
    return null;
  }

  // Validate with server
  const { data, error } = await api.get<{ session: UserSession }>('/api/auth/me');

  if (error || !data) {
    // Token might be expired — the apiClient will try refresh automatically
    // If it still fails, clear session
    clearSession();
    clearTokens();
    return null;
  }

  const session: UserSession = {
    ...data.session,
    spreadsheetId: data.session.organizationId,
    token: token,
  };
  saveSession(session);
  return session;
}

export function onAuthStateChange(callback: (session: UserSession | null) => void): () => void {
  // Listen for storage changes (e.g., logout in another tab)
  const handler = (e: StorageEvent) => {
    if (e.key === SESSION_KEY) {
      const session = e.newValue ? JSON.parse(e.newValue) : null;
      callback(session);
    }
  };
  window.addEventListener('storage', handler);
  return () => window.removeEventListener('storage', handler);
}

export async function updatePassword(currentPassword: string, newPassword: string): Promise<boolean> {
  const { error } = await api.post('/api/auth/change-password', { currentPassword, newPassword });
  if (error) throw new Error(error);
  return true;
}
