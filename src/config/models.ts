import type { LLMModel, ModelCategory, SubscriptionTier } from '../types';
import { CATEGORY_MIN_TIER, CATEGORY_ORDER } from '../types';

/**
 * Markup multiplier applied to OpenRouter's raw prices to get the price we
 * charge users (1.5 = 50% margin). This MUST match MARKUP_MULTIPLIER in
 * functions/src/config/tiers.ts — the backend is the source of truth for
 * billing; this constant only affects client-side display. The relationship
 * is guarded by src/config/models-sync.test.ts.
 */
const MARKUP = 1.5;

interface ModelDef {
  id: string;
  name: string;
  provider: string;
  category: ModelCategory;
  contextLength: number;
  orPrice: [number, number]; // [prompt, completion] per 1M tokens in dollars
}

const DEFS: ModelDef[] = [
  // Budget
  {
    id: 'meta-llama/llama-4-scout',
    name: 'Llama 4 Scout',
    provider: 'Meta',
    category: 'budget',
    contextLength: 512000,
    orPrice: [0.08, 0.3],
  },
  {
    id: 'meta-llama/llama-4-maverick',
    name: 'Llama 4 Maverick',
    provider: 'Meta',
    category: 'budget',
    contextLength: 256000,
    orPrice: [0.15, 0.6],
  },
  {
    id: 'deepseek/deepseek-v3.2',
    name: 'DeepSeek V3.2',
    provider: 'DeepSeek',
    category: 'budget',
    contextLength: 128000,
    orPrice: [0.25, 0.4],
  },
  {
    id: 'minimax/minimax-m2.5',
    name: 'MiniMax M2.5',
    provider: 'MiniMax',
    category: 'budget',
    contextLength: 196608,
    orPrice: [0.27, 0.95],
  },

  // Standard
  {
    id: 'openai/gpt-5.1-codex-mini',
    name: 'GPT-5.1 Codex Mini',
    provider: 'OpenAI',
    category: 'standard',
    contextLength: 200000,
    orPrice: [0.25, 2.0],
  },
  {
    id: 'moonshotai/kimi-k2.5',
    name: 'Kimi K2.5',
    provider: 'Moonshot',
    category: 'standard',
    contextLength: 128000,
    orPrice: [0.45, 2.2],
  },
  {
    id: 'qwen/qwen3.5-plus-02-15',
    name: 'Qwen 3.5 Plus',
    provider: 'Qwen',
    category: 'standard',
    contextLength: 1000000,
    orPrice: [0.26, 1.56],
  },
  {
    id: 'mistralai/mistral-large-2512',
    name: 'Mistral Large 3',
    provider: 'Mistral',
    category: 'standard',
    contextLength: 128000,
    orPrice: [0.5, 1.5],
  },
  {
    id: 'deepseek/deepseek-r1',
    name: 'DeepSeek R1',
    provider: 'DeepSeek',
    category: 'standard',
    contextLength: 128000,
    orPrice: [0.7, 2.5],
  },
  {
    id: 'google/gemini-3-flash-preview',
    name: 'Gemini 3 Flash',
    provider: 'Google',
    category: 'standard',
    contextLength: 1000000,
    orPrice: [0.5, 3.0],
  },

  // Premium
  {
    id: 'anthropic/claude-haiku-4.5',
    name: 'Claude Haiku 4.5',
    provider: 'Anthropic',
    category: 'premium',
    contextLength: 200000,
    orPrice: [1.0, 5.0],
  },
  {
    id: 'openai/gpt-5.1',
    name: 'GPT-5.1',
    provider: 'OpenAI',
    category: 'premium',
    contextLength: 200000,
    orPrice: [1.25, 10.0],
  },
  {
    id: 'openai/gpt-5.3-codex',
    name: 'GPT-5.3 Codex',
    provider: 'OpenAI',
    category: 'premium',
    contextLength: 200000,
    orPrice: [1.75, 14.0],
  },
  {
    id: 'openai/gpt-5.2',
    name: 'GPT-5.2',
    provider: 'OpenAI',
    category: 'premium',
    contextLength: 200000,
    orPrice: [1.75, 14.0],
  },
  {
    id: 'google/gemini-3.1-pro-preview',
    name: 'Gemini 3.1 Pro',
    provider: 'Google',
    category: 'premium',
    contextLength: 1000000,
    orPrice: [2.0, 12.0],
  },
  {
    id: 'anthropic/claude-sonnet-4.6',
    name: 'Claude Sonnet 4.6',
    provider: 'Anthropic',
    category: 'premium',
    contextLength: 200000,
    orPrice: [3.0, 15.0],
  },

  // Frontier
  {
    id: 'anthropic/claude-opus-4.5',
    name: 'Claude Opus 4.5',
    provider: 'Anthropic',
    category: 'frontier',
    contextLength: 200000,
    orPrice: [5.0, 25.0],
  },
  {
    id: 'anthropic/claude-opus-4.6',
    name: 'Claude Opus 4.6',
    provider: 'Anthropic',
    category: 'frontier',
    contextLength: 200000,
    orPrice: [5.0, 25.0],
  },
  {
    id: 'openai/gpt-5.2-pro',
    name: 'GPT-5.2 Pro',
    provider: 'OpenAI',
    category: 'frontier',
    contextLength: 200000,
    orPrice: [21.0, 168.0],
  },
];

