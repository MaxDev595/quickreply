/**
 * Plan limits abstraction. v1 is entirely free and unlimited; paid tiers are
 * intentionally NOT implemented or enforced on the client. Future limits must
 * be enforced server-side together with real billing and auth.
 */
export type PlanId = 'free';

export interface PlanLimits {
  id: PlanId;
  maxSnippets: number | 'unlimited';
}

export const CURRENT_PLAN: PlanLimits = { id: 'free', maxSnippets: 'unlimited' };
