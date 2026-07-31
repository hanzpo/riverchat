<template>
  <div v-if="isOpen" class="modal-backdrop z-[200]" @click.self="$emit('close')">
    <div
      ref="modalEl"
      tabindex="-1"
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-resubmit-modal-title"
      class="modal-content w-[550px] p-7"
    >
      <h3
        id="edit-resubmit-modal-title"
        class="text-lg font-semibold mb-2"
        style="color: var(--color-text-primary); letter-spacing: -0.01em"
      >
        Edit and Resubmit
      </h3>
      <p
        class="text-sm leading-relaxed mb-4 font-medium"
        style="color: var(--color-text-secondary)"
      >
        All responses below this message will be deleted and a new response will be generated.
      </p>
      <textarea
        ref="textareaEl"
        v-model="content"
        class="textarea-material"
        style="min-height: 120px; max-height: 300px"
        @keydown.ctrl.enter="$emit('confirm')"
        @keydown.meta.enter="$emit('confirm')"
      ></textarea>
      <div class="flex justify-end gap-3 mt-4">
        <button @click="$emit('close')" class="btn-material" style="padding: 8px 16px">
          Cancel
        </button>
        <button
          @click="$emit('confirm')"
          :disabled="!content.trim()"
          class="btn-material"
          style="
            padding: 8px 16px;
            font-weight: 600;
            background: var(--color-primary-muted);
            color: var(--color-primary);
            border-color: var(--color-primary);
          "
        >
          Resubmit
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick } from 'vue';
import { useModalA11y } from '../composables/useModalA11y';

const props = defineProps<{ isOpen: boolean }>();
defineEmits<{ confirm: []; close: [] }>();

const content = defineModel<string>({ required: true });

const modalEl = ref<HTMLElement | null>(null);
const textareaEl = ref<HTMLTextAreaElement | null>(null);
useModalA11y(() => props.isOpen, modalEl);

// Auto-focus the textarea with the cursor at the end when the modal opens
watch(
  () => props.isOpen,
  (open) => {
    if (!open) return;
    nextTick(() => {
      const el = textareaEl.value;
      if (el) {
        el.focus();
        el.selectionStart = el.value.length;
        el.selectionEnd = el.value.length;
      }
    });
  }
);
</script>
