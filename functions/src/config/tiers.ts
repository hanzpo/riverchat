export type SubscriptionTier = 'free' | 'pro' | 'max';
export type ModelCategory = 'budget' | 'standard' | 'premium' | 'frontier';

export interface TierConfig {
  price: number; // Monthly price in cents
  monthlyCredits: number; // Monthly token budget in cents
  maxModelsPerPrompt: number; // -1 = unlimited
  modelAccess: ModelCategory[];
  webSearchEnabled: boolean;
  stripePriceId?: string; // Set after Stripe products are created
}

export const TIER_CONFIGS: Record<SubscriptionTier, TierConfig> = {
  free: {
    price: 0,
    monthlyCredits: 200, // $2.00
    maxModelsPerPrompt: 2,
    modelAccess: ['budget'],
    webSearchEnabled: false,
  },
  pro: {
    price: 2000, // $20.00
    monthlyCredits: 2000, // $20.00
    maxModelsPerPrompt: 5,
    modelAccess: ['budget', 'standard', 'premium'],
    webSearchEnabled: true,
    stripePriceId: process.env.STRIPE_PRO_PRICE_ID || '',
  },
  max: {
    price: 10000, // $100.00
    monthlyCredits: 12000, // $120.00 (20% bonus)
    maxModelsPerPrompt: -1, // unlimited
    modelAccess: ['budget', 'standard', 'premium', 'frontier'],
    webSearchEnabled: true,
    stripePriceId: process.env.STRIPE_MAX_PRICE_ID || '',
  },
};

export const MARKUP_MULTIPLIER = 1.5;

/** Check if a tier can access a model category */
export function tierCanAccessCategory(
  tier: SubscriptionTier,
  category: ModelCategory
): boolean {
  return TIER_CONFIGS[tier].modelAccess.includes(category);
}

/**
 * Map a Stripe price ID to a subscription tier.
 * Returns null for missing or unrecognized price IDs — callers must fail
 * closed rather than guessing a tier.
 */
export function getTierFromPriceId(
  priceId: string | undefined,
  configs: Record<SubscriptionTier, TierConfig> = TIER_CONFIGS
): SubscriptionTier | null {
  if (!priceId) return null;
  if (configs.pro.stripePriceId && priceId === configs.pro.stripePriceId) {
    return 'pro';
  }
  if (configs.max.stripePriceId && priceId === configs.max.stripePriceId) {
    return 'max';
  }
  return null;
}

/** Get the minimum tier required to access a category */
export function minTierForCategory(category: ModelCategory): SubscriptionTier {
  if (category === 'budget') return 'free';
  if (category === 'standard' || category === 'premium') return 'pro';
  return 'max'; // frontier
}
