import { describe, expect, it } from 'vitest';
import {
  MODEL_CATALOG,
  getModelConfig,
  calculateCostCents,
  toMicroDollarsPerMillion,
} from './models.js';
import { MARKUP_MULTIPLIER } from './tiers.js';

describe('MODEL_CATALOG', () => {
  it('has unique model IDs', () => {
    const ids = MODEL_CATALOG.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('has positive pricing for every model', () => {
    for (const model of MODEL_CATALOG) {
      expect(model.openRouterPricing.prompt).toBeGreaterThan(0);
      expect(model.openRouterPricing.completion).toBeGreaterThan(0);
      expect(model.pricing.prompt).toBeGreaterThan(0);
      expect(model.pricing.completion).toBeGreaterThan(0);
    }
  });

  it('derives display pricing from the rounded integer micro-dollar values (no toFixed drift)', () => {
    for (const model of MODEL_CATALOG) {
      expect(model.pricing.prompt).toBe(
        Math.round(model.openRouterPricing.prompt * MARKUP_MULTIPLIER * 1e6) / 1e6
      );
      expect(model.pricing.completion).toBe(
        Math.round(model.openRouterPricing.completion * MARKUP_MULTIPLIER * 1e6) / 1e6
      );
    }
  });

  it('marks up every model by the markup multiplier', () => {
    for (const model of MODEL_CATALOG) {
      expect(model.pricing.prompt).toBeCloseTo(
        model.openRouterPricing.prompt * MARKUP_MULTIPLIER,
        6
      );
      expect(model.pricing.completion).toBeCloseTo(
        model.openRouterPricing.completion * MARKUP_MULTIPLIER,
        6
      );
    }
  });
});

describe('getModelConfig', () => {
  it('finds a known model', () => {
    const model = getModelConfig('anthropic/claude-sonnet-4.6');
    expect(model).toBeDefined();
    expect(model!.provider).toBe('Anthropic');
  });

  it('returns undefined for unknown models', () => {
    expect(getModelConfig('not/a-model')).toBeUndefined();
  });
});

describe('toMicroDollarsPerMillion', () => {
  it('converts dollar prices to integer micro-dollars', () => {
    expect(toMicroDollarsPerMillion(0.27)).toBe(270_000);
    expect(toMicroDollarsPerMillion(3.0)).toBe(3_000_000);
    expect(toMicroDollarsPerMillion(168.0)).toBe(168_000_000);
  });

  it('always produces integers (the float-drift fix)', () => {
    for (const model of MODEL_CATALOG) {
      expect(
        Number.isInteger(toMicroDollarsPerMillion(model.openRouterPricing.prompt))
      ).toBe(true);
      expect(
        Number.isInteger(
          toMicroDollarsPerMillion(model.openRouterPricing.prompt * MARKUP_MULTIPLIER)
        )
      ).toBe(true);
    }
  });
});

describe('calculateCostCents', () => {
  it('throws for unknown models', () => {
    expect(() => calculateCostCents('not/a-model', 100, 100)).toThrow(
      'Unknown model'
    );
  });

  it('costs zero for zero tokens', () => {
    const { ourCostCents, userCostCents } = calculateCostCents(
      'anthropic/claude-sonnet-4.6',
      0,
      0
    );
    expect(ourCostCents).toBe(0);
    expect(userCostCents).toBe(0);
  });

  it('rounds any non-zero usage up to at least 1 cent', () => {
    const { ourCostCents, userCostCents } = calculateCostCents(
      'meta-llama/llama-4-scout', // cheapest model
      1,
      0
    );
    expect(ourCostCents).toBe(1);
    expect(userCostCents).toBe(1);
  });

  it('computes exact known values (claude-sonnet-4.6, 1k prompt + 2k completion)', () => {
    // our: 1000 * $3/M + 2000 * $15/M = $0.033 -> ceil(3.3c) = 4c
    // user: 1000 * $4.5/M + 2000 * $22.5/M = $0.0495 -> ceil(4.95c) = 5c
    const { ourCostCents, userCostCents } = calculateCostCents(
      'anthropic/claude-sonnet-4.6',
      1000,
      2000
    );
    expect(ourCostCents).toBe(4);
    expect(userCostCents).toBe(5);
  });

  it('computes exact integer-cent values without float drift (1M tokens)', () => {
    // 1M prompt tokens of minimax (or $0.27/M, user $0.405/M):
    // our = exactly 27c, user = exactly 40.5c -> ceil 41c.
    const { ourCostCents, userCostCents } = calculateCostCents(
      'minimax/minimax-m2.5',
      1_000_000,
      0
    );
    expect(ourCostCents).toBe(27);
    expect(userCostCents).toBe(41);
  });

  it('always charges the user at least our cost', () => {
    for (const model of MODEL_CATALOG) {
      const { ourCostCents, userCostCents } = calculateCostCents(
        model.id,
        12_345,
        6_789
      );
      expect(userCostCents).toBeGreaterThanOrEqual(ourCostCents);
    }
  });

  it('is deterministic and monotonic in token counts', () => {
    const a = calculateCostCents('openai/gpt-5.1', 50_000, 10_000);
    const b = calculateCostCents('openai/gpt-5.1', 50_000, 10_000);
    expect(a).toEqual(b);

    const more = calculateCostCents('openai/gpt-5.1', 50_001, 10_000);
    expect(more.userCostCents).toBeGreaterThanOrEqual(a.userCostCents);
  });
});
