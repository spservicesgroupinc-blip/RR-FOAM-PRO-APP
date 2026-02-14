import { supabase } from '../lib/supabase';
import { UserSession } from '../../types';

// Constants for the simplified Crew Login (PIN as Password strategy)
const CREW_EMAIL_DOMAIN = 'crew.foampro.app';

export const authService = {
    /**
     * Logs in an Admin user using Email and Password.
     */
    loginAdmin: async (email: string, password: string): Promise<UserSession | null> => {
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (error) {
            console.error('Admin Login Error:', error);
            throw new Error(error.message);
        }

        if (data.user) {
            // Fetch Profile to get role and company_id
            const { data: profile, error: profileError } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', data.user.id)
                .single();

            if (profileError) {
                console.error('Profile Fetch Error:', profileError);
                // Fallback or throw? For now throw ensures we don't have invalid sessions
                throw new Error('Failed to fetch user profile');
            }

            return {
                user: data.user.email || '',
                role: profile?.role || 'admin',
                spreadsheetId: profile?.organization_id || '', // Mapping organization_id to legacy field
                token: data.session?.access_token
            } as any;
        }
        return null;
    },

    /**
     * Logs in a Crew user using a PIN.
     * Strategy: The PIN is treated as the password for a pre-defined 'crew' account.
     * The email is constructed as 'crew@<company_suffix>.crew.foampro.app'.
     * For this single-tenant migration, we default to a specific crew email.
     */
    loginCrew: async (pin: string): Promise<UserSession | null> => {
        // TODO: In a multi-tenant capability, we'd need the Company ID first.
        // For this migration, we assume a single "Default" crew account or 
        // we query a lookup table. 
        // Better Approach for MVP: Simply try to login as 'crew@foampro.app' with the PIN.
        const email = `crew@${CREW_EMAIL_DOMAIN}`;

        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password: pin, // PIN is the password
        });

        if (error) {
            console.error('Crew Login Error:', error.message);
            throw new Error('Invalid PIN');
        }

        if (data.user) {
            // Fetch Profile for Crew
            const { data: profile } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', data.user.id)
                .single();

            return {
                user: 'Crew',
                role: 'crew',
                spreadsheetId: profile?.organization_id || '',
                token: data.session?.access_token
            } as any;
        }
        return null;
    },

    /**
     * Signs out the current user.
     */
    logout: async () => {
        const { error } = await supabase.auth.signOut();
        if (error) console.error('SignOut Error:', error);
    },

    /**
     * Gets current session from Supabase
     */
    getSession: async () => {
        const { data } = await supabase.auth.getSession();
        return data.session;
    }
};
