import { ref, type Ref, type ComputedRef } from 'vue';
import type { River, MessageNode, Settings, LLMModel } from '../types';
import { resolveModelIds, DEFAULT_MODEL_ID } from '../types';
import type { usePostHog } from './usePostHog';
import type { ShowToast } from './useToast';

export interface PendingMessage {
  content: string;
  models: LLMModel[];
  webSearchEnabled: boolean;
}

export interface MessagingDeps {
  currentRiver: Ref<River | null>;
  currentPath: ComputedRef<MessageNode[]>;
  isNewRootMode: Ref<boolean>;
  settings: Ref<Settings>;
  availableModels: Ref<LLMModel[]>;
  createUserNode: (content: string, parentId: string | null) => MessageNode;
  generateAIResponse: (
    parentNodeId: string,
    model: LLMModel,
    webSearchEnabled?: boolean
  ) => Promise<void>;
  branchFromText: (
    sourceNodeId: string,
    highlightedText: string,
    userPrompt: string,
    model: LLMModel,
    webSearchEnabled?: boolean
  ) => Promise<void>;
  selectNode: (nodeId: string | null) => void;
  analytics: ReturnType<typeof usePostHog>;
  showToast: ShowToast;
  /** Called when a message is sent with no active river (App opens the create-river modal). */
  onRequireRiver: () => void;
  /** Milestone hook run after each user message (onboarding tour + auth prompts). */
  onMessageSent: () => void;
  /** Milestone hook run after AI responses settle (onboarding tour). */
  onResponsesSettled: () => void;
}

/**
 * Message sending, resending, text-branching, and regeneration
 * (extracted from App.vue).
 */
export function useMessaging(deps: MessagingDeps) {
  const isSendingMessage = ref(false);

  // A message queued while no river exists yet; sent once the user creates
  // one via the create-river modal.
  const pendingMessage = ref<PendingMessage | null>(null);

  // Surface per-model generation failures without letting one model's
  // failure interrupt its siblings (used with Promise.allSettled results).
  function notifyGenerationFailures(
    results: PromiseSettledResult<void>[],
    fallbackMessage: string
  ) {
    const failures = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
    if (failures.length > 0) {
      const reason = failures[0]!.reason;
      deps.showToast(reason instanceof Error ? reason.message : fallbackMessage, 'error');
    }
  }

  async function sendMessage(content: string, models: LLMModel[], webSearchEnabled: boolean) {
    if (!deps.currentRiver.value) {
      pendingMessage.value = { content, models, webSearchEnabled };
      deps.onRequireRiver();
      return;
    }

    isSendingMessage.value = true;
    try {
      // If in new root mode, create a new root node (parentId = null)
      const path = deps.currentPath.value;
      const parentId = deps.isNewRootMode.value
        ? null
        : path.length > 0
          ? path[path.length - 1]?.id || null
          : null;

      // Exit new root mode
      if (deps.isNewRootMode.value) {
        deps.isNewRootMode.value = false;
      }

      // Create user node
      const userNode = deps.createUserNode(content, parentId);
      deps.selectNode(userNode.id);

      // Funnel tracking
      deps.analytics.capture('message_sent', {
        model_count: models.length,
        is_root: parentId === null,
        web_search: webSearchEnabled,
      });

      // Onboarding tour milestones + auth prompt checks
      deps.onMessageSent();

      // Generate AI responses for all selected models in parallel.
      // Errors are isolated per model so one failure doesn't affect siblings;
      // streaming errors already surface on the node itself, and pre-stream
      // rejections are surfaced via toast.
      const results = await Promise.allSettled(
        models.map((model) => deps.generateAIResponse(userNode.id, model, webSearchEnabled))
      );
      notifyGenerationFailures(results, 'Failed to send message');

      // Onboarding tour: record AI response milestone
      deps.onResponsesSettled();
    } catch (_error) {
      deps.showToast(_error instanceof Error ? _error.message : 'Failed to send message', 'error');
    } finally {
      isSendingMessage.value = false;
    }
  }

  async function resend(userNodeId: string, models: LLMModel[], webSearchEnabled: boolean) {
    if (!deps.currentRiver.value) return;

    const userNode = deps.currentRiver.value.nodes[userNodeId];
    if (!userNode || userNode.type !== 'user') {
      deps.showToast('Invalid user message', 'error');
      return;
    }

    isSendingMessage.value = true;
    try {
      // Generate AI responses directly from the existing user node (no new user node created)
      const results = await Promise.allSettled(
        models.map((model) => deps.generateAIResponse(userNodeId, model, webSearchEnabled))
      );
      notifyGenerationFailures(results, 'Failed to resend message');
    } catch (_error) {
      deps.showToast(
        _error instanceof Error ? _error.message : 'Failed to resend message',
        'error'
      );
    } finally {
      isSendingMessage.value = false;
    }
  }

  async function branchFromSelection(
    nodeId: string,
    highlightedText: string,
    userPrompt: string,
    models: LLMModel[],
    webSearchEnabled: boolean
  ) {
    if (!deps.currentRiver.value) return;

    isSendingMessage.value = true;
    try {
      deps.showToast(
        `Creating ${models.length} branch${models.length > 1 ? 'es' : ''} with selected context...`,
        'info'
      );
      // Create branches for all selected models in parallel (errors isolated per model)
      const results = await Promise.allSettled(
        models.map((model) =>
          deps.branchFromText(nodeId, highlightedText, userPrompt, model, webSearchEnabled)
        )
      );
      notifyGenerationFailures(results, 'Failed to create branch');
    } catch (_error) {
      deps.showToast(_error instanceof Error ? _error.message : 'Failed to create branch', 'error');
    } finally {
      isSendingMessage.value = false;
    }
  }

  async function regenerate(parentNodeId: string) {
    if (!deps.currentRiver.value) return;

    const parentNode = deps.currentRiver.value.nodes[parentNodeId];
    if (!parentNode) return;

    // Resolve last used model ID to full model object
    const modelId = deps.settings.value.lastUsedModelId || DEFAULT_MODEL_ID;
    const resolved = resolveModelIds([modelId], deps.availableModels.value);
    const model = resolved[0] || deps.availableModels.value[0];
    if (!model) {
      deps.showToast('No models available', 'error');
      return;
    }

    try {
      deps.showToast('Generating new response...', 'info');
      await deps.generateAIResponse(parentNodeId, model, false);
    } catch (_error) {
      deps.showToast('Failed to regenerate response', 'error');
    }
  }

  /** Return the queued pending message (if any) and clear it. */
  function consumePendingMessage(): PendingMessage | null {
    const saved = pendingMessage.value;
    pendingMessage.value = null;
    return saved;
  }

  function clearPendingMessage() {
    pendingMessage.value = null;
  }

  return {
    isSendingMessage,
    pendingMessage,
    sendMessage,
    resend,
    branchFromSelection,
    regenerate,
    consumePendingMessage,
    clearPendingMessage,
  };
}
