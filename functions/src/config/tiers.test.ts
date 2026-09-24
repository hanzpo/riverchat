import { describe, expect, it } from 'vitest';
import {
  TIER_CONFIGS,
  MARKUP_MULTIPLIER,
  tierCanAccessCategory,
  minTierForCategory,
  getTierFromPriceId,
  resolveModelAccess,
  PREMIUM_TRIAL_MESSAGES,
  type ModelCategory,
  type SubscriptionTier,
  type TierConfig,
} from './tiers.js';

const ALL_TIERS: SubscriptionTier[] = ['free', 'pro', 'max'];
const ALL_CATEGORIES: ModelCategory[] = ['budget', 'standard', 'premium', 'frontier'];

describe('TIER_CONFIGS invariants', () => {
  it('defines every tier', () => {
    for (const tier of ALL_TIERS) {
      expect(TIER_CONFIGS[tier]).toBeDefined();
    }
  });

  it('has positive monthly credits for every tier', () => {
    for (const tier of ALL_TIERS) {
      expect(TIER_CONFIGS[tier].monthlyCredits).toBeGreaterThan(0);
      expect(Number.isInteger(TIER_CONFIGS[tier].monthlyCredits)).toBe(true);
    }
  });

  it('free tier costs nothing, paid tiers cost something', () => {
    expect(TIER_CONFIGS.free.price).toBe(0);
    expect(TIER_CONFIGS.pro.price).toBeGreaterThan(0);
    expect(TIER_CONFIGS.max.price).toBeGreaterThan(TIER_CONFIGS.pro.price);
  });

  it('higher tiers have a superset of lower-tier model access', () => {
    for (const category of TIER_CONFIGS.free.modelAccess) {
      expect(TIER_CONFIGS.pro.modelAccess).toContain(category);
    }
    for (const category of TIER_CONFIGS.pro.modelAccess) {
      expect(TIER_CONFIGS.max.modelAccess).toContain(category);
    }
  });

  it('only references known model categories', () => {
    for (const tier of ALL_TIERS) {
      for (const category of TIER_CONFIGS[tier].modelAccess) {
        expect(ALL_CATEGORIES).toContain(category);
      }
    }
  });

  it('reserves web search for paid tiers', () => {
    expect(TIER_CONFIGS.free.webSearchEnabled).toBe(false);
    expect(TIER_CONFIGS.pro.webSearchEnabled).toBe(true);
    expect(TIER_CONFIGS.max.webSearchEnabled).toBe(true);
  });

  it('applies a markup above cost', () => {
    expect(MARKUP_MULTIPLIER).toBeGreaterThan(1);
  });
});

describe('tierCanAccessCategory / minTierForCategory', () => {
  it('every category is accessible from its minimum tier', () => {
    for (const category of ALL_CATEGORIES) {
      const minTier = minTierForCategory(category);
      expect(tierCanAccessCategory(minTier, category)).toBe(true);
    }
  });

  it('free can only access budget models', () => {
    expect(tierCanAccessCategory('free', 'budget')).toBe(true);
    expect(tierCanAccessCategory('free', 'standard')).toBe(false);
    expect(tierCanAccessCategory('free', 'premium')).toBe(false);
    expect(tierCanAccessCategory('free', 'frontier')).toBe(false);
  });

  it('frontier requires max', () => {
    expect(minTierForCategory('frontier')).toBe('max');
    expect(tierCanAccessCategory('pro', 'frontier')).toBe(false);
    expect(tierCanAccessCategory('max', 'frontier')).toBe(true);
  });
});

describe('getTierFromPriceId', () => {
  const configs: Record<SubscriptionTier, TierConfig> = {
    free: { ...TIER_CONFIGS.free },
    pro: { ...TIER_CONFIGS.pro, stripePriceId: 'price_pro_123' },
    max: { ...TIER_CONFIGS.max, stripePriceId: 'price_max_456' },
  };

  it('maps configured price IDs to their tier', () => {
    expect(getTierFromPriceId('price_pro_123', configs)).toBe('pro');
    expect(getTierFromPriceId('price_max_456', configs)).toBe('max');
  });

  it('fails closed (null) for unrecognized price IDs', () => {
    expect(getTierFromPriceId('price_unknown', configs)).toBeNull();
  });

  it('fails closed for missing price IDs', () => {
    expect(getTierFromPriceId(undefined, configs)).toBeNull();
    expect(getTierFromPriceId('', configs)).toBeNull();
  });

  it('never matches a tier whose price ID is unconfigured (empty string)', () => {
    const unconfigured: Record<SubscriptionTier, TierConfig> = {
      free: { ...configs.free },
      pro: { ...configs.pro, stripePriceId: '' },
      max: { ...configs.max, stripePriceId: '' },
    };
    expect(getTierFromPriceId('price_pro_123', unconfigured)).toBeNull();
    expect(getTierFromPriceId('', unconfigured)).toBeNull();
  });
});

describe('resolveModelAccess', () => {
  it('allows every category the tier includes, regardless of trial or prepaid', () => {
    for (const tier of ALL_TIERS) {
      for (const cat of ALL_CATEGORIES) {
        if (tierCanAccessCategory(tier, cat)) {
          expect(resolveModelAccess(tier, cat, 0, 99)).toEqual({ allowed: true, via: 'tier' });
        }
      }
    }
  });

  it('unlocks every category with any prepaid balance', () => {
    for (const cat of ['standard', 'premium', 'frontier'] as ModelCategory[]) {
      expect(resolveModelAccess('free', cat, 1, 99)).toEqual({ allowed: true, via: 'prepaid' });
    }
    expect(resolveModelAccess('pro', 'frontier', 500, 0)).toEqual({ allowed: true, via: 'prepaid' });
  });

  it('does not treat zero or negative prepaid balance as access', () => {
    expect(resolveModelAccess('free', 'frontier', 0, 0)).toEqual({ allowed: false });
    expect(resolveModelAccess('free', 'frontier', -3, 0)).toEqual({ allowed: false });
  });

  it('gives free users a limited trial of standard and premium models only', () => {
    for (const cat of ['standard', 'premium'] as ModelCategory[]) {
      expect(resolveModelAccess('free', cat, 0, 0)).toEqual({ allowed: true, via: 'trial' });
      expect(resolveModelAccess('free', cat, 0, PREMIUM_TRIAL_MESSAGES - 1)).toEqual({ allowed: true, via: 'trial' });
      expect(resolveModelAccess('free', cat, 0, PREMIUM_TRIAL_MESSAGES)).toEqual({ allowed: false });
    }
    expect(resolveModelAccess('free', 'frontier', 0, 0)).toEqual({ allowed: false });
  });

  it('keeps frontier locked for pro users without prepaid credits', () => {
    expect(resolveModelAccess('pro', 'frontier', 0, 0)).toEqual({ allowed: false });
  });
});
