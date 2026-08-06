import { type ModelCategory, MARKUP_MULTIPLIER } from './tiers.js';

export interface ModelConfig {
  id: string;
  displayName: string;
  provider: string;
  category: ModelCategory;
  contextLength: number;
  /** OpenRouter price per million tokens (in dollars) */
  openRouterPricing: {
    prompt: number;
    completion: number;
  };
  /** Our price per million tokens (in dollars, with markup) */
  pricing: {
    prompt: number;
    completion: number;
  };
}

interface ModelDef {
  id: string;
  displayName: string;
  provider: string;
  category: ModelCategory;
  contextLength: number;
  /** OpenRouter price per million tokens [prompt, completion] */
  orPrice: [number, number];
}

const MODEL_DEFS: ModelDef[] = [
  // Budget
  { id: 'meta-llama/llama-4-scout', displayName: 'Llama 4 Scout', provider: 'Meta', category: 'budget', contextLength: 1310720, orPrice: [0.10, 0.30] },
  { id: 'meta-llama/llama-4-maverick', displayName: 'Llama 4 Maverick', provider: 'Meta', category: 'budget', contextLength: 1048576, orPrice: [0.20, 0.80] },
  { id: 'deepseek/deepseek-v4-flash-0731', displayName: 'DeepSeek V4 Flash', provider: 'DeepSeek', category: 'budget', contextLength: 1048576, orPrice: [0.09, 0.18] },
  { id: 'deepseek/deepseek-v4-pro', displayName: 'DeepSeek V4 Pro', provider: 'DeepSeek', category: 'budget', contextLength: 1048576, orPrice: [0.435, 0.87] },
  { id: 'openai/gpt-5.6-luna', displayName: 'GPT-5.6 Luna', provider: 'OpenAI', category: 'budget', contextLength: 1050000, orPrice: [0.10, 0.60] },
  { id: 'poolside/laguna-s-2.1', displayName: 'Laguna S 2.1', provider: 'Poolside', category: 'budget', contextLength: 1048576, orPrice: [0.09, 0.18] },
  { id: 'tencent/hy3', displayName: 'Hy3', provider: 'Tencent', category: 'budget', contextLength: 262144, orPrice: [0.132, 0.528] },
  { id: 'xiaomi/mimo-v2.5-pro', displayName: 'MiMo V2.5 Pro', provider: 'Xiaomi', category: 'budget', contextLength: 1050000, orPrice: [0.435, 0.87] },
  { id: 'stepfun/step-3.7-flash', displayName: 'Step 3.7 Flash', provider: 'StepFun', category: 'budget', contextLength: 262144, orPrice: [0.20, 1.15] },

  // Standard
  { id: 'minimax/minimax-m3', displayName: 'MiniMax M3', provider: 'MiniMax', category: 'standard', contextLength: 1048576, orPrice: [0.30, 1.20] },
  { id: 'openai/gpt-5.6-terra', displayName: 'GPT-5.6 Terra', provider: 'OpenAI', category: 'standard', contextLength: 1050000, orPrice: [1.00, 6.00] },
  { id: 'moonshotai/kimi-k2.6', displayName: 'Kimi K2.6', provider: 'Moonshot', category: 'standard', contextLength: 262144, orPrice: [0.589, 2.48] },
  { id: 'qwen/qwen3.7-plus', displayName: 'Qwen 3.7 Plus', provider: 'Qwen', category: 'standard', contextLength: 1000000, orPrice: [0.32, 1.28] },
  { id: 'mistralai/mistral-large-2512', displayName: 'Mistral Large 3', provider: 'Mistral', category: 'standard', contextLength: 262144, orPrice: [0.50, 1.50] },
  { id: 'google/gemini-3.6-flash', displayName: 'Gemini 3.6 Flash', provider: 'Google', category: 'standard', contextLength: 1048576, orPrice: [1.50, 7.50] },
  { id: 'z-ai/glm-5.2', displayName: 'GLM 5.2', provider: 'Z.ai', category: 'standard', contextLength: 1048576, orPrice: [0.76, 2.42] },
  { id: 'bytedance-seed/seed-2.0-lite', displayName: 'Seed 2.0 Lite', provider: 'ByteDance', category: 'standard', contextLength: 262144, orPrice: [0.25, 2.00] },
  { id: 'amazon/nova-2-lite-v1', displayName: 'Nova 2 Lite', provider: 'Amazon', category: 'standard', contextLength: 1000000, orPrice: [0.30, 2.50] },
  { id: 'nvidia/nemotron-3-ultra-550b-a55b', displayName: 'Nemotron 3 Ultra', provider: 'NVIDIA', category: 'standard', contextLength: 524288, orPrice: [0.60, 3.60] },
  { id: 'thinkingmachines/inkling', displayName: 'Inkling', provider: 'Thinking Machines', category: 'standard', contextLength: 1048576, orPrice: [1.00, 4.05] },

  // Premium
  { id: 'anthropic/claude-haiku-4.5', displayName: 'Claude Haiku 4.5', provider: 'Anthropic', category: 'premium', contextLength: 200000, orPrice: [1.00, 5.00] },
  { id: 'meta/muse-spark-1.1', displayName: 'Muse Spark 1.1', provider: 'Meta', category: 'premium', contextLength: 1048576, orPrice: [1.25, 4.25] },
  { id: 'openai/gpt-5.3-codex', displayName: 'GPT-5.3 Codex', provider: 'OpenAI', category: 'premium', contextLength: 400000, orPrice: [1.75, 14.00] },
  { id: 'moonshotai/kimi-k3', displayName: 'Kimi K3', provider: 'Moonshot', category: 'premium', contextLength: 1048576, orPrice: [3.00, 15.00] },
  { id: 'google/gemini-3.1-pro-preview', displayName: 'Gemini 3.1 Pro', provider: 'Google', category: 'premium', contextLength: 1048576, orPrice: [2.00, 12.00] },
  // Sonnet 5 uses the $3/$15 sticker rate — OpenRouter's $2/$10 introductory
  // pricing ends 2026-08-31, and billing below post-intro cost erases the margin.
  { id: 'anthropic/claude-sonnet-5', displayName: 'Claude Sonnet 5', provider: 'Anthropic', category: 'premium', contextLength: 1000000, orPrice: [3.00, 15.00] },
  { id: 'x-ai/grok-4.5', displayName: 'Grok 4.5', provider: 'SpaceXAI', category: 'premium', contextLength: 500000, orPrice: [2.00, 6.00] },
  { id: 'qwen/qwen3.8-max', displayName: 'Qwen3.8 Max', provider: 'Qwen', category: 'premium', contextLength: 1000000, orPrice: [2.00, 6.00] },

  // Frontier
  { id: 'anthropic/claude-opus-5', displayName: 'Claude Opus 5', provider: 'Anthropic', category: 'frontier', contextLength: 1000000, orPrice: [5.00, 25.00] },
  { id: 'anthropic/claude-fable-5', displayName: 'Claude Fable 5', provider: 'Anthropic', category: 'frontier', contextLength: 1000000, orPrice: [10.00, 50.00] },
  { id: 'openai/gpt-5.6-sol', displayName: 'GPT-5.6 Sol', provider: 'OpenAI', category: 'frontier', contextLength: 1050000, orPrice: [5.00, 30.00] },
  { id: 'sakana/fugu-ultra', displayName: 'Fugu Ultra', provider: 'Sakana', category: 'frontier', contextLength: 1000000, orPrice: [5.00, 30.00] },
  { id: 'openai/gpt-5.5-pro', displayName: 'GPT-5.5 Pro', provider: 'OpenAI', category: 'frontier', contextLength: 1050000, orPrice: [30.00, 180.00] },
];

