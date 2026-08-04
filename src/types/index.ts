// Core types for RiverChat

export type SubscriptionTier = 'free' | 'pro' | 'max';
export type ModelCategory = 'budget' | 'standard' | 'premium' | 'frontier';

export interface LLMModel {
  id: string; // OpenRouter model ID (e.g., "openai/gpt-5.4")
  name: string; // Display name
  description?: string;
  contextLength: number;
  pricing: {
    prompt: number; // Our price per million prompt tokens (with 1.5x markup)
    completion: number; // Our price per million completion tokens (with 1.5x markup)
  };
  category: ModelCategory;
  provider: string; // e.g., "OpenAI", "Anthropic", "Google"
  accessible?: boolean; // Whether user's tier can use this model
}

export interface UserBalance {
  subscriptionCredits: number; // cents
  prepaidCredits: number; // cents
  total: number; // cents
  tier: SubscriptionTier;
  currentPeriodEnd: number | null; // epoch ms
}

export interface UsageMetadata {
  cost: number; // cents
  promptTokens: number;
  completionTokens: number;
  balanceAfter?: {
    subscriptionCredits: number;
    prepaidCredits: number;
    total: number;
  };
}

export interface Settings {
  lastUsedModelId: string | null; // Model ID of last used model
  selectedModelIds: string[]; // Currently selected model IDs for chat
  lastModelRefresh?: number; // Timestamp of last model list refresh
  lastVisitedRiverId?: string | null; // ID of the last visited river
  // Onboarding tour state
  dismissedTips?: string[]; // IDs of dismissed onboarding tooltips
  messageCount?: number; // Total messages sent (for progressive disclosure)
  sessionCount?: number; // Number of app sessions (for progressive disclosure)
  firstVisitTimestamp?: number; // Epoch ms of first visit (for time-based auth prompts)
  hasSeenMultiModelPrompt?: boolean; // Whether user has seen the multi-model CTA
}

export type NodeType = 'user' | 'ai';

export type NodeState = 'complete' | 'generating' | 'error';

export interface MessageNode {
  id: string;
  type: NodeType;
  content: string;
  timestamp: number;
  parentId: string | null;
  state: NodeState;
  model?: LLMModel; // Only for AI nodes
  error?: string; // Only for error state
  position?: { x: number; y: number }; // Node position in the canvas
  branchMetadata?: BranchMetadata; // Metadata for branches created from text selection
}

export interface BranchMetadata {
  sourceNodeId: string; // The node this was branched from
  highlightedText: string; // The text that was highlighted
  elaborationPrompt?: string; // The prompt used for elaboration
}

export interface River {
  id: string;
  name: string;
  createdAt: string;
  lastModified: string;
  nodes: Record<string, MessageNode>;
  rootNodeId: string | null;
}

/**
 * Lightweight river list entry stored in the rivers-metadata cache.
 * Same as River but without the (potentially large) node data — it carries a
 * nodeCount instead.
 */
export interface RiverMetadata extends Omit<River, 'nodes'> {
  nodeCount: number;
}

export interface RiverChatData {
  rivers: River[];
  settings: Settings;
  activeRiverId: string | null;
}

export interface ContextMenuItem {
  label: string;
  action: string;
  condition?: (node: MessageNode) => boolean;
}

// Vue Flow specific types
export interface VueFlowNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: MessageNode;
}

export interface VueFlowEdge {
  id: string;
  source: string;
  target: string;
  animated?: boolean;
  style?: Record<string, string>;
}

/**
 * Default model ID for new users: a cheap, fast budget model that is
 * accessible on the free tier. Can be overridden via the
 * VITE_DEFAULT_MODEL_ID env var; the value must be an ID present in the
 * model catalog (src/config/models.ts).
 */
export const DEFAULT_MODEL_ID: string =
  import.meta.env.VITE_DEFAULT_MODEL_ID || 'deepseek/deepseek-v4-flash-0731';

/** Resolve model IDs to full LLMModel objects */
export function resolveModelIds(ids: string[], availableModels: LLMModel[]): LLMModel[] {
  const modelMap = new Map(availableModels.map(m => [m.id, m]));
  return ids
    .map(id => modelMap.get(id))
    .filter((m): m is LLMModel => m !== undefined);
}

/** Category display order */
export const CATEGORY_ORDER: ModelCategory[] = ['budget', 'standard', 'premium', 'frontier'];

/** Human-readable category labels */
export const CATEGORY_LABELS: Record<ModelCategory, string> = {
  budget: 'Budget',
  standard: 'Standard',
  premium: 'Premium',
  frontier: 'Frontier',
};

/** Minimum tier required for each category */
export const CATEGORY_MIN_TIER: Record<ModelCategory, SubscriptionTier> = {
  budget: 'free',
  standard: 'pro',
  premium: 'pro',
  frontier: 'max',
};
