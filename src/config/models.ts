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
    contextLength: 1310720,
    orPrice: [0.1, 0.3],
  },
  {
    id: 'meta-llama/llama-4-maverick',
    name: 'Llama 4 Maverick',
    provider: 'Meta',
    category: 'budget',
    contextLength: 1048576,
    orPrice: [0.2, 0.8],
  },
  {
    id: 'deepseek/deepseek-v4-flash-0731',
    name: 'DeepSeek V4 Flash',
    provider: 'DeepSeek',
    category: 'budget',
    contextLength: 1048576,
    orPrice: [0.09, 0.18],
  },
  {
    id: 'deepseek/deepseek-v4-pro',
    name: 'DeepSeek V4 Pro',
    provider: 'DeepSeek',
    category: 'budget',
    contextLength: 1048576,
    orPrice: [0.435, 0.87],
  },
  {
    id: 'openai/gpt-5.6-luna',
    name: 'GPT-5.6 Luna',
    provider: 'OpenAI',
    category: 'budget',
    contextLength: 1050000,
    orPrice: [0.1, 0.6],
  },
  {
    id: 'poolside/laguna-s-2.1',
    name: 'Laguna S 2.1',
    provider: 'Poolside',
    category: 'budget',
    contextLength: 1048576,
    orPrice: [0.09, 0.18],
  },
  {
    id: 'tencent/hy3',
    name: 'Hy3',
    provider: 'Tencent',
    category: 'budget',
    contextLength: 262144,
    orPrice: [0.132, 0.528],
  },
  {
    id: 'xiaomi/mimo-v2.5-pro',
    name: 'MiMo V2.5 Pro',
    provider: 'Xiaomi',
    category: 'budget',
    contextLength: 1050000,
    orPrice: [0.435, 0.87],
  },
  {
    id: 'stepfun/step-3.7-flash',
    name: 'Step 3.7 Flash',
    provider: 'StepFun',
    category: 'budget',
    contextLength: 262144,
    orPrice: [0.2, 1.15],
  },

  // Standard
  {
    id: 'minimax/minimax-m3',
    name: 'MiniMax M3',
    provider: 'MiniMax',
    category: 'standard',
    contextLength: 1048576,
    orPrice: [0.3, 1.2],
  },
  {
    id: 'openai/gpt-5.6-terra',
    name: 'GPT-5.6 Terra',
    provider: 'OpenAI',
    category: 'standard',
    contextLength: 1050000,
    orPrice: [1.0, 6.0],
  },
  {
    id: 'moonshotai/kimi-k2.6',
    name: 'Kimi K2.6',
    provider: 'Moonshot',
    category: 'standard',
    contextLength: 262144,
    orPrice: [0.589, 2.48],
  },
  {
    id: 'qwen/qwen3.7-plus',
    name: 'Qwen 3.7 Plus',
    provider: 'Qwen',
    category: 'standard',
    contextLength: 1000000,
    orPrice: [0.32, 1.28],
  },
  {
    id: 'mistralai/mistral-large-2512',
    name: 'Mistral Large 3',
    provider: 'Mistral',
    category: 'standard',
    contextLength: 262144,
    orPrice: [0.5, 1.5],
  },
  {
    id: 'google/gemini-3.6-flash',
    name: 'Gemini 3.6 Flash',
    provider: 'Google',
    category: 'standard',
    contextLength: 1048576,
    orPrice: [1.5, 7.5],
  },
  {
    id: 'z-ai/glm-5.2',
    name: 'GLM 5.2',
    provider: 'Z.ai',
    category: 'standard',
    contextLength: 1048576,
    orPrice: [0.76, 2.42],
  },
  {
    id: 'bytedance-seed/seed-2.0-lite',
    name: 'Seed 2.0 Lite',
    provider: 'ByteDance',
    category: 'standard',
    contextLength: 262144,
    orPrice: [0.25, 2.0],
  },
  {
    id: 'amazon/nova-2-lite-v1',
    name: 'Nova 2 Lite',
    provider: 'Amazon',
    category: 'standard',
    contextLength: 1000000,
    orPrice: [0.3, 2.5],
  },
  {
    id: 'nvidia/nemotron-3-ultra-550b-a55b',
    name: 'Nemotron 3 Ultra',
    provider: 'NVIDIA',
    category: 'standard',
    contextLength: 512288,
    orPrice: [0.6, 3.6],
  },
  {
    id: 'thinkingmachines/inkling',
    name: 'Inkling',
    provider: 'Thinking Machines',
    category: 'standard',
    contextLength: 1048576,
    orPrice: [1.0, 4.05],
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
    id: 'meta/muse-spark-1.1',
    name: 'Muse Spark 1.1',
    provider: 'Meta',
    category: 'premium',
    contextLength: 1048576,
    orPrice: [1.25, 4.25],
  },
  {
    id: 'openai/gpt-5.3-codex',
    name: 'GPT-5.3 Codex',
    provider: 'OpenAI',
    category: 'premium',
    contextLength: 400000,
    orPrice: [1.75, 14.0],
  },
  {
    id: 'moonshotai/kimi-k3',
    name: 'Kimi K3',
    provider: 'Moonshot',
    category: 'premium',
    contextLength: 1048576,
    orPrice: [3.0, 15.0],
  },
  {
    id: 'google/gemini-3.1-pro-preview',
    name: 'Gemini 3.1 Pro',
    provider: 'Google',
    category: 'premium',
    contextLength: 1048576,
    orPrice: [2.0, 12.0],
  },
  {
    // Priced at the $3/$15 sticker rate — OpenRouter's $2/$10 introductory
    // pricing ends 2026-08-31, and billing below our post-intro cost would
    // erase the margin.
    id: 'anthropic/claude-sonnet-5',
    name: 'Claude Sonnet 5',
    provider: 'Anthropic',
    category: 'premium',
    contextLength: 1000000,
    orPrice: [3.0, 15.0],
  },
  {
    id: 'x-ai/grok-4.5',
    name: 'Grok 4.5',
    provider: 'SpaceXAI',
    category: 'premium',
    contextLength: 500000,
    orPrice: [2.0, 6.0],
  },
  {
    id: 'qwen/qwen3.8-max',
    name: 'Qwen3.8 Max',
    provider: 'Qwen',
    category: 'premium',
    contextLength: 1000000,
    orPrice: [2.0, 6.0],
  },

  // Frontier
  {
    id: 'anthropic/claude-opus-5',
    name: 'Claude Opus 5',
    provider: 'Anthropic',
    category: 'frontier',
    contextLength: 1000000,
    orPrice: [5.0, 25.0],
  },
  {
    id: 'anthropic/claude-fable-5',
    name: 'Claude Fable 5',
    provider: 'Anthropic',
    category: 'frontier',
    contextLength: 1000000,
    orPrice: [10.0, 50.0],
  },
  {
    id: 'openai/gpt-5.6-sol',
    name: 'GPT-5.6 Sol',
    provider: 'OpenAI',
    category: 'frontier',
    contextLength: 1050000,
    orPrice: [5.0, 30.0],
  },
  {
    id: 'sakana/fugu-ultra',
    name: 'Fugu Ultra',
    provider: 'Sakana',
    category: 'frontier',
    contextLength: 1000000,
    orPrice: [5.0, 30.0],
  },
  {
    id: 'openai/gpt-5.5-pro',
    name: 'GPT-5.5 Pro',
    provider: 'OpenAI',
    category: 'frontier',
    contextLength: 1050000,
    orPrice: [30.0, 180.0],
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
  'deepseek/deepseek-v4-flash-0731',
  'meta-llama/llama-4-maverick',
  'openai/gpt-5.6-terra',
  'google/gemini-3.6-flash',
  'anthropic/claude-haiku-4.5',
  'meta/muse-spark-1.1',
  'anthropic/claude-sonnet-5',
  'anthropic/claude-opus-5',
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
