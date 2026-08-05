import { describe, it, expect } from 'vitest';
import {
  CATEGORY_ORDER,
  CATEGORY_LABELS,
  CATEGORY_MIN_TIER,
  DEFAULT_MODEL_ID,
  resolveModelIds,
} from './index';
import { FALLBACK_MODELS } from '../config/models';

describe('CATEGORY_ORDER', () => {
  it('has all four categories in correct order', () => {
    expect(CATEGORY_ORDER).toEqual(['budget', 'standard', 'premium', 'frontier']);
  });
});

describe('CATEGORY_LABELS', () => {
  it('has human-readable labels for all categories', () => {
    expect(CATEGORY_LABELS.budget).toBe('Budget');
    expect(CATEGORY_LABELS.standard).toBe('Standard');
    expect(CATEGORY_LABELS.premium).toBe('Premium');
    expect(CATEGORY_LABELS.frontier).toBe('Frontier');
  });
});

describe('CATEGORY_MIN_TIER', () => {
  it('budget requires free tier', () => {
    expect(CATEGORY_MIN_TIER.budget).toBe('free');
  });

  it('standard and premium require pro tier', () => {
    expect(CATEGORY_MIN_TIER.standard).toBe('pro');
    expect(CATEGORY_MIN_TIER.premium).toBe('pro');
  });

  it('frontier requires max tier', () => {
    expect(CATEGORY_MIN_TIER.frontier).toBe('max');
  });
});

describe('DEFAULT_MODEL_ID', () => {
  it('points to a valid budget model', () => {
    expect(DEFAULT_MODEL_ID).toBe('deepseek/deepseek-v4-flash-0731');
    const model = FALLBACK_MODELS.find(m => m.id === DEFAULT_MODEL_ID);
    expect(model).toBeDefined();
    expect(model!.category).toBe('budget');
  });
});

describe('resolveModelIds', () => {
  it('resolves valid model IDs to full model objects', () => {
    const ids = ['deepseek/deepseek-v4-flash-0731', 'anthropic/claude-sonnet-5'];
    const resolved = resolveModelIds(ids, FALLBACK_MODELS);

    expect(resolved.length).toBe(2);
    expect(resolved[0]!.id).toBe('deepseek/deepseek-v4-flash-0731');
    expect(resolved[1]!.id).toBe('anthropic/claude-sonnet-5');
  });

  it('filters out unknown model IDs', () => {
    const ids = ['deepseek/deepseek-v4-flash-0731', 'nonexistent/model'];
    const resolved = resolveModelIds(ids, FALLBACK_MODELS);

    expect(resolved.length).toBe(1);
    expect(resolved[0]!.id).toBe('deepseek/deepseek-v4-flash-0731');
  });

  it('preserves order of input IDs', () => {
    const ids = ['anthropic/claude-sonnet-5', 'deepseek/deepseek-v4-flash-0731'];
    const resolved = resolveModelIds(ids, FALLBACK_MODELS);

    expect(resolved[0]!.id).toBe('anthropic/claude-sonnet-5');
    expect(resolved[1]!.id).toBe('deepseek/deepseek-v4-flash-0731');
  });

  it('returns empty array for empty input', () => {
    expect(resolveModelIds([], FALLBACK_MODELS)).toEqual([]);
  });

  it('returns empty array when all IDs are invalid', () => {
    expect(resolveModelIds(['fake/model'], FALLBACK_MODELS)).toEqual([]);
  });
});
