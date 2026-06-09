<template>
  <!-- Resend interface when a user node is selected -->
  <div v-if="resendMode && selectedUserMessage" :class="compact ? 'py-3' : 'py-4'">
    <!-- Model Selection (Dropdowns) -->
    <div class="mb-2 flex items-center gap-1.5 flex-wrap">
      <button
        @click="$emit('web-search-click', $event)"
        class="flex items-center justify-center rounded-lg transition-all"
        :class="{ 'hover:opacity-80': canEnableWebSearch, 'cursor-pointer opacity-50 hover:opacity-70': !canEnableWebSearch }"
        :style="`width: ${compact ? 18 : 20}px; height: ${compact ? 18 : 20}px; background: transparent; cursor: pointer;`"
        :title="canEnableWebSearch ? (webSearchEnabled ? 'Web search enabled' : 'Web search disabled') : 'Upgrade to use web search'"
      >
        <svg :width="compact ? 14 : 16" :height="compact ? 14 : 16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" :style="webSearchEnabled && canEnableWebSearch ? 'color: var(--color-primary);' : 'color: var(--color-text-tertiary);'">
          <circle cx="12" cy="12" r="10"/>
          <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
        </svg>
      </button>
      <div v-for="(modelId, index) in selectedModelIds" :key="index" class="flex items-center gap-0.5">
        <ModelDropdown
          :selected-model-id="modelId"
          :available-models="availableModels"
          @select="(id: string) => $emit('model-select', index, id)"
        />
        <button
          v-if="selectedModelIds.length > 1"
          @click="$emit('remove-model', index)"
          class="p-0.5 rounded hover:bg-white/10 transition-colors"
          style="color: var(--color-text-tertiary);"
          title="Remove model"
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </button>
      </div>
      <button
        v-if="selectedModelIds.length < maxModelsPerPrompt"
        @click="$emit('add-model')"
        class="flex items-center justify-center w-6 h-6 rounded-md hover:bg-white/10 transition-colors"
        style="color: var(--color-text-tertiary); border: 1px dashed var(--color-border);"
        title="Add model"
      >
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14M5 12h14"/></svg>
      </button>
    </div>

    <!-- User message content (greyed out) -->
    <div class="rounded-lg" :class="compact ? 'mb-2 p-3' : 'mb-3 p-4'" style="background: var(--color-background-secondary); border: 1px solid var(--color-border);">
      <div class="leading-relaxed break-words whitespace-pre-wrap" :class="compact ? 'text-[13.5px]' : 'text-sm'" style="color: var(--color-text-tertiary); opacity: 0.6;">
        {{ selectedUserMessage.content }}
      </div>
    </div>

    <!-- Resend button -->
    <div class="flex justify-end">
      <button
        @click="$emit('resend')"
        :disabled="selectedModelIds.length === 0 || isSending"
        class="flex items-center gap-2 rounded-lg transition-all font-medium"
        :class="compact ? 'px-3 py-1.5 text-xs' : 'px-4 py-2 text-sm'"
        :style="(selectedModelIds.length === 0 || isSending)
          ? 'background: var(--color-border); color: var(--color-text-tertiary); cursor: not-allowed;'
          : 'background: var(--color-primary); color: white; cursor: pointer;'"
        :title="isSending ? 'Sending...' : (selectedModelIds.length > 1 ? `Resend to ${selectedModelIds.length} models` : 'Resend message')"
      >
        <div v-if="isSending" class="loading-spinner-small"></div>
        <svg v-else :width="compact ? 14 : 16" :height="compact ? 14 : 16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/>
          <path d="M21 3v5h-5"/>
          <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/>
          <path d="M3 21v-5h5"/>
        </svg>
        <span>Resend</span>
      </button>
    </div>
  </div>

  <!-- Normal input area when AI node is selected or in new root mode -->
  <div v-else>
    <!-- Branch Context Display (like Cursor) -->
    <div v-if="branchContextText" class="bg-accent/10 border border-accent/30 rounded-lg animate-slide-in" :class="compact ? 'mb-3 p-3' : 'mb-4 p-3.5'">
      <div class="flex items-start justify-between gap-2 mb-2">
        <div class="flex items-center gap-2">
          <GitBranch :size="compact ? 14 : 16" class="text-accent" />
          <span class="font-bold text-accent uppercase tracking-wider" :class="compact ? 'text-[11px]' : 'text-xs'">Selected Context</span>
        </div>
        <button
          @click="$emit('clear-branch-context')"
          class="transition-colors text-xs font-bold px-2 py-0.5 hover:bg-white/10 rounded flex items-center"
          style="color: var(--color-text-tertiary);"
          title="Clear context"
        >
          <X :size="compact ? 14 : 16" />
        </button>
      </div>
      <div class="italic pl-3 border-l-2 border-accent/50 max-h-24 overflow-y-auto" :class="compact ? 'text-[12px]' : 'text-sm'" style="color: var(--color-text-secondary);">
        "{{ branchContextText }}"
      </div>
    </div>

    <!-- Model Selection (Dropdowns) -->
    <div class="mb-2 flex items-center gap-1.5 flex-wrap">
      <button
        @click="$emit('web-search-click', $event)"
        class="flex items-center justify-center rounded-lg transition-all"
        :class="{ 'hover:opacity-80': canEnableWebSearch, 'cursor-pointer opacity-50 hover:opacity-70': !canEnableWebSearch }"
        :style="`width: ${compact ? 18 : 20}px; height: ${compact ? 18 : 20}px; background: transparent; cursor: pointer;`"
        :title="canEnableWebSearch ? (webSearchEnabled ? 'Web search enabled' : 'Web search disabled') : 'Upgrade to use web search'"
      >
        <svg :width="compact ? 14 : 16" :height="compact ? 14 : 16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" :style="webSearchEnabled && canEnableWebSearch ? 'color: var(--color-primary);' : 'color: var(--color-text-tertiary);'">
          <circle cx="12" cy="12" r="10"/>
          <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
        </svg>
      </button>
      <div v-for="(modelId, index) in selectedModelIds" :key="index" class="flex items-center gap-0.5">
        <ModelDropdown
          :selected-model-id="modelId"
          :available-models="availableModels"
          @select="(id: string) => $emit('model-select', index, id)"
        />
        <button
          v-if="selectedModelIds.length > 1"
          @click="$emit('remove-model', index)"
          class="p-0.5 rounded hover:bg-white/10 transition-colors"
          style="color: var(--color-text-tertiary);"
          title="Remove model"
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </button>
      </div>
      <button
        v-if="selectedModelIds.length < maxModelsPerPrompt"
        @click="$emit('add-model')"
        class="flex items-center justify-center w-6 h-6 rounded-md hover:bg-white/10 transition-colors"
        style="color: var(--color-text-tertiary); border: 1px dashed var(--color-border);"
        title="Add model"
      >
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14M5 12h14"/></svg>
      </button>
    </div>

    <div class="flex items-end" :class="compact ? 'gap-2' : 'gap-3'">
      <textarea
        ref="textarea"
        v-model="inputText"
        data-chat-input
        class="textarea-material flex-1"
        :class="compact ? 'text-[13.5px]' : 'text-sm'"
        :placeholder="branchContextText ? 'Ask about the selected text...' : 'Type your message...'"
        rows="1"
        :style="`resize: none; min-height: ${compact ? 40 : 44}px; max-height: 200px;`"
        @input="$emit('textarea-input')"
        @keydown="$emit('keydown', $event)"
      ></textarea>

      <button
        @click="$emit('send')"
        :disabled="!inputText.trim() || !canSend || selectedModelIds.length === 0 || isSending"
        class="flex items-center justify-center rounded-lg transition-all"
        :style="(!inputText.trim() || !canSend || selectedModelIds.length === 0 || isSending)
          ? `width: ${compact ? 40 : 44}px; height: ${compact ? 40 : 44}px; background: var(--color-border); cursor: not-allowed;`
          : `width: ${compact ? 40 : 44}px; height: ${compact ? 40 : 44}px; background: var(--color-primary); cursor: pointer;`"
        :title="isSending ? 'Sending...' : (selectedModelIds.length > 1 ? `Send to ${selectedModelIds.length} models` : 'Send message')"
      >
        <div v-if="isSending" class="loading-spinner-small"></div>
        <svg v-else :width="compact ? 18 : 20" :height="compact ? 18 : 20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: white;">
          <path d="M12 19V5M5 12l7-7 7 7"/>
        </svg>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import type { MessageNode, LLMModel } from '../types';
