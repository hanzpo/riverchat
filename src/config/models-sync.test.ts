/**
 * Guard against silent desync between the duplicated model catalogs:
 *   - src/config/models.ts (client-side fallback catalog)
 *   - functions/src/config/models.ts (server-side source of truth for billing)
 *
 * If this test fails, the two files have drifted — update them together.
 */
import { describe, it, expect } from 'vitest';
import { FALLBACK_MODELS } from './models';
import { CATEGORY_MIN_TIER, type SubscriptionTier } from '../types';
import { MODEL_CATALOG } from '../../functions/src/config/models.js';
import { MARKUP_MULTIPLIER, TIER_CONFIGS } from '../../functions/src/config/tiers.js';

const TIER_LEVELS: Record<SubscriptionTier, number> = { free: 0, pro: 1, max: 2 };

describe('client/server model catalog sync', () => {
  it('contains the same model IDs', () => {
    const clientIds = FALLBACK_MODELS.map((m) => m.id).sort();
    const serverIds = MODEL_CATALOG.map((m) => m.id).sort();
    expect(clientIds).toEqual(serverIds);
  });

  it('has matching name, provider, category, and context length per model', () => {
    for (const server of MODEL_CATALOG) {
      const client = FALLBACK_MODELS.find((m) => m.id === server.id);
      expect(client, `client catalog missing ${server.id}`).toBeDefined();
      expect(client!.name, `name mismatch for ${server.id}`).toBe(server.displayName);
      expect(client!.provider, `provider mismatch for ${server.id}`).toBe(server.provider);
      expect(client!.category, `category (tier) mismatch for ${server.id}`).toBe(server.category);
      expect(client!.contextLength, `contextLength mismatch for ${server.id}`).toBe(
        server.contextLength
      );
    }
  });

  it('has client pricing identical to server (marked-up) pricing', () => {
    for (const server of MODEL_CATALOG) {
      const client = FALLBACK_MODELS.find((m) => m.id === server.id)!;
      expect(client.pricing.prompt, `prompt price mismatch for ${server.id}`).toBe(
        server.pricing.prompt
      );
      expect(client.pricing.completion, `completion price mismatch for ${server.id}`).toBe(
        server.pricing.completion
      );
    }
  });

  it('keeps pricing consistent with the backend markup over OpenRouter prices', () => {
    for (const server of MODEL_CATALOG) {
      const client = FALLBACK_MODELS.find((m) => m.id === server.id)!;
      const expectedPrompt = parseFloat(
        (server.openRouterPricing.prompt * MARKUP_MULTIPLIER).toFixed(4)
      );
      const expectedCompletion = parseFloat(
        (server.openRouterPricing.completion * MARKUP_MULTIPLIER).toFixed(4)
      );
      expect(client.pricing.prompt, `markup violated for ${server.id} (prompt)`).toBe(
        expectedPrompt
      );
      expect(client.pricing.completion, `markup violated for ${server.id} (completion)`).toBe(
        expectedCompletion
      );
    }
  });

  it('keeps client CATEGORY_MIN_TIER consistent with backend TIER_CONFIGS.modelAccess', () => {
    const tiers = Object.keys(TIER_LEVELS) as SubscriptionTier[];
    for (const [category, minTier] of Object.entries(CATEGORY_MIN_TIER)) {
      for (const tier of tiers) {
        const clientAllows = TIER_LEVELS[tier] >= TIER_LEVELS[minTier];
        const serverAllows = TIER_CONFIGS[tier].modelAccess.includes(category as never);
        expect(
          clientAllows,
          `tier access mismatch for category "${category}" on tier "${tier}"`
        ).toBe(serverAllows);
      }
    }
  });
});
