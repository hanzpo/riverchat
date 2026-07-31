<template>
  <div class="flex flex-col h-full relative" style="background: var(--color-background-secondary)">
    <!-- Text Highlight Popover (render at top level for proper positioning) -->
    <Teleport to="body">
      <TextHighlightPopover
        :visible="highlightPopover.visible"
        :position="highlightPopover.position"
        @branch="handleSetBranchContext"
      />
    </Teleport>

    <!-- Floating Title Label -->
    <div
      class="absolute top-4 left-4 z-10 px-3 py-2 rounded-lg shadow-lg"
      style="background: var(--color-background); border: 1px solid var(--color-border)"
    >
      <h2
        class="text-xs font-semibold"
        style="color: var(--color-text-primary); letter-spacing: -0.01em"
      >
        {{ isNewRootMode ? 'New Thread' : 'Chat' }}
      </h2>
    </div>

    <!-- Floating Message Count -->
    <div
      v-if="!isNewRootMode"
      class="absolute top-4 left-1/2 transform -translate-x-1/2 z-10 px-3 py-2 rounded-lg shadow-lg"
      style="background: var(--color-background); border: 1px solid var(--color-border)"
    >
      <div class="text-[10px] font-medium" style="color: var(--color-text-tertiary)">
        {{ path.length }} message{{ path.length !== 1 ? 's' : '' }}
      </div>
    </div>

    <!-- Floating Action Buttons -->
    <div class="absolute top-4 right-4 z-10 flex gap-2">
      <button
        @click="$emit('pop-out')"
        class="p-2 rounded-lg transition-all shadow-lg hover:opacity-80"
        style="
          background: var(--color-background);
          border: 1px solid var(--color-border);
          color: var(--color-text-secondary);
          cursor: pointer;
        "
        title="Pop out chat"
      >
        <PhArrowSquareOut :size="16" />
      </button>
      <button
        @click="$emit('close')"
        class="p-2 rounded-lg transition-all shadow-lg hover:opacity-80"
        style="
          background: var(--color-background);
          border: 1px solid var(--color-border);
          color: var(--color-text-secondary);
          cursor: pointer;
        "
        title="Close chat"
      >
        <PhX :size="16" />
      </button>
    </div>

    <!-- Messages -->
    <div
      ref="messagesContainer"
      role="log"
      aria-live="polite"
      class="flex-1 overflow-y-auto p-4 pt-16"
    >
      <div
        v-if="path.length === 0 && !isNewRootMode"
        class="flex items-center justify-center h-full px-5 py-10"
      >
        <p class="text-xs text-center font-medium" style="color: var(--color-text-tertiary)">
          Type a message into the chat to create a new thread
        </p>
      </div>

      <div v-if="isNewRootMode" class="flex items-center justify-center h-full px-5 py-10">
        <div class="text-center">
          <div class="text-4xl mb-4">🌊</div>
          <p
            class="text-sm font-semibold mb-2"
            style="color: var(--color-text-primary); letter-spacing: -0.01em"
          >
            Start a New Thread
          </p>
          <p class="text-xs font-medium" style="color: var(--color-text-tertiary)">
            This will create a new root conversation node. Type your message below to begin.
          </p>
        </div>
      </div>

      <div v-else class="flex flex-col gap-3">
        <div
          v-for="message in path"
          :key="message.id"
          class="p-4 cursor-pointer transition-all duration-200 ease-material rounded-lg card-material hover:-translate-x-1"
          :class="{
            'bg-primary/20 border-primary/40': message.type === 'user',
            'bg-secondary/20 border-secondary/40': message.type === 'ai',
            'border-2 border-primary shadow-[0_0_0_3px] shadow-primary/30':
              message.id === selectedNodeId,
          }"
          @click.stop="$emit('node-select', message.id)"
        >
          <!-- Header -->
          <div class="flex justify-between items-center mb-2.5 gap-2">
            <div class="flex items-center gap-2">
              <span
                class="text-[10.5px] font-bold px-2.5 py-1 rounded-md uppercase tracking-wider border flex items-center gap-1.5"
                :class="
                  message.type === 'user'
                    ? 'bg-primary/30 border-primary/50 text-primary'
                    : 'bg-secondary/30 border-secondary/50 text-secondary'
                "
              >
                <PhUser v-if="message.type === 'user'" :size="12" />
                <PhRobot v-else :size="12" />
                <span>{{ message.type === 'user' ? 'YOU' : 'AI' }}</span>
              </span>
              <span
                v-if="getBranchCount(message.id, props.allNodes) > 0"
                class="text-[10px] font-bold px-2 py-0.5 rounded-md bg-accent/30 border border-accent/50 text-accent flex items-center gap-1"
                :title="`${getBranchCount(message.id, props.allNodes)} branch${getBranchCount(message.id, props.allNodes) > 1 ? 'es' : ''} from highlighted text`"
              >
                <PhGitBranch :size="11" />
                <span>{{ getBranchCount(message.id, props.allNodes) }}</span>
              </span>
            </div>
            <span
              v-if="message.model"
              class="text-[11px] font-medium text-white/75 overflow-hidden text-ellipsis whitespace-nowrap"
            >
              {{ message.model.name }}
            </span>
          </div>

          <!-- Branch Metadata (if this message is a branch) -->
          <div
            v-if="message.branchMetadata"
            class="mb-2 p-2.5 bg-accent/10 border border-accent/30 rounded-lg"
          >
            <div class="text-[10px] font-bold text-white/60 uppercase tracking-wider mb-1.5">
              Selected Text
            </div>
            <div
              class="text-[12px] text-white/75 italic font-medium pl-2 border-l-2 border-accent/50"
            >
              "{{ message.branchMetadata.highlightedText }}"
            </div>
          </div>

          <!-- Content -->
          <div
            class="text-white/95 text-[13.5px] leading-relaxed mb-2.5 break-words markdown-content"
            @mouseup.stop="handleTextSelection($event, message.id)"
          >
            <div v-html="renderMarkdown(message.content || '...')"></div>
            <span
              v-if="message.state === 'generating'"
              class="inline-block animate-blink text-info font-bold"
              >▊</span
            >
          </div>

          <!-- Footer -->
          <div class="flex justify-between items-center text-[11px] text-white/70">
            <span class="font-medium">
              {{ formatTime(message.timestamp) }}
            </span>
            <span
              v-if="message.state === 'error'"
              class="error-badge-wrapper relative text-error font-bold flex items-center gap-1"
            >
              <PhWarning :size="12" />
              <span>Error</span>
              <span v-if="message.error" class="error-tooltip">{{ message.error }}</span>
            </span>
          </div>
        </div>

        <!-- Multi-model prompt: shown once after first AI response with single model (3B) -->
        <div
          v-if="showMultiModelPrompt"
          class="p-3 rounded-lg text-center animate-fade-in"
          style="background: rgba(13, 153, 255, 0.08); border: 1px solid rgba(13, 153, 255, 0.2)"
        >
          <p class="text-xs font-medium mb-2" style="color: var(--color-primary)">
            Want to see how another AI answers?
          </p>
          <button
            @click="
              addModelSlot();
              multiModelPromptDismissed = true;
              chatAnalytics.capture('multi_model_prompt_clicked');
            "
            class="btn-material text-xs"
            style="
              padding: 5px 12px;
              font-weight: 600;
              background: var(--color-primary-muted);
              color: var(--color-primary);
              border-color: var(--color-primary);
            "
          >
            + Add a second model
          </button>
          <button
            @click="multiModelPromptDismissed = true"
            class="block mx-auto mt-1 text-[10px] bg-transparent border-none cursor-pointer"
            style="color: var(--color-text-tertiary)"
          >
            Dismiss
          </button>
        </div>

        <!-- Post-response upgrade nudge: shown on free tier (2D) -->
        <div
          v-if="showUpgradeNudge"
          class="p-3 rounded-lg animate-fade-in"
          style="background: rgba(162, 89, 255, 0.08); border: 1px solid rgba(162, 89, 255, 0.2)"
        >
          <p class="text-xs font-medium mb-1" style="color: var(--color-accent)">
            This response used {{ lastAIModelName }}.
          </p>
          <p class="text-[11px] mb-2" style="color: var(--color-text-secondary)">
            Try premium models like Claude or GPT-5 with Pro.
          </p>
          <div class="flex items-center gap-2">
            <button
              @click="
                chatAnalytics.capture('upgrade_prompt_clicked', {
                  source: 'post_response',
                  target_tier: 'pro',
                });
                subscription.upgradeToTier('pro');
              "
              class="btn-material text-xs"
              style="
                padding: 5px 12px;
                font-weight: 600;
                background: rgba(162, 89, 255, 0.15);
                color: var(--color-accent);
                border-color: rgba(162, 89, 255, 0.3);
              "
            >
              Upgrade to Pro
            </button>
            <button
              @click="upgradeNudgeDismissed = true"
              class="text-[10px] bg-transparent border-none cursor-pointer"
              style="color: var(--color-text-tertiary)"
            >
              Dismiss
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Web Search Upgrade Popover -->
    <UpgradePopover
      :visible="webSearchUpgrade.visible"
      :position="webSearchUpgrade.position"
      title="Web search"
      description="Search the web during AI responses for up-to-date information."
      target-tier="pro"
      @close="webSearchUpgrade.visible = false"
      @upgrade="
        (tier: 'pro' | 'max') => {
          webSearchUpgrade.visible = false;
          chatAnalytics.capture('upgrade_prompt_clicked', {
            source: 'web_search',
            target_tier: tier,
          });
          subscription.upgradeToTier(tier);
        }
      "
    />

    <!-- Input Area -->
    <div class="p-4 card-material">
      <ChatInputArea
        ref="inputArea"
        v-model="inputText"
        compact
        :resend-mode="resendMode"
        :selected-user-message="selectedUserMessage"
        :selected-model-ids="selectedModelIds"
        :available-models="subscription.availableModels.value"
        :max-models-per-prompt="subscription.maxModelsPerPrompt.value"
        :web-search-enabled="webSearchEnabled"
        :can-enable-web-search="canEnableWebSearch"
        :can-send="canSend"
        :is-sending="!!isSending"
        :branch-context-text="branchContext.text"
        @web-search-click="handleWebSearchClick"
        @model-select="handleModelSelect"
        @add-model="addModelSlot"
        @remove-model="removeModelSlot"
        @send="handleSend"
        @resend="handleResend"
        @keydown="handleKeydown"
        @textarea-input="autoResizeTextarea"
        @clear-branch-context="clearBranchContext"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, watchEffect, nextTick } from 'vue';
