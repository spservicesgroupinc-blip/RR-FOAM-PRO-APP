/**
 * Auth Service - InsForge
 *
 * Handles admin signup/login (email+password), crew login (PIN-based RPC),
 * session management, and auth state listeners.
 *
 * Migrated from Supabase to InsForge SDK.
 */

import { insforge } from '../src/lib/insforge';
import { UserSession } from './types';
import safeStorage from '../utils/safeStorage';

/**
 * Sign up a new admin user with company
 */
export const signUpAdmin = async (
  email: string,
  password: string,
  fullName: string,
  companyName: string
): Promise<UserSession> => {
  const { data, error } = await insforge.auth.signUp({
    email,
    password,
    name: fullName,
  });

  if (error) throw new Error(error.message);
  if (!data?.user) throw new Error('Signup failed. Please try again.');

  // If email verification is required, throw informative error
  if (data.requireEmailVerification) {
    // Store pending signup info for after verification
    safeStorage.setItem('foamProPendingSignup', JSON.stringify({
      userId: data.user.id,
      email,
      fullName,
      companyName,
      role: 'admin',
    }));
    throw new Error('VERIFY_EMAIL');
  }

  // Create organization and profile in our database
  const session = await createOrgAndProfile(data.user.id, email, fullName, companyName, data.accessToken || undefined);
  return session;
};

/**
 * After email verification, complete the signup by creating org + profile
 */
export const completeSignupAfterVerification = async (
  accessToken: string,
  userId: string
): Promise<UserSession | null> => {
  const pendingRaw = safeStorage.getItem('foamProPendingSignup');
  if (!pendingRaw) return null;

  try {
    const pending = JSON.parse(pendingRaw);
    const session = await createOrgAndProfile(
      userId,
      pending.email,
      pending.fullName,
      pending.companyName,
      accessToken
    );
    safeStorage.removeItem('foamProPendingSignup');
    return session;
  } catch (err) {
    console.error('[Auth] completeSignupAfterVerification failed:', err);
    return null;
  }
};

/**
 * Helper: Create organization + profile in InsForge DB
 */
async function createOrgAndProfile(
  userId: string,
  email: string,
  fullName: string,
  companyName: string,
  token?: string
): Promise<UserSession> {
  // Create organization
  const { data: newOrg, error: orgErr } = await insforge.database
    .from('organizations')
    .insert({ name: companyName, crew_pin: '' })
    .select();

  if (orgErr || !newOrg || newOrg.length === 0) {
    throw new Error('Failed to create company. Please try again.');
  }

  const org = newOrg[0];

  // Create profile linked to user + org
  const { error: profErr } = await insforge.database
    .from('profiles')
    .insert({
      id: userId,
      organization_id: org.id,
      role: 'admin',
      full_name: fullName,
    });

  if (profErr) {
    console.error('[Auth] Profile creation failed:', profErr);
    throw new Error('Account created but profile setup failed. Please login or contact support.');
  }

  // Create warehouse_stock row
  await insforge.database
    .from('warehouse_stock')
    .insert({ organization_id: org.id, open_cell_sets: 0, closed_cell_sets: 0 });

  return {
    id: userId,
    email,
    username: email,
    companyName,
    organizationId: org.id,
    spreadsheetId: org.id,
    role: 'admin',
    token,
  };
}

/**
 * Sign in an existing admin user
 */
