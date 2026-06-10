import { describe, it, expect } from 'vitest';
import {
  filterModelsByTier,
  getAccessibleModels,
  sortModels,
  groupModelsByCategory,
} from './openrouter';
import { FALLBACK_MODELS } from '../config/models';

describe('filterModelsByTier', () => {
  it('free tier can only access budget models', () => {
    const filtered = filterModelsByTier(FALLBACK_MODELS, 'free');
    const accessible = filtered.filter((m) => m.accessible);
    const inaccessible = filtered.filter((m) => !m.accessible);

    expect(accessible.every((m) => m.category === 'budget')).toBe(true);
    expect(inaccessible.every((m) => m.category !== 'budget')).toBe(true);
    expect(accessible.length).toBe(4); // 4 budget models
  });

  it('pro tier can access budget, standard, and premium models', () => {
    const filtered = filterModelsByTier(FALLBACK_MODELS, 'pro');
    const accessible = filtered.filter((m) => m.accessible);
    const inaccessible = filtered.filter((m) => !m.accessible);

    expect(accessible.every((m) => ['budget', 'standard', 'premium'].includes(m.category))).toBe(
      true
    );
    expect(inaccessible.every((m) => m.category === 'frontier')).toBe(true);
    expect(accessible.length).toBe(16); // 4 + 6 + 6
    expect(inaccessible.length).toBe(3); // 3 frontier
  });

  it('max tier can access all models', () => {
    const filtered = filterModelsByTier(FALLBACK_MODELS, 'max');
    const accessible = filtered.filter((m) => m.accessible);

    expect(accessible.length).toBe(FALLBACK_MODELS.length);
  });
});

describe('getAccessibleModels', () => {
  it('free tier returns only budget models', () => {
    const models = getAccessibleModels(FALLBACK_MODELS, 'free');
    expect(models.length).toBe(4);
    expect(models.every((m) => m.category === 'budget')).toBe(true);
  });

  it('max tier returns all models', () => {
    const models = getAccessibleModels(FALLBACK_MODELS, 'max');
    expect(models.length).toBe(FALLBACK_MODELS.length);
  });
});

describe('sortModels', () => {
  it('sorts by category order: budget < standard < premium < frontier', () => {
    const sorted = sortModels([...FALLBACK_MODELS]);
    const categories = sorted.map((m) => m.category);

    let lastCategoryIndex = -1;
    const categoryOrder = { budget: 0, standard: 1, premium: 2, frontier: 3 };

    for (const cat of categories) {
      expect(categoryOrder[cat]).toBeGreaterThanOrEqual(lastCategoryIndex);
      lastCategoryIndex = categoryOrder[cat];
    }
  });

  it('priority models appear first within their category', () => {
    const sorted = sortModels([...FALLBACK_MODELS]);
    const budgetModels = sorted.filter((m) => m.category === 'budget');

    // deepseek/deepseek-v3.2 is first priority budget model
    expect(budgetModels[0]!.id).toBe('deepseek/deepseek-v3.2');
    // meta-llama/llama-4-maverick is second
    expect(budgetModels[1]!.id).toBe('meta-llama/llama-4-maverick');
  });

  it('returns same number of models', () => {
    const sorted = sortModels([...FALLBACK_MODELS]);
    expect(sorted.length).toBe(FALLBACK_MODELS.length);
  });
});

describe('groupModelsByCategory', () => {
  it('groups models into correct categories', () => {
    const groups = groupModelsByCategory(FALLBACK_MODELS);

    expect(groups.budget.length).toBe(4);
    expect(groups.standard.length).toBe(6);
    expect(groups.premium.length).toBe(6);
    expect(groups.frontier.length).toBe(3);
  });

  it('each model appears in exactly one category', () => {
    const groups = groupModelsByCategory(FALLBACK_MODELS);
    const totalModels =
      groups.budget.length +
      groups.standard.length +
      groups.premium.length +
      groups.frontier.length;

    expect(totalModels).toBe(FALLBACK_MODELS.length);
  });

  it('all models in a group have the correct category', () => {
    const groups = groupModelsByCategory(FALLBACK_MODELS);

    for (const [category, models] of Object.entries(groups)) {
      for (const model of models) {
        expect(model.category).toBe(category);
      }
    }
  });
});