import type { MessageNode, Settings, LLMModel } from '../types';
import {
  PhUser,
  PhRobot,
  PhGitBranch,
  PhWarning,
  PhArrowSquareOut,
  PhX,
} from '@phosphor-icons/vue';
import { renderMarkdown, formatTime, getBranchCount } from '../utils/chat';
import TextHighlightPopover from './TextHighlightPopover.vue';
import ChatInputArea from './ChatInputArea.vue';
import UpgradePopover from './UpgradePopover.vue';
import { useChatPanel, type ChatPanelUser } from '../composables/useChatPanel';
import { usePostHog } from '../composables/usePostHog';

const chatAnalytics = usePostHog();

interface Props {
  path: MessageNode[];
  selectedNodeId: string | null;
  isNewRootMode?: boolean;
  allNodes?: Record<string, MessageNode>;
  settings?: Settings;
  isSending?: boolean;
  currentUser?: ChatPanelUser | null;
}

interface Emits {
  (e: 'send', content: string, models: LLMModel[], webSearchEnabled: boolean): void;
  (e: 'node-select', nodeId: string): void;
  (
    e: 'branch-from-text',
    nodeId: string,
    highlightedText: string,
    elaborationPrompt: string,
    models: LLMModel[],
    webSearchEnabled: boolean
  ): void;
  (e: 'chat-model-changed', modelIds: string[]): void;
  (e: 'close'): void;
  (e: 'pop-out'): void;
  (e: 'resend', userNodeId: string, models: LLMModel[], webSearchEnabled: boolean): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

// Dismissal flags persisted to localStorage so they survive remounts
const MULTI_MODEL_PROMPT_DISMISSED_KEY = 'riverchat:multiModelPromptDismissed';
const UPGRADE_NUDGE_DISMISSED_KEY = 'riverchat:upgradeNudgeDismissed';

// Multi-model prompt: show once after first AI response with single model
const multiModelPromptDismissed = ref(
  localStorage.getItem(MULTI_MODEL_PROMPT_DISMISSED_KEY) === 'true'
);
watch(multiModelPromptDismissed, (dismissed) => {
  if (dismissed) localStorage.setItem(MULTI_MODEL_PROMPT_DISMISSED_KEY, 'true');
});
const showMultiModelPrompt = computed(() => {
  if (multiModelPromptDismissed.value) return false;
  if (props.settings?.hasSeenMultiModelPrompt) return false;
  // Show after first AI response when user has only 1 model selected
  const hasAIResponse = props.path.some((m) => m.type === 'ai' && m.state === 'complete');
  return hasAIResponse && selectedModelIds.value.length === 1;
});

// Post-response upgrade nudge (2D): show on free tier after AI responses
const upgradeNudgeDismissed = ref(localStorage.getItem(UPGRADE_NUDGE_DISMISSED_KEY) === 'true');
watch(upgradeNudgeDismissed, (dismissed) => {
  if (dismissed) localStorage.setItem(UPGRADE_NUDGE_DISMISSED_KEY, 'true');
});
const showUpgradeNudge = computed(() => {
  if (upgradeNudgeDismissed.value) return false;
  if (subscription.tier.value !== 'free') return false;
  // Show after the 2nd completed AI response
  const completedAI = props.path.filter((m) => m.type === 'ai' && m.state === 'complete');
  return completedAI.length >= 2;
});
const lastAIModelName = computed(() => {
  const aiMessages = props.path.filter((m) => m.type === 'ai' && m.state === 'complete');
  return aiMessages.length > 0
    ? (aiMessages[aiMessages.length - 1]?.model?.name ?? 'this model')
    : 'this model';
});

const {
  inputText,
  selectedModelIds,
  messagesContainer,
  textareaRef,
  webSearchEnabled,
  webSearchUpgrade,
  highlightPopover,
  branchContext,
  subscription,
  canEnableWebSearch,
  canSend,
  selectedUserMessage,
  handleWebSearchClick,
  handleModelSelect,
  addModelSlot,
  removeModelSlot,
  autoResizeTextarea,
  handleKeydown,
  handleSend,
  handleResend,
  handleTextSelection,
  handleSetBranchContext,
  clearBranchContext,
} = useChatPanel(
  () => props,
  {
    send: (...args) => emit('send', ...args),
    'branch-from-text': (...args) => emit('branch-from-text', ...args),
    'chat-model-changed': (...args) => emit('chat-model-changed', ...args),
    resend: (...args) => emit('resend', ...args),
  },
  { textareaMinHeight: '40px' }
);

// Whether to show the resend UI instead of the normal input
const resendMode = computed(
  () =>
    !canSend.value && !props.isNewRootMode && props.path.length > 0 && !!selectedUserMessage.value
);

// Wire the input area's textarea element into the chat panel composable
const inputArea = ref<InstanceType<typeof ChatInputArea> | null>(null);
watchEffect(() => {
  textareaRef.value = inputArea.value?.textarea ?? null;
});

// Consolidated autofocus logic - focus textarea when it becomes available
watch(
  [() => props.isNewRootMode, () => props.selectedNodeId, () => props.path, canSend],
  async () => {
    const shouldFocus =
      props.isNewRootMode || (canSend.value && !props.isNewRootMode && props.path.length > 0);
    if (shouldFocus) {
      await nextTick();
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          textareaRef.value?.focus();
        });
      });
    }
  },
  { immediate: true, flush: 'post' }
);
</script>

<style scoped>
@import './chat-panel.css';
</style>
