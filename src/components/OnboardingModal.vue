<template>
  <div v-if="isOpen" class="modal-backdrop z-[200]" @click.self="onBackdropClick">
    <div
      ref="modalEl"
      tabindex="-1"
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-modal-title"
      class="modal-content w-[480px] p-8 text-center"
    >
      <!-- Value prop section -->
      <div class="mb-6">
        <!-- Branching tree visual -->
        <div class="flex justify-center mb-4">
          <svg
            width="120"
            height="80"
            viewBox="0 0 120 80"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <!-- Root node -->
            <circle cx="60" cy="12" r="8" fill="var(--color-primary)" opacity="0.8" />
            <!-- Lines to children -->
            <line x1="60" y1="20" x2="30" y2="44" stroke="var(--color-border)" stroke-width="2" />
            <line x1="60" y1="20" x2="90" y2="44" stroke="var(--color-border)" stroke-width="2" />
            <!-- Child nodes -->
            <circle cx="30" cy="48" r="7" fill="var(--color-secondary)" opacity="0.7" />
            <circle cx="90" cy="48" r="7" fill="var(--color-accent)" opacity="0.7" />
            <!-- Grandchild lines -->
            <line x1="30" y1="55" x2="15" y2="68" stroke="var(--color-border)" stroke-width="1.5" />
            <line x1="30" y1="55" x2="45" y2="68" stroke="var(--color-border)" stroke-width="1.5" />
            <!-- Grandchild nodes -->
            <circle cx="15" cy="72" r="5" fill="var(--color-secondary)" opacity="0.5" />
            <circle cx="45" cy="72" r="5" fill="var(--color-secondary)" opacity="0.5" />
          </svg>
        </div>

        <h1
          id="onboarding-modal-title"
          class="text-lg font-semibold mb-2"
          style="color: var(--color-text-primary); letter-spacing: -0.02em"
        >
          AI conversations that branch and compare
        </h1>
        <p class="text-xs leading-relaxed" style="color: var(--color-text-secondary)">
          Send prompts to multiple models at once. Branch conversations to explore different angles.
          All visualized as an interactive tree.
        </p>
      </div>

      <div class="my-5" style="border-top: 1px solid var(--color-border)"></div>

      <!-- Inline chat input -->
      <div class="text-left">
        <label
          class="text-[11px] font-bold uppercase tracking-wider mb-2 block"
          style="color: var(--color-text-tertiary)"
        >
          Try it now
        </label>
        <div class="flex items-end gap-2">
          <textarea
            ref="textareaRef"
            v-model="message"
            class="textarea-material text-[13.5px] flex-1"
            placeholder="Ask anything to get started..."
            rows="2"
            style="resize: none; min-height: 60px; max-height: 120px"
            @keydown="handleKeydown"
          ></textarea>
          <button
            @click="handleSend"
            :disabled="!message.trim()"
            class="flex items-center justify-center rounded-lg transition-all shrink-0"
            :style="
              !message.trim()
                ? 'width: 40px; height: 40px; background: var(--color-border); cursor: not-allowed;'
                : 'width: 40px; height: 40px; background: var(--color-primary); cursor: pointer;'
            "
          >
            <PhArrowUp :size="18" style="color: white" />
          </button>
        </div>
      </div>

      <div class="mt-4 flex items-center justify-between">
        <p class="text-[11px]" style="color: var(--color-text-tertiary)">
          $2.00 free credits included
        </p>
        <button
          @click="emit('skip')"
          class="text-[11px] font-medium bg-transparent border-none cursor-pointer"
          style="color: var(--color-text-tertiary); padding: 4px"
        >
          Skip &rarr;
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick } from 'vue';
import { useModalA11y } from '../composables/useModalA11y';
import { PhArrowUp } from '@phosphor-icons/vue';

interface Props {
  isOpen: boolean;
  canDismiss?: boolean;
}

interface Emits {
  (e: 'send-first-message', content: string): void;
  (e: 'skip'): void;
}

const props = withDefaults(defineProps<Props>(), {
  canDismiss: false,
});

const emit = defineEmits<Emits>();

const message = ref('');
const textareaRef = ref<HTMLTextAreaElement | null>(null);
const modalEl = ref<HTMLElement | null>(null);
useModalA11y(() => props.isOpen, modalEl);

function onBackdropClick() {
  if (props.canDismiss) {
    emit('skip');
  }
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    handleSend();
  }
}

function handleSend() {
  if (message.value.trim()) {
    emit('send-first-message', message.value.trim());
  }
}

// Auto-focus textarea when modal opens
watch(
  () => props.isOpen,
  async (isOpen) => {
    if (isOpen) {
      await nextTick();
      requestAnimationFrame(() => {
        textareaRef.value?.focus();
      });
    }
  },
  { immediate: true }
);
</script>
