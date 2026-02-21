import { supabase } from '../src/lib/supabase';
import { UserSession } from '../types';

/**
 * Sign up a new admin user with company
 */
export const signUpAdmin = async (
  email: string,
  password: string,
  fullName: string,
  companyName: string
): Promise<UserSession> => {
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
  if (!data.user) throw new Error('Signup failed. Please try again.');

  // Wait briefly for trigger to create profile + org
  await new Promise((r) => setTimeout(r, 1500));

  // Fetch the created profile to get company_id
  let { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*, organizations(*)')
    .eq('id', data.user.id)
    .single();

  // If the trigger didn't create the profile/org, create them manually.
  // This handles deployments where the handle_new_user trigger is missing.
  if (profileError || !profile) {
    console.warn('[Auth] Profile not found after signup — creating org + profile manually.');
    try {
      // Create organization
      const { data: newOrg, error: orgErr } = await supabase
        .from('organizations')
        .insert({ name: companyName, crew_pin: '' })
        .select()
        .single();
      if (orgErr) throw orgErr;

      // Create profile linked to user + org
      const { error: profErr } = await supabase
        .from('profiles')
        .insert({
          id: data.user.id,
          organization_id: newOrg.id,
          role: 'admin',
          full_name: fullName,
        });
      if (profErr) throw profErr;

      // Re-fetch complete profile
      const { data: retryProfile } = await supabase
        .from('profiles')
        .select('*, organizations(*)')
        .eq('id', data.user.id)
        .single();
      profile = retryProfile;
    } catch (manualErr) {
      console.error('[Auth] Manual profile/org creation failed:', manualErr);
      throw new Error('Account created but profile setup failed. Please login or contact support.');
    }
  }

  if (!profile) {
    throw new Error('Account created but profile setup failed. Please login.');
  }

  // Validate organization_id is present
  if (!profile.organization_id) {
    throw new Error('Account created but not linked to a company. Contact support.');
  }

  return {
    id: data.user.id,
    email: data.user.email || email,
    username: email,
    companyName: companyName,
    organizationId: profile.organization_id,
    spreadsheetId: profile.organization_id, // backward compat
    role: 'admin',
    token: data.session?.access_token,
  };
};

/**
 * Sign in an existing admin user
 */
export const signInAdmin = async (
  email: string,
  password: string
): Promise<UserSession> => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) throw new Error(error.message);
  if (!data.user) throw new Error('Login failed.');

  // Fetch profile with company
  let { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*, organizations(*)')
    .eq('id', data.user.id)
    .single();

  // Recovery: if profile exists but has no organization_id, try to find or create the org
  if (profile && !profile.organization_id) {
    console.warn('[Auth] Profile exists but missing organization_id — attempting recovery.');
    const meta = data.user.user_metadata;
    const companyName = meta?.company_name || email;
    try {
      // Try to find existing org by company name
      let orgId: string | null = null;
      const { data: existingOrg } = await supabase
        .from('organizations')
        .select('id')
        .ilike('name', companyName)
        .limit(1)
        .single();

      if (existingOrg) {
        orgId = existingOrg.id;
      } else {
        // Create a new organization
        const { data: newOrg, error: orgErr } = await supabase
          .from('organizations')
          .insert({ name: companyName, crew_pin: '' })
          .select()
          .single();
        if (!orgErr && newOrg) orgId = newOrg.id;
      }

      if (orgId) {
        await supabase
          .from('profiles')
          .update({ organization_id: orgId })
          .eq('id', data.user.id);
        // Re-fetch profile
        const { data: updated } = await supabase
          .from('profiles')
          .select('*, organizations(*)')
          .eq('id', data.user.id)
          .single();
        if (updated) profile = updated;
      }
    } catch (recoveryErr) {
      console.error('[Auth] Organization recovery failed:', recoveryErr);
    }
  }

  // Recovery: if no profile at all, try to create one
  if (profileError || !profile) {
    console.warn('[Auth] No profile found — attempting to create one.');
    const meta = data.user.user_metadata;
    const companyName = meta?.company_name || email;
    try {
      // Create org
      const { data: newOrg, error: orgErr } = await supabase
        .from('organizations')
        .insert({ name: companyName, crew_pin: '' })
        .select()
        .single();
      if (orgErr) throw orgErr;

      // Create profile
      const { error: profErr } = await supabase
        .from('profiles')
        .insert({
          id: data.user.id,
          organization_id: newOrg.id,
          role: 'admin',
          full_name: meta?.full_name || '',
        });
      if (profErr) throw profErr;

      const { data: created } = await supabase
        .from('profiles')
        .select('*, organizations(*)')
        .eq('id', data.user.id)
        .single();
      profile = created;
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

  const company = (profile as any).organizations;

  return {
    id: data.user.id,
    email: data.user.email || email,
    username: email,
    companyName: company?.name || '',
    organizationId: profile.organization_id,
    spreadsheetId: profile.organization_id,
    role: (profile.role as 'admin' | 'crew') || 'admin',
    token: data.session?.access_token,
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
  const { data, error } = await supabase.rpc('verify_crew_pin', {
    org_name: companyName,
    pin: pin,
  });

  if (error) throw new Error(error.message);

  const result = data as any;
  if (!result?.success) {
    throw new Error(result?.message || 'Invalid company name or PIN.');
  }

  return {
    id: result.organization_id,
    email: undefined,
    username: companyName,
    companyName: result.company_name,
    organizationId: result.organization_id,
    spreadsheetId: result.organization_id,
    role: 'crew',
  };
};

/**
 * Sign out current user
 */
export const signOut = async (): Promise<void> => {
  await supabase.auth.signOut();
};

/**
 * Get current authenticated session and build UserSession
 */
export const getCurrentSession = async (): Promise<UserSession | null> => {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.user) {
    // Check for crew session in localStorage
    const crewSession = localStorage.getItem('foamProCrewSession');
    if (crewSession) {
      try {
        const parsed = JSON.parse(crewSession) as UserSession;
        // Validate crew session has organizationId
        if (!parsed.organizationId) {
          console.warn('[Auth] Crew session missing organizationId — clearing.');
          localStorage.removeItem('foamProCrewSession');
          return null;
        }
        return parsed;
      } catch {
        return null;
      }
    }
    return null;
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('*, organizations(*)')
    .eq('id', session.user.id)
    .single();

  if (!profile) return null;

  // Warn if organizationId is missing (broken admin-crew link)
  if (!profile.organization_id) {
    console.error('[Auth] Profile exists but organization_id is null for user', session.user.id,
      '— the admin-crew link is broken. User should log out and back in to trigger auto-recovery.');
  }

  const company = (profile as any).organizations;

  return {
    id: session.user.id,
    email: session.user.email,
    username: session.user.email || '',
    companyName: company?.name || '',
    organizationId: profile.organization_id || '',
    spreadsheetId: profile.organization_id || '',
    role: (profile.role as 'admin' | 'crew') || 'crew',
    token: session.access_token,
  };
};

/**
 * Listen for auth state changes
 */
export const onAuthStateChange = (
  callback: (session: UserSession | null) => void
) => {
  return supabase.auth.onAuthStateChange(async (event, session) => {
    if (event === 'SIGNED_OUT' || !session?.user) {
      callback(null);
      return;
    }

    if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
      const { data: profile } = await supabase
        .from('profiles')
        .select('*, organizations(*)')
        .eq('id', session.user.id)
        .single();

      if (profile) {
        const company = (profile as any).organizations;
        callback({
          id: session.user.id,
          email: session.user.email,
          username: session.user.email || '',
          companyName: company?.name || '',
          organizationId: profile.organization_id || '',
          spreadsheetId: profile.organization_id || '',
          role: (profile.role as 'admin' | 'crew') || 'crew',
          token: session.access_token,
        });
      }
    }
  });
};
