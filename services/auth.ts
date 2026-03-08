/**
 * Auth Service — Supabase authentication
 *
 * Admin: email/password sign-up and sign-in via Supabase Auth.
 * Crew:  company name + PIN verified through the verify_crew_pin RPC
 *        (crew members do not hold Supabase auth accounts).
 */

import { supabase } from '../src/lib/supabase';
import { UserSession } from '../types';
import safeStorage from '../utils/safeStorage';

const CREW_SESSION_KEY = 'foamProCrewSession';

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Fetch the app-level profile for an authenticated Supabase user.
 * Expects a `profiles` table with columns:
 *   id, organization_id, role, full_name
 * and an `organizations` table with columns:
 *   id, name
 */
async function fetchAdminProfile(userId: string): Promise<{
  organizationId: string;
  companyName: string;
  fullName: string;
} | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('organization_id, full_name, organizations(name)')
    .eq('id', userId)
    .single();

  if (error || !data) return null;

  const org = Array.isArray((data as any).organizations)
    ? (data as any).organizations[0]
    : (data as any).organizations;

  return {
    organizationId: (data as any).organization_id,
    companyName: org?.name ?? '',
    fullName: (data as any).full_name ?? '',
  };
}

// ─── Admin Auth ──────────────────────────────────────────────────────────────

/**
 * Create a new admin account.
 * Supabase Auth creates the user; the `handle_new_user` database trigger
 * then creates the matching profile and organization rows automatically
 * using the metadata passed here.
 */
export async function signUpAdmin(
  email: string,
  password: string,
  fullName: string,
  companyName: string,
): Promise<UserSession> {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
        company_name: companyName,
        role: 'admin',
      },
    },
  });

  if (error) throw new Error(error.message);
  if (!data.user) throw new Error('Signup failed. Please try again or contact support.');

  // Fetch profile — may not be populated immediately if email confirmation is required.
  const profile = await fetchAdminProfile(data.user.id);

  const session: UserSession = {
    id: data.user.id,
    email: data.user.email ?? email,
    username: fullName || email,
    companyName: profile?.companyName ?? companyName,
    organizationId: profile?.organizationId ?? '',
    spreadsheetId: profile?.organizationId ?? '',
    role: 'admin',
    token: data.session?.access_token,
  };

  return session;
}

/**
 * Sign an existing admin in with email + password.
 */
export async function signInAdmin(
  email: string,
  password: string,
): Promise<UserSession> {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) throw new Error(error.message);
  if (!data.user || !data.session) throw new Error('Login failed. Please try again.');

  const profile = await fetchAdminProfile(data.user.id);
  if (!profile) throw new Error('Account profile not found. Please contact support.');

  const session: UserSession = {
    id: data.user.id,
    email: data.user.email ?? email,
    username: profile.fullName || email,
    companyName: profile.companyName,
    organizationId: profile.organizationId,
    spreadsheetId: profile.organizationId,
    role: 'admin',
    token: data.session.access_token,
  };

  return session;
}

// ─── Crew Auth ───────────────────────────────────────────────────────────────

/**
 * Verify a crew PIN via the `verify_crew_pin` Supabase RPC.
 * Crew members do not sign into Supabase Auth — the PIN check is performed
 * by a SECURITY DEFINER function so that no authentication is required.
 */
export async function signInCrew(
  companyName: string,
  pin: string,
): Promise<UserSession> {
  const { data, error } = await supabase.rpc('verify_crew_pin', {
    org_name: companyName.trim(),
    pin_input: pin.trim(),
  });

  if (error) throw new Error(error.message);
  if (!data) throw new Error('Invalid company name or PIN. Please try again.');

  // The RPC returns a row with the org info on success.
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || !row.organization_id) {
    throw new Error('Invalid company name or PIN. Please try again.');
  }

  const session: UserSession = {
    id: row.organization_id,
    username: companyName,
    companyName: row.company_name ?? companyName,
    organizationId: row.organization_id,
    spreadsheetId: row.organization_id,
    role: 'crew',
  };

  // Persist for iOS resilience (two keys for fallback)
  try {
    safeStorage.setItem(CREW_SESSION_KEY, JSON.stringify(session));
    safeStorage.setItem('foamProSession', JSON.stringify(session));
  } catch { /* storage unavailable — session lives in memory */ }

  return session;
}

// ─── Session Management ──────────────────────────────────────────────────────

/**
 * Return the current session if one exists (admin or crew).
 * Checks Supabase Auth first, then falls back to a stored crew session.
 */
export async function getCurrentSession(): Promise<UserSession | null> {
  // Admin: check Supabase Auth session
  try {
    const { data, error } = await supabase.auth.getSession();
    if (!error && data.session?.user) {
      const user = data.session.user;
      const profile = await fetchAdminProfile(user.id);
      if (profile) {
        return {
          id: user.id,
          email: user.email ?? '',
          username: profile.fullName || (user.email ?? ''),
          companyName: profile.companyName,
          organizationId: profile.organizationId,
          spreadsheetId: profile.organizationId,
          role: 'admin',
          token: data.session.access_token,
        };
      }
    }
  } catch {
    // Supabase unavailable — fall through to crew session check
  }

  // Crew: check stored crew session
  try {
    const raw =
      safeStorage.getItem(CREW_SESSION_KEY) ||
      safeStorage.getItem('foamProSession');
    if (raw) {
      const parsed = JSON.parse(raw) as UserSession;
      if (parsed.role === 'crew' && parsed.organizationId) {
        return parsed;
      }
    }
  } catch {
    // Corrupt storage — ignore
  }

  return null;
}

/**
 * Sign out the current user (admin or crew).
 */
export async function signOut(): Promise<void> {
  // Sign out of Supabase Auth (no-op if no admin session)
  await supabase.auth.signOut().catch(() => {});

  // Clear crew session keys
  safeStorage.removeItem(CREW_SESSION_KEY);
  safeStorage.removeItem('foamProSession');
}

/**
 * Subscribe to auth state changes (admin Supabase sessions only).
 * Returns an unsubscribe function.
 */
export function onAuthStateChange(
  callback: (session: UserSession | null) => void,
): () => void {
  const { data: { subscription } } = supabase.auth.onAuthStateChange(
    async (_event, supabaseSession) => {
      if (!supabaseSession?.user) {
        callback(null);
        return;
      }
      const profile = await fetchAdminProfile(supabaseSession.user.id);
      if (!profile) {
        callback(null);
        return;
      }
      callback({
        id: supabaseSession.user.id,
        email: supabaseSession.user.email ?? '',
        username: profile.fullName || (supabaseSession.user.email ?? ''),
        companyName: profile.companyName,
        organizationId: profile.organizationId,
        spreadsheetId: profile.organizationId,
        role: 'admin',
        token: supabaseSession.access_token,
      });
    },
  );

  return () => subscription.unsubscribe();
}

/**
 * Update the current admin user's password.
 * Note: Supabase Auth does not require the current password for this operation
 * when a valid session exists; verification is handled server-side.
 */
export async function updatePassword(newPassword: string): Promise<boolean> {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw new Error(error.message);
  return true;
}
