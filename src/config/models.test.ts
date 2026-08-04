import { describe, it, expect } from 'vitest';
import { FALLBACK_MODELS } from './models';

const MARKUP = 1.5;

describe('FALLBACK_MODELS', () => {
  it('contains all expected models', () => {
    expect(FALLBACK_MODELS.length).toBe(33);
  });

  it('every model has required fields', () => {
    for (const model of FALLBACK_MODELS) {
      expect(model.id).toBeTruthy();
      expect(model.name).toBeTruthy();
      expect(model.provider).toBeTruthy();
      expect(['budget', 'standard', 'premium', 'frontier']).toContain(model.category);
      expect(model.contextLength).toBeGreaterThan(0);
      expect(model.pricing.prompt).toBeGreaterThan(0);
      expect(model.pricing.completion).toBeGreaterThan(0);
    }
  });

  it('has correct number of models per category', () => {
    const counts = { budget: 0, standard: 0, premium: 0, frontier: 0 };
    for (const model of FALLBACK_MODELS) {
      counts[model.category]++;
    }
    expect(counts.budget).toBe(9);
    expect(counts.standard).toBe(11);
    expect(counts.premium).toBe(8);
    expect(counts.frontier).toBe(5);
  });

  it('pricing includes 1.5x markup over base prices', () => {
    // Verify the first budget model (Llama 4 Scout)
    const scout = FALLBACK_MODELS.find((m) => m.id === 'meta-llama/llama-4-scout')!;
    expect(scout).toBeDefined();
    // Base: [0.10, 0.30], Markup: [0.15, 0.45]
    expect(scout.pricing.prompt).toBeCloseTo(0.1 * MARKUP, 4);
    expect(scout.pricing.completion).toBeCloseTo(0.3 * MARKUP, 4);
  });

  it('all model IDs are unique', () => {
    const ids = FALLBACK_MODELS.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('all model IDs follow OpenRouter format (provider/model)', () => {
    for (const model of FALLBACK_MODELS) {
      expect(model.id).toMatch(/^[a-z0-9-]+\/[a-z0-9._-]+$/);
    }
  });

  it('frontier models are the most expensive', () => {
    const frontier = FALLBACK_MODELS.filter((m) => m.category === 'frontier');
    const nonFrontier = FALLBACK_MODELS.filter((m) => m.category !== 'frontier');
    const maxNonFrontierCompletion = Math.max(...nonFrontier.map((m) => m.pricing.completion));
    const minFrontierCompletion = Math.min(...frontier.map((m) => m.pricing.completion));
    expect(minFrontierCompletion).toBeGreaterThan(maxNonFrontierCompletion);
  });

  it('budget models are the cheapest', () => {
    const budget = FALLBACK_MODELS.filter((m) => m.category === 'budget');
    const nonBudget = FALLBACK_MODELS.filter((m) => m.category !== 'budget');
    const maxBudgetCompletion = Math.max(...budget.map((m) => m.pricing.completion));
    const minNonBudgetCompletion = Math.min(...nonBudget.map((m) => m.pricing.completion));
    expect(maxBudgetCompletion).toBeLessThanOrEqual(minNonBudgetCompletion);
  });
});
