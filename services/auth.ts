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
  await new Promise((r) => setTimeout(r, 500));

  // Fetch the created profile to get organization_id
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*, organizations(*)')
    .eq('id', data.user.id)
    .single();

  if (profileError || !profile) {
    throw new Error('Account created but profile setup failed. Please login.');
  }

  return {
    id: data.user.id,
    email: data.user.email || email,
    username: email,
    companyName: companyName,
    organizationId: profile.organization_id || '',
    spreadsheetId: profile.organization_id || '', // backward compat
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

  // Fetch profile with org
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*, organizations(*)')
    .eq('id', data.user.id)
    .single();

  if (profileError || !profile) {
    throw new Error('Profile not found. Contact support.');
  }

  const org = profile.organizations as any;

  return {
    id: data.user.id,
    email: data.user.email || email,
    username: email,
    companyName: org?.name || '',
    organizationId: profile.organization_id || '',
    spreadsheetId: profile.organization_id || '',
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
        return JSON.parse(crewSession) as UserSession;
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

  const org = profile.organizations as any;

  return {
    id: session.user.id,
    email: session.user.email,
    username: session.user.email || '',
    companyName: org?.name || '',
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
        const org = profile.organizations as any;
        callback({
          id: session.user.id,
          email: session.user.email,
          username: session.user.email || '',
          companyName: org?.name || '',
          organizationId: profile.organization_id || '',
          spreadsheetId: profile.organization_id || '',
          role: (profile.role as 'admin' | 'crew') || 'crew',
          token: session.access_token,
        });
      }
    }
  });
};
