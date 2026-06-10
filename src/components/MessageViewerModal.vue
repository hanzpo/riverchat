<template>
  <div v-if="isOpen && message" class="modal-backdrop z-[200]" @click.self="emit('close')">
    <div
      ref="modalEl"
      tabindex="-1"
      role="dialog"
      aria-modal="true"
      aria-label="Full message"
      class="modal-content w-[800px] max-h-[80vh] p-8 overflow-y-auto"
    >
      <!-- Header -->
      <div class="flex justify-between items-start mb-5">
        <div>
          <div class="flex items-center gap-2.5 mb-2.5">
            <span
              class="px-2.5 py-1 rounded-md text-[10px] font-semibold uppercase tracking-wide"
              :style="
                message.type === 'user'
                  ? 'background: var(--color-primary-muted); color: var(--color-primary); border: 1px solid var(--color-primary);'
                  : 'background: rgba(162, 89, 255, 0.1); color: var(--color-accent); border: 1px solid var(--color-accent);'
              "
            >
              {{ message.type === 'user' ? 'USER' : 'AI' }}
            </span>
            <span
              v-if="message.model"
              class="text-xs font-medium"
              style="color: var(--color-text-secondary)"
            >
              {{ message.model.name }}
            </span>
          </div>
          <p class="text-xs font-medium" style="color: var(--color-text-tertiary)">
            {{ formatTimestamp(message.timestamp) }}
          </p>
        </div>

        <button
          @click="handleCopy"
          class="btn-material flex items-center gap-1.5"
          style="padding: 8px 14px"
        >
          <span class="font-medium text-xs">{{ copied ? 'Copied!' : 'Copy' }}</span>
        </button>
      </div>

      <!-- Message Content -->
      <div
        class="card-material p-6 break-words leading-relaxed text-sm markdown-content"
        style="color: var(--color-text-primary)"
      >
        <div v-html="renderMarkdown(message.content)"></div>
      </div>

      <!-- Error State -->
      <div
        v-if="message.state === 'error' && message.error"
        class="mt-4 rounded-lg p-4"
        style="background: var(--color-error-bg); border: 1px solid var(--color-error)"
      >
        <p class="text-xs font-semibold mb-1.5" style="color: var(--color-error)">Error:</p>
        <p class="text-xs font-medium" style="color: var(--color-error)">
          {{ message.error }}
        </p>
      </div>

      <!-- Close Button -->
      <div class="flex justify-end mt-6">
        <button @click="emit('close')" class="btn-material" style="padding: 8px 16px">Close</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onUnmounted } from 'vue';
import type { MessageNode } from '../types';
import { renderMarkdown } from '../utils/chat';
import { useModalA11y } from '../composables/useModalA11y';
import { copyToClipboard } from '../composables/useClipboard';

interface Props {
  isOpen: boolean;
  message: MessageNode | null;
}

interface Emits {
  (e: 'close'): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const copied = ref(false);
let copyTimeout: ReturnType<typeof setTimeout> | null = null;

const modalEl = ref<HTMLElement | null>(null);
useModalA11y(() => props.isOpen, modalEl);

// Reset copied state when modal closes
watch(
  () => props.isOpen,
  (open) => {
    if (!open) {
      copied.value = false;
      if (copyTimeout) {
        clearTimeout(copyTimeout);
        copyTimeout = null;
      }
    }
  }
);

onUnmounted(() => {
  if (copyTimeout) {
    clearTimeout(copyTimeout);
    copyTimeout = null;
  }
});

function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleString();
}

async function handleCopy() {
  if (props.message && (await copyToClipboard(props.message.content))) {
    copied.value = true;
    if (copyTimeout) clearTimeout(copyTimeout);
    copyTimeout = setTimeout(() => {
      copied.value = false;
      copyTimeout = null;
    }, 2000);
  }
  // Clipboard API failures are silent (button label simply doesn't change)
}
</script>

<style scoped>
/* Markdown content styling */
.markdown-content :deep(p) {
  margin-bottom: 0.75em;
}

.markdown-content :deep(p:last-child) {
  margin-bottom: 0;
}

.markdown-content :deep(h1),
.markdown-content :deep(h2),
.markdown-content :deep(h3),
.markdown-content :deep(h4),
.markdown-content :deep(h5),
.markdown-content :deep(h6) {
  font-weight: bold;
  margin-top: 1em;
  margin-bottom: 0.5em;
  line-height: 1.3;
}

.markdown-content :deep(h1) {
  font-size: 1.5em;
}
.markdown-content :deep(h2) {
  font-size: 1.3em;
}
.markdown-content :deep(h3) {
  font-size: 1.15em;
}
.markdown-content :deep(h4) {
  font-size: 1.05em;
}

.markdown-content :deep(code) {
  background: var(--color-background-tertiary);
  padding: 0.15em 0.4em;
  border-radius: 4px;
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  font-size: 0.9em;
  border: 1px solid var(--color-border);
}

.markdown-content :deep(pre) {
  background: var(--color-background);
  padding: 0.75em;
  border-radius: 8px;
  overflow-x: auto;
  margin: 0.75em 0;
  border: 1px solid var(--color-border);
}

.markdown-content :deep(pre code) {
  background-color: transparent;
  padding: 0;
  border-radius: 0;
  font-size: 0.85em;
  line-height: 1.5;
}

.markdown-content :deep(ul),
.markdown-content :deep(ol) {
  margin: 0.5em 0;
  padding-left: 1.5em;
}

.markdown-content :deep(li) {
  margin: 0.25em 0;
}

.markdown-content :deep(blockquote) {
  border-left: 3px solid var(--color-border-light);
  padding-left: 1em;
  margin: 0.75em 0;
  font-style: italic;
  color: var(--color-text-secondary);
}

.markdown-content :deep(a) {
  color: var(--color-primary);
  text-decoration: underline;
}

.markdown-content :deep(a:hover) {
  color: var(--color-primary-hover);
}

.markdown-content :deep(hr) {
  border: none;
  border-top: 1px solid var(--color-border);
  margin: 1em 0;
}

.markdown-content :deep(table) {
  border-collapse: collapse;
  margin: 0.75em 0;
  width: 100%;
}

.markdown-content :deep(th),
.markdown-content :deep(td) {
  border: 1px solid var(--color-border);
  padding: 0.5em;
  text-align: left;
}

.markdown-content :deep(th) {
  background: var(--color-background-tertiary);
  font-weight: bold;
}

.markdown-content :deep(strong) {
  font-weight: bold;
}

.markdown-content :deep(em) {
  font-style: italic;
}
</style>
