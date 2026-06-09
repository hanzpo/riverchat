<template>
  <div v-if="isOpen" class="modal-backdrop z-[200]" @click.self="emit('close')">
    <div
      ref="modalEl"
      tabindex="-1"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-river-modal-title"
      class="modal-content w-[450px] p-7"
    >
      <h3 id="create-river-modal-title" class="text-lg font-semibold mb-3" style="color: var(--color-text-primary); letter-spacing: -0.01em;">
        Create a New River
      </h3>
      <p class="text-sm leading-relaxed mb-4 font-medium" style="color: var(--color-text-secondary);">
        Give your river a name to get started.
      </p>

      <input
        ref="nameInput"
        v-model="riverName"
        type="text"
        placeholder="Enter river name..."
        class="input-material w-full mb-6"
        @keyup.enter="handleCreate"
      />

      <div class="flex justify-end gap-3">
        <button @click="emit('close')" class="btn-material" style="padding: 8px 16px;">
          Cancel
        </button>
        <button
          @click="handleCreate"
          :disabled="!riverName.trim()"
          class="btn-material"
          style="padding: 8px 16px; font-weight: 600; background: var(--color-primary-muted); color: var(--color-primary); border-color: var(--color-primary);"
        >
          Create
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick } from 'vue';
import { useModalA11y } from '../composables/useModalA11y';

interface Props {
  isOpen: boolean;
}

interface Emits {
  (e: 'create', name: string): void;
  (e: 'close'): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const riverName = ref('');
const nameInput = ref<HTMLInputElement | null>(null);
const modalEl = ref<HTMLElement | null>(null);
useModalA11y(() => props.isOpen, modalEl);

// Auto-focus and reset when modal opens
watch(() => props.isOpen, (open) => {
  if (open) {
    riverName.value = '';
    nextTick(() => {
      nameInput.value?.focus();
    });
  }
});

function handleCreate() {
  const trimmed = riverName.value.trim();
  if (trimmed) {
    emit('create', trimmed);
    emit('close');
  }
}
</script>
