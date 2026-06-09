<template>
  <div
    v-if="isOpen"
    ref="modalEl"
    tabindex="-1"
    role="dialog"
    aria-modal="true"
    aria-labelledby="chat-modal-title"
    class="fixed inset-0 flex flex-col z-[200]"
    style="background: var(--color-background);"
  >
    <!-- Floating Back Button -->
    <button
      @click="emit('close')"
      class="fixed top-4 left-4 z-10 flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg hover:opacity-80 transition-all shadow-lg"
      style="background: var(--color-background-secondary); color: var(--color-text-primary); border: 1px solid var(--color-border);"
      title="Back"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M19 12H5M12 19l-7-7 7-7"/>
      </svg>
      Back
    </button>

    <!-- Floating Title Label -->
    <div class="fixed top-4 left-1/2 transform -translate-x-1/2 z-10 px-4 py-2 rounded-lg shadow-lg" style="background: var(--color-background-secondary); border: 1px solid var(--color-border);">
      <h1 id="chat-modal-title" class="text-sm font-semibold" style="color: var(--color-text-primary); letter-spacing: -0.01em;">
        {{ isNewRootMode ? 'New Conversation' : 'Chat History' }}
      </h1>
    </div>

    <!-- Floating Message Count (only show if not new root mode) -->
    <div v-if="!isNewRootMode" class="fixed top-4 right-4 z-10 px-3 py-2 rounded-lg shadow-lg" style="background: var(--color-background-secondary); border: 1px solid var(--color-border);">
      <div class="text-xs font-medium" style="color: var(--color-text-tertiary);">
        {{ path.length }} message{{ path.length !== 1 ? 's' : '' }}
      </div>
    </div>

    <!-- Messages -->
    <div ref="messagesContainer" role="log" aria-live="polite" class="flex-1 overflow-y-auto pt-16">
      <!-- Empty state -->
      <div v-if="path.length === 0 && !isNewRootMode" class="flex items-center justify-center h-full px-5 py-10">
        <p class="text-sm text-center font-medium" style="color: var(--color-text-tertiary);">
          Type a message into the chat to create a new thread
        </p>
      </div>

      <!-- New root mode welcome -->
      <div v-if="isNewRootMode" class="flex items-center justify-center h-full px-5 py-10">
        <div class="text-center">
          <div class="text-5xl mb-4">🌊</div>
          <p class="text-xl font-semibold mb-3" style="color: var(--color-text-primary); letter-spacing: -0.01em;">
            Start a New Thread
          </p>
          <p class="text-sm font-medium max-w-md" style="color: var(--color-text-tertiary);">
            This will create a new root conversation node. Type your message below to begin.
          </p>
        </div>
      </div>

      <!-- Messages container centered like ChatGPT/Claude -->
      <div v-else class="max-w-3xl mx-auto py-6 px-4">
        <div class="flex flex-col gap-6">
          <div
            v-for="message in path"
            :key="message.id"
            class="cursor-pointer transition-all duration-200 ease-material"
            @click.stop="$emit('node-select', message.id)"
          >
            <!-- Message bubble -->
            <div
              class="p-5 rounded-lg transition-all"
              :class="{
                'hover:shadow-md': true,
                'border-2 border-primary shadow-lg shadow-primary/20': message.id === selectedNodeId,
              }"
              :style="message.type === 'user'
                ? 'background: var(--color-background-secondary); border: 1px solid var(--color-border);'
                : 'background: var(--color-background-secondary); border: 1px solid var(--color-border);'"
            >
              <!-- Header -->
              <div class="flex justify-between items-center mb-3 gap-2">
                <div class="flex items-center gap-2.5">
                  <span
                    class="text-xs font-bold px-2.5 py-1 rounded-md uppercase tracking-wider border flex items-center gap-1.5"
                    :class="message.type === 'user' ? 'bg-primary/30 border-primary/50 text-primary' : 'bg-secondary/30 border-secondary/50 text-secondary'"
                  >
                    <User v-if="message.type === 'user'" :size="13" />
                    <Bot v-else :size="13" />
                    <span>{{ message.type === 'user' ? 'YOU' : 'AI' }}</span>
                  </span>
                  <span
                    v-if="getBranchCount(message.id, props.allNodes) > 0"
                    class="text-[10px] font-bold px-2 py-0.5 rounded-md bg-accent/30 border border-accent/50 text-accent flex items-center gap-1"
                    :title="`${getBranchCount(message.id, props.allNodes)} branch${getBranchCount(message.id, props.allNodes) > 1 ? 'es' : ''} from highlighted text`"
                  >
                    <GitBranch :size="11" />
                    <span>{{ getBranchCount(message.id, props.allNodes) }}</span>
                  </span>
                </div>
                <span v-if="message.model" class="text-xs font-medium overflow-hidden text-ellipsis whitespace-nowrap" style="color: var(--color-text-tertiary);">
                  {{ message.model.name }}
                </span>
              </div>

              <!-- Branch Metadata (if this message is a branch) -->
              <div v-if="message.branchMetadata" class="mb-2 p-3 bg-accent/10 border border-accent/30 rounded-lg">
                <div class="text-[10px] font-bold uppercase tracking-wider mb-1.5" style="color: var(--color-text-tertiary);">Selected Text</div>
                <div class="text-xs italic font-medium pl-2.5 border-l-2 border-accent/50" style="color: var(--color-text-secondary);">
                  "{{ message.branchMetadata.highlightedText }}"
                </div>
              </div>

              <!-- Content -->
              <div
                class="text-sm leading-relaxed mb-3 break-words markdown-content"
                style="color: var(--color-text-primary);"
                @mouseup.stop="handleTextSelection($event, message.id)"
              >
                <div v-html="renderMarkdown(message.content || '...')"></div>
                <span v-if="message.state === 'generating'" class="inline-block animate-blink text-info font-bold">▊</span>
              </div>

              <!-- Footer -->
              <div class="flex justify-between items-center text-xs" style="color: var(--color-text-tertiary);">
                <span class="font-medium">
                  {{ formatTime(message.timestamp) }}
                </span>
                <span v-if="message.state === 'error'" class="error-badge-wrapper relative text-error font-bold flex items-center gap-1">
                  <AlertTriangle :size="12" />
                  <span>Error</span>
                  <span v-if="message.error" class="error-tooltip">{{ message.error }}</span>
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Input Area (centered like ChatGPT/Claude) -->
    <div style="background: var(--color-background);">
      <div class="max-w-3xl mx-auto px-4 py-4">
        <ChatInputArea
          ref="inputArea"
          v-model="inputText"
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

    <Teleport to="body">
      <TextHighlightPopover
        :visible="highlightPopover.visible"
        :position="highlightPopover.position"
        @branch="handleSetBranchContext"
      />
    </Teleport>

    <!-- Web Search Upgrade Popover -->
    <UpgradePopover
      :visible="webSearchUpgrade.visible"
      :position="webSearchUpgrade.position"
      title="Web search"
      description="Search the web during AI responses for up-to-date information."
      target-tier="pro"
      @close="webSearchUpgrade.visible = false"
      @upgrade="(tier: 'pro' | 'max') => { webSearchUpgrade.visible = false; chatModalAnalytics.capture('upgrade_prompt_clicked', { source: 'web_search', target_tier: tier }); subscription.upgradeToTier(tier); }"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, watchEffect, nextTick } from 'vue';
