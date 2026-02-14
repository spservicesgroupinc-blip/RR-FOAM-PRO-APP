/**
 * Subscription Service
 * 
 * Manages SaaS subscription status, plan limits, and usage tracking.
 * Integrates with the get_subscription_status RPC for server-side validated data.
 */

import { supabase } from '../src/lib/supabase';
import { SubscriptionInfo, SubscriptionPlan, PLAN_LIMITS } from '../types';

// ─── FETCH SUBSCRIPTION STATUS ──────────────────────────────────────────────

/**
 * Get the current subscription status for an organization.
 * Uses a SECURITY DEFINER RPC that validates caller ownership.
 */
export const fetchSubscriptionStatus = async (orgId: string): Promise<SubscriptionInfo | null> => {
  try {
    const { data, error } = await supabase.rpc('get_subscription_status', { p_org_id: orgId });

    if (error) {
      console.error('fetchSubscriptionStatus error:', error);
      return null;
    }

    const result = data as any;
    if (!result || result.status === 'no_subscription') {
      return getDefaultTrialInfo();
    }

    return {
      plan: result.plan as SubscriptionPlan,
      status: result.status,
      trialEndsAt: result.trial_ends_at || undefined,
      isTrialExpired: result.is_trial_expired || false,
      currentPeriodEnd: result.current_period_end || undefined,
      usage: {
        estimatesThisMonth: result.usage?.estimates_this_month || 0,
        maxEstimates: result.usage?.max_estimates || 10,
        customers: result.usage?.customers || 0,
        maxCustomers: result.usage?.max_customers || 25,
        users: result.usage?.users || 0,
        maxUsers: result.usage?.max_users || 2,
      },
    };
  } catch (err) {
    console.error('fetchSubscriptionStatus exception:', err);
    return null;
  }
};

// ─── HELPERS ────────────────────────────────────────────────────────────────

const getDefaultTrialInfo = (): SubscriptionInfo => ({
  plan: 'trial',
  status: 'active',
  isTrialExpired: false,
  usage: {
    estimatesThisMonth: 0,
    maxEstimates: PLAN_LIMITS.trial.estimates,
    customers: 0,
    maxCustomers: PLAN_LIMITS.trial.customers,
    users: 0,
    maxUsers: PLAN_LIMITS.trial.users,
  },
});

/**
 * Check if a specific action is allowed under current plan limits.
 * Returns { allowed: boolean, message?: string }
 */
export const checkPlanLimit = (
  sub: SubscriptionInfo,
  action: 'create_estimate' | 'create_customer' | 'add_user'
): { allowed: boolean; message?: string } => {
  if (sub.isTrialExpired) {
    return {
      allowed: false,
      message: 'Your trial has expired. Please upgrade to continue using RR Foam Pro.',
    };
  }

  if (sub.status === 'cancelled' || sub.status === 'suspended') {
    return {
      allowed: false,
      message: `Your subscription is ${sub.status}. Please contact support.`,
    };
  }

  switch (action) {
    case 'create_estimate':
      if (sub.usage.estimatesThisMonth >= sub.usage.maxEstimates) {
        return {
          allowed: false,
          message: `Monthly estimate limit reached (${sub.usage.estimatesThisMonth}/${sub.usage.maxEstimates}). Upgrade for more.`,
        };
      }
      break;
    case 'create_customer':
      if (sub.usage.customers >= sub.usage.maxCustomers) {
        return {
          allowed: false,
          message: `Customer limit reached (${sub.usage.customers}/${sub.usage.maxCustomers}). Upgrade for more.`,
        };
      }
      break;
    case 'add_user':
      if (sub.usage.users >= sub.usage.maxUsers) {
        return {
          allowed: false,
          message: `User limit reached (${sub.usage.users}/${sub.usage.maxUsers}). Upgrade for more.`,
        };
      }
      break;
  }

  return { allowed: true };
};

/**
 * Get the number of days remaining in the trial.
 */
export const getTrialDaysRemaining = (sub: SubscriptionInfo): number | null => {
  if (sub.plan !== 'trial' || !sub.trialEndsAt) return null;
  const now = new Date();
  const end = new Date(sub.trialEndsAt);
  const diff = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  return Math.max(0, diff);
};

/**
 * Format plan display info for UI.
 */
export const getPlanDisplayInfo = (plan: SubscriptionPlan) => PLAN_LIMITS[plan];
