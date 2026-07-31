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
          <!-- Miniature of the river canvas: a user prompt card fanning out to
               two model responses (one selected), with one branch explored further -->
          <svg
            width="220"
            height="120"
            viewBox="0 0 220 120"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <!-- Edges (bezier, like the canvas) -->
            <path
              d="M110,26 C110,42 57,42 57,50"
              stroke="var(--color-border-light)"
              stroke-width="1.5"
            />
            <path
              d="M110,26 C110,42 163,42 163,50"
              stroke="var(--color-border-light)"
              stroke-width="1.5"
            />
            <path
              d="M57,72 C57,86 29,86 29,94"
              stroke="var(--color-border-light)"
              stroke-width="1.5"
            />
            <path
              d="M57,72 C57,86 85,86 85,94"
              stroke="var(--color-border-light)"
              stroke-width="1.5"
            />
            <!-- Root: user prompt -->
            <g transform="translate(92,4)">
              <rect
                width="36"
                height="22"
                rx="6"
                fill="#0d99ff2e"
                stroke="var(--color-primary)"
                stroke-opacity="0.9"
                stroke-width="1.5"
              />
              <rect x="7" y="7" width="22" height="2.5" rx="1.25" fill="#ffffff" opacity="0.55" />
              <rect x="7" y="12.5" width="14" height="2.5" rx="1.25" fill="#ffffff" opacity="0.3" />
            </g>
            <!-- Model A response -->
            <g transform="translate(39,50)">
              <rect
                width="36"
                height="22"
                rx="6"
                fill="#06b6d426"
                stroke="var(--color-secondary)"
                stroke-opacity="0.8"
                stroke-width="1.5"
              />
              <rect x="7" y="7" width="22" height="2.5" rx="1.25" fill="#ffffff" opacity="0.45" />
              <rect
                x="7"
                y="12.5"
                width="16"
                height="2.5"
                rx="1.25"
                fill="#ffffff"
                opacity="0.25"
              />
            </g>
            <!-- Model B response (selected) -->
            <g transform="translate(145,50)">
              <rect
                x="-3.5"
                y="-3.5"
                width="43"
                height="29"
                rx="8.5"
                stroke="var(--color-accent)"
                stroke-opacity="0.35"
                stroke-width="1.5"
              />
              <rect
                width="36"
                height="22"
                rx="6"
                fill="#a259ff26"
                stroke="var(--color-accent)"
                stroke-opacity="0.85"
                stroke-width="1.5"
              />
              <rect x="7" y="7" width="22" height="2.5" rx="1.25" fill="#ffffff" opacity="0.45" />
              <rect
                x="7"
                y="12.5"
                width="16"
                height="2.5"
                rx="1.25"
                fill="#ffffff"
                opacity="0.25"
              />
            </g>
            <!-- Explored branch -->
            <g transform="translate(13,94)" opacity="0.75">
              <rect
                width="32"
                height="20"
                rx="5.5"
                fill="#06b6d41f"
                stroke="var(--color-secondary)"
                stroke-opacity="0.55"
                stroke-width="1.25"
              />
              <rect x="6" y="6" width="20" height="2.25" rx="1.1" fill="#ffffff" opacity="0.35" />
              <rect x="6" y="11" width="13" height="2.25" rx="1.1" fill="#ffffff" opacity="0.2" />
            </g>
            <g transform="translate(69,94)" opacity="0.75">
              <rect
                width="32"
                height="20"
                rx="5.5"
                fill="#0d99ff1f"
                stroke="var(--color-primary)"
                stroke-opacity="0.55"
                stroke-width="1.25"
              />
              <rect x="6" y="6" width="20" height="2.25" rx="1.1" fill="#ffffff" opacity="0.35" />
              <rect x="6" y="11" width="13" height="2.25" rx="1.1" fill="#ffffff" opacity="0.2" />
            </g>
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