import type { MessageNode, Settings, LLMModel } from '../types';
import { User, Bot, GitBranch, AlertTriangle } from 'lucide-vue-next';
import { renderMarkdown, formatTime, getBranchCount } from '../utils/chat';
import TextHighlightPopover from './TextHighlightPopover.vue';
import ChatInputArea from './ChatInputArea.vue';
import UpgradePopover from './UpgradePopover.vue';
import { useChatPanel, type ChatPanelUser } from '../composables/useChatPanel';
import { useModalA11y } from '../composables/useModalA11y';
import { usePostHog } from '../composables/usePostHog';

const chatModalAnalytics = usePostHog();

interface Props {
  isOpen: boolean;
  path: MessageNode[];
  selectedNodeId: string | null;
  isNewRootMode?: boolean;
  allNodes?: Record<string, MessageNode>;
  settings?: Settings;
  isSending?: boolean;
  currentUser?: ChatPanelUser | null;
}

interface Emits {
  (e: 'close'): void;
  (e: 'send', content: string, models: LLMModel[], webSearchEnabled: boolean): void;
  (e: 'node-select', nodeId: string): void;
  (e: 'branch-from-text', nodeId: string, highlightedText: string, elaborationPrompt: string, models: LLMModel[], webSearchEnabled: boolean): void;
  (e: 'chat-model-changed', modelIds: string[]): void;
  (e: 'resend', userNodeId: string, models: LLMModel[], webSearchEnabled: boolean): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const modalEl = ref<HTMLElement | null>(null);
useModalA11y(() => props.isOpen, modalEl);

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
  { textareaMinHeight: '44px' }
);

// Whether to show the resend UI instead of the normal input
const resendMode = computed(() =>
  !canSend.value && !props.isNewRootMode && props.path.length > 0 && !!selectedUserMessage.value
);

// Wire the input area's textarea element into the chat panel composable
const inputArea = ref<InstanceType<typeof ChatInputArea> | null>(null);
watchEffect(() => {
  textareaRef.value = inputArea.value?.textarea ?? null;
});

// Autofocus textarea and scroll to bottom when modal opens
watch(
  () => props.isOpen,
  async (isOpen) => {
    if (isOpen) {
      await nextTick();
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (messagesContainer.value) {
            messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight;
          }
          textareaRef.value?.focus();
        });
      });
    }
  },
  { immediate: true }
);
</script>

<style scoped>
@import './chat-panel.css';
</style>
