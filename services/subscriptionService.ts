/**
 * Subscription Service
 *
 * Manages SaaS subscription status, plan limits, and usage tracking.
 * Currently all limits are bypassed (enterprise mode).
 */

import { SubscriptionInfo, SubscriptionPlan, PLAN_LIMITS } from '../types';

// ─── FETCH SUBSCRIPTION STATUS ──────────────────────────────────────────────

/**
 * Get the current subscription status for an organization.
 * Returns enterprise-level defaults (no remote check needed yet).
 */
export const fetchSubscriptionStatus = async (_orgId: string): Promise<SubscriptionInfo | null> => {
  return getDefaultTrialInfo();
};

// ─── HELPERS ────────────────────────────────────────────────────────────────

const getDefaultTrialInfo = (): SubscriptionInfo => ({
  plan: 'enterprise',
  status: 'active',
  isTrialExpired: false,
  usage: {
    estimatesThisMonth: 0,
    maxEstimates: 99999,
    customers: 0,
    maxCustomers: 99999,
    users: 0,
    maxUsers: 50,
  },
});

/**
 * Check if a specific action is allowed under current plan limits.
 * Returns { allowed: boolean, message?: string }
 */
export const checkPlanLimit = (
  _sub: SubscriptionInfo,
  _action: 'create_estimate' | 'create_customer' | 'add_user',
): { allowed: boolean; message?: string } => {
  // All limits bypassed
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