import { GitBranch, X } from 'lucide-vue-next';
import ModelDropdown from './ModelDropdown.vue';

interface Props {
  /** Smaller sizing used by the side chat panel (ChatHistory). */
  compact?: boolean;
  /** Show the resend UI instead of the normal input. */
  resendMode: boolean;
  selectedUserMessage: MessageNode | null;
  selectedModelIds: string[];
  availableModels: LLMModel[];
  maxModelsPerPrompt: number;
  webSearchEnabled: boolean;
  canEnableWebSearch: boolean;
  canSend: boolean;
  isSending: boolean;
  branchContextText: string;
}

interface Emits {
  (e: 'web-search-click', event: MouseEvent): void;
  (e: 'model-select', index: number, modelId: string): void;
  (e: 'add-model'): void;
  (e: 'remove-model', index: number): void;
  (e: 'send'): void;
  (e: 'resend'): void;
  (e: 'keydown', event: KeyboardEvent): void;
  (e: 'textarea-input'): void;
  (e: 'clear-branch-context'): void;
}

withDefaults(defineProps<Props>(), {
  compact: false,
});
defineEmits<Emits>();

const inputText = defineModel<string>({ required: true });

const textarea = ref<HTMLTextAreaElement | null>(null);

defineExpose({
  /** The underlying textarea element, so parents can wire focus/resize logic. */
  textarea,
});
</script>

<style scoped>
@import './chat-panel.css';
</style>