/** Client-side fallback model catalog (mirrors server-side config) */
export const FALLBACK_MODELS: LLMModel[] = DEFS.map((d) => ({
  id: d.id,
  name: d.name,
  provider: d.provider,
  category: d.category,
  contextLength: d.contextLength,
  pricing: {
    prompt: parseFloat((d.orPrice[0] * MARKUP).toFixed(4)),
    completion: parseFloat((d.orPrice[1] * MARKUP).toFixed(4)),
  },
}));

// ============ Model helpers (single source of truth) ============

const TIER_ORDER: Record<SubscriptionTier, number> = { free: 0, pro: 1, max: 2 };

/**
 * Filter models based on user's subscription tier.
 * Models whose category requires a higher tier are marked as inaccessible.
 */
export function filterModelsByTier(models: LLMModel[], tier: SubscriptionTier): LLMModel[] {
  const userTierLevel = TIER_ORDER[tier];

  return models.map((model) => ({
    ...model,
    accessible: TIER_ORDER[CATEGORY_MIN_TIER[model.category]] <= userTierLevel,
  }));
}

/**
 * Get only accessible models for a tier (filters out inaccessible ones).
 */
export function getAccessibleModels(models: LLMModel[], tier: SubscriptionTier): LLMModel[] {
  return filterModelsByTier(models, tier).filter((m) => m.accessible);
}

/** Models pinned to the top of their category, in display order */
const PRIORITY_MODELS = [
  'deepseek/deepseek-v3.2',
  'meta-llama/llama-4-maverick',
  'openai/gpt-5.1-codex-mini',
  'google/gemini-3-flash-preview',
  'anthropic/claude-haiku-4.5',
  'openai/gpt-5.2',
  'anthropic/claude-sonnet-4.6',
  'anthropic/claude-opus-4.6',
];

/**
 * Sort models: by category order, then by priority within category.
 */
export function sortModels(models: LLMModel[]): LLMModel[] {
  return models.sort((a, b) => {
    const catDiff = CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category);
    if (catDiff !== 0) return catDiff;

    const aPriority = PRIORITY_MODELS.indexOf(a.id);
    const bPriority = PRIORITY_MODELS.indexOf(b.id);

    if (aPriority !== -1 && bPriority !== -1) return aPriority - bPriority;
    if (aPriority !== -1) return -1;
    if (bPriority !== -1) return 1;

    return a.name.localeCompare(b.name);
  });
}

/**
 * Group models by category.
 */
export function groupModelsByCategory(models: LLMModel[]): Record<ModelCategory, LLMModel[]> {
  const groups: Record<ModelCategory, LLMModel[]> = {
    budget: [],
    standard: [],
    premium: [],
    frontier: [],
  };

  for (const model of models) {
    groups[model.category].push(model);
  }

  return groups;
}