export const signInAdmin = async (
  email: string,
  password: string
): Promise<UserSession> => {
  const { data, error } = await insforge.auth.signInWithPassword({
    email,
    password,
  });

  if (error) throw new Error(error.message);
  if (!data?.user) throw new Error('Login failed.');

  const userId = data.user.id;
  const accessToken = data.accessToken;

  // Fetch profile with organization
  let { data: profiles, error: profileError } = await insforge.database
    .from('profiles')
    .select('*')
    .eq('id', userId);

  let profile = profiles && profiles.length > 0 ? profiles[0] : null;

  // Recovery: if profile exists but has no organization_id
  if (profile && !profile.organization_id) {
    console.warn('[Auth] Profile exists but missing organization_id — attempting recovery.');
    const companyName = data.user.profile?.name || email;
    try {
      let orgId: string | null = null;

      // Try to find existing org by name
      const { data: existingOrgs } = await insforge.database
        .from('organizations')
        .select('id')
        .eq('name', companyName)
        .limit(1);

      if (existingOrgs && existingOrgs.length > 0) {
        orgId = existingOrgs[0].id;
      } else {
        const { data: newOrgs } = await insforge.database
          .from('organizations')
          .insert({ name: companyName, crew_pin: '' })
          .select();
        if (newOrgs && newOrgs.length > 0) orgId = newOrgs[0].id;
      }

      if (orgId) {
        await insforge.database
          .from('profiles')
          .update({ organization_id: orgId })
          .eq('id', userId);

        const { data: updated } = await insforge.database
          .from('profiles')
          .select('*')
          .eq('id', userId);
        if (updated && updated.length > 0) profile = updated[0];
      }
    } catch (recoveryErr) {
      console.error('[Auth] Organization recovery failed:', recoveryErr);
    }
  }

  // Recovery: no profile at all — create one
  if (profileError || !profile) {
    console.warn('[Auth] No profile found — attempting to create one.');
    const companyName = data.user.profile?.name || email;
    try {
      const { data: newOrgs } = await insforge.database
        .from('organizations')
        .insert({ name: companyName, crew_pin: '' })
        .select();

      if (!newOrgs || newOrgs.length === 0) throw new Error('Org creation failed');

      await insforge.database
        .from('profiles')
        .insert({
          id: userId,
          organization_id: newOrgs[0].id,
          role: 'admin',
          full_name: data.user.profile?.name || '',
        });

      // Create warehouse_stock row
      await insforge.database
        .from('warehouse_stock')
        .insert({ organization_id: newOrgs[0].id, open_cell_sets: 0, closed_cell_sets: 0 });

      const { data: created } = await insforge.database
        .from('profiles')
        .select('*')
        .eq('id', userId);
      if (created && created.length > 0) profile = created[0];
    } catch (createErr) {
      console.error('[Auth] Profile creation during login failed:', createErr);
      throw new Error('Profile not found and auto-creation failed. Contact support.');
    }
  }

  if (!profile) {
    throw new Error('Profile not found. Contact support.');
  }

  if (!profile.organization_id) {
    throw new Error('Your account is not linked to a company. Contact support.');
  }

  // Fetch org name
  let companyName = '';
  const { data: orgData } = await insforge.database
    .from('organizations')
    .select('name')
    .eq('id', profile.organization_id)
    .single();
  if (orgData) companyName = orgData.name;

  return {
    id: userId,
    email: data.user.email || email,
    username: email,
    companyName,
    organizationId: profile.organization_id,
    spreadsheetId: profile.organization_id,
    role: (profile.role as 'admin' | 'crew') || 'admin',
    token: accessToken,
  };
};

/**
 * Crew login via company name + PIN
 * Uses an RPC function to verify without requiring auth credentials
 */
export const signInCrew = async (
  companyName: string,
  pin: string
): Promise<UserSession> => {
  const { data, error } = await insforge.database.rpc('verify_crew_pin', {
    org_name: companyName,
    pin: pin,
  });

  if (error) throw new Error(error.message);

  const result = data as any;
  if (!result?.success) {
    throw new Error(result?.message || 'Invalid company name or PIN.');
  }

  const session: UserSession = {
    id: result.organization_id,
    email: undefined,
    username: companyName,
    companyName: result.company_name,
    organizationId: result.organization_id,
    spreadsheetId: result.organization_id,
    role: 'crew',
  };

  // Persist crew session
  safeStorage.setItem('foamProCrewSession', JSON.stringify(session));

  return session;
};

/**
 * Sign out current user
 */
export const signOut = async (): Promise<void> => {
  try {
    await insforge.auth.signOut();
  } catch {
    // Ignore sign out errors (crew sessions don't have auth)
  }
  safeStorage.removeItem('foamProCrewSession');
};

/**
 * Get current authenticated session and build UserSession
 */
export const getCurrentSession = async (): Promise<UserSession | null> => {
  const { data, error } = await insforge.auth.getCurrentSession();

  if (!data?.session?.user) {
    // Check for crew session
    try {
      const crewSession = safeStorage.getItem('foamProCrewSession');
      if (crewSession) {
        try {
          const parsed = JSON.parse(crewSession) as UserSession;
          if (!parsed.organizationId) {
            console.warn('[Auth] Crew session missing organizationId — clearing.');
            safeStorage.removeItem('foamProCrewSession');
            return null;
          }
          return parsed;
        } catch {
          return null;
        }
      }
    } catch {
      // localStorage unavailable
    }
    return null;
  }

  const user = data.session.user;

  const { data: profiles } = await insforge.database
    .from('profiles')
    .select('*')
    .eq('id', user.id);

  const profile = profiles && profiles.length > 0 ? profiles[0] : null;

  if (!profile) return null;

  if (!profile.organization_id) {
    console.error('[Auth] Profile exists but organization_id is null for user', user.id);
  }

  let companyName = '';
  if (profile.organization_id) {
    const { data: orgData } = await insforge.database
      .from('organizations')
      .select('name')
      .eq('id', profile.organization_id)
      .single();
    if (orgData) companyName = orgData.name;
  }

  return {
    id: user.id,
    email: user.email,
    username: user.email || '',
    companyName,
    organizationId: profile.organization_id || '',
    spreadsheetId: profile.organization_id || '',
    role: (profile.role as 'admin' | 'crew') || 'crew',
    token: data.session.accessToken,
  };
};

/**
 * Listen for auth state changes
 * Note: InsForge doesn't have an equivalent of onAuthStateChange.
 * We use a polling approach or manual check after login/logout.
 * Components should call getCurrentSession() when needed.
 */
export const onAuthStateChange = (
  callback: (session: UserSession | null) => void
) => {
  // No-op for now — InsForge SDK doesn't provide real-time auth listeners.
  // The app should call getCurrentSession() on mount and after login/logout.
  return {
    data: {
      subscription: {
        unsubscribe: () => {},
      },
    },
  };
};
