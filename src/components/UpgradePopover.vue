<template>
  <Teleport to="body">
    <!-- Backdrop -->
    <div v-if="visible" class="fixed inset-0 z-[450]" @click="$emit('close')" />
    <!-- Popover -->
    <div
      v-if="visible"
      ref="popoverRef"
      class="fixed z-[450] w-[240px] p-3 rounded-lg shadow-xl animate-fade-in"
      :style="{
        top: position.top + 'px',
        left: position.left + 'px',
        background: 'var(--color-background)',
        border: '1px solid var(--color-border)',
      }"
    >
      <p class="text-xs font-semibold mb-1" style="color: var(--color-text-primary)">
        {{ title }}
      </p>
      <p class="text-[11px] mb-3" style="color: var(--color-text-secondary)">
        {{ description }}
      </p>
      <button
        @click="$emit('upgrade', targetTier)"
        class="btn-material w-full text-xs"
        style="
          padding: 7px 14px;
          font-weight: 600;
          background: var(--color-primary-muted);
          color: var(--color-primary);
          border-color: var(--color-primary);
        "
      >
        Upgrade to {{ targetTier === 'max' ? 'Max' : 'Pro' }} &mdash;
        {{ targetTier === 'max' ? '$100' : '$20' }}/mo
      </button>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref } from 'vue';

interface Props {
  visible: boolean;
  position: { top: number; left: number };
  title: string;
  description: string;
  targetTier?: 'pro' | 'max';
}

withDefaults(defineProps<Props>(), {
  targetTier: 'pro',
});

defineEmits<{
  (e: 'close'): void;
  (e: 'upgrade', tier: 'pro' | 'max'): void;
}>();

const popoverRef = ref<HTMLElement | null>(null);
</script>