// Cost math is done in integer micro-dollars (1 dollar = 1e6 micro-dollars)
// per million tokens so it is deterministic: prices are converted to integers
// once, and the only rounding happens at the final cents conversion.
const MICRO_DOLLARS_PER_DOLLAR = 1_000_000;
const MICRO_DOLLARS_PER_CENT = 10_000;
const TOKENS_PER_MILLION = 1_000_000;

/** Convert a dollars-per-million-tokens price to integer micro-dollars per million tokens */
export function toMicroDollarsPerMillion(dollarsPerMillion: number): number {
  return Math.round(dollarsPerMillion * MICRO_DOLLARS_PER_DOLLAR);
}

/** Apply the markup to a price, in integer micro-dollars per million tokens */
function markupMicroDollarsPerMillion(dollarsPerMillion: number): number {
  return Math.round(dollarsPerMillion * MARKUP_MULTIPLIER * MICRO_DOLLARS_PER_DOLLAR);
}

/** All models with computed markup pricing */
export const MODEL_CATALOG: ModelConfig[] = MODEL_DEFS.map((def) => ({
  id: def.id,
  displayName: def.displayName,
  provider: def.provider,
  category: def.category,
  contextLength: def.contextLength,
  openRouterPricing: {
    prompt: def.orPrice[0],
    completion: def.orPrice[1],
  },
  // Display pricing derives from the same integer micro-dollar values used
  // by calculateCostCents, so the displayed price matches what is charged.
  pricing: {
    prompt: markupMicroDollarsPerMillion(def.orPrice[0]) / MICRO_DOLLARS_PER_DOLLAR,
    completion: markupMicroDollarsPerMillion(def.orPrice[1]) / MICRO_DOLLARS_PER_DOLLAR,
  },
}));

/** Lookup a model by ID */
export function getModelConfig(modelId: string): ModelConfig | undefined {
  return MODEL_CATALOG.find((m) => m.id === modelId);
}

/**
 * Calculate cost in cents for a request.
 * Uses OpenRouter pricing (our actual cost) for deduction tracking,
 * and our markup pricing for what we charge the user.
 */
export function calculateCostCents(
  modelId: string,
  promptTokens: number,
  completionTokens: number
): { ourCostCents: number; userCostCents: number } {
  const model = getModelConfig(modelId);
  if (!model) {
    throw new Error(`Unknown model: ${modelId}`);
  }

  // Work in integer micro-dollars per million tokens. The products below
  // stay well within Number.MAX_SAFE_INTEGER (tokens < 1e9, prices < 1e9),
  // so the math is exact until the single rounding at the cents conversion.
  const ourPromptMicro = toMicroDollarsPerMillion(model.openRouterPricing.prompt);
  const ourCompletionMicro = toMicroDollarsPerMillion(model.openRouterPricing.completion);
  const userPromptMicro = markupMicroDollarsPerMillion(model.openRouterPricing.prompt);
  const userCompletionMicro = markupMicroDollarsPerMillion(model.openRouterPricing.completion);

  // tokens * (micro-dollars / 1M tokens) = micro-dollars * 1M; divide once
  // by (1M * micro-dollars-per-cent) and round up at the final step.
  const centsDivisor = TOKENS_PER_MILLION * MICRO_DOLLARS_PER_CENT;
  const ourNumerator =
    promptTokens * ourPromptMicro + completionTokens * ourCompletionMicro;
  const userNumerator =
    promptTokens * userPromptMicro + completionTokens * userCompletionMicro;

  return {
    ourCostCents: Math.ceil(ourNumerator / centsDivisor),
    userCostCents: Math.ceil(userNumerator / centsDivisor),
  };
}
