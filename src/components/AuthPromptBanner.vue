<template>
  <transition name="banner-fade">
    <div
      v-if="visible && !dismissed"
      class="fixed bottom-4 left-1/2 -translate-x-1/2 z-[80] px-5 py-3 rounded-lg shadow-lg flex items-center gap-3 text-sm font-medium max-w-md"
      style="
        background: rgba(13, 153, 255, 0.12);
        border: 1px solid rgba(13, 153, 255, 0.3);
        color: var(--color-primary);
      "
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        class="shrink-0"
      >
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
      <span class="text-xs">{{ message }}</span>
      <button
        @click="$emit('sign-up')"
        class="btn-material shrink-0"
        style="
          padding: 5px 12px;
          font-size: 12px;
          font-weight: 600;
          background: var(--color-primary-muted);
          color: var(--color-primary);
          border-color: var(--color-primary);
        "
      >
        Sign in
      </button>
      <button
        @click="dismissed = true"
        class="shrink-0 opacity-60 hover:opacity-100 transition-opacity"
        style="color: inherit"
        title="Dismiss"
      >
        &times;
      </button>
    </div>
  </transition>
</template>

<script setup lang="ts">
import { ref } from 'vue';

defineProps<{
  visible: boolean;
  message: string;
}>();

defineEmits<{
  (e: 'sign-up'): void;
}>();

const dismissed = ref(false);
</script>

<style scoped>
.banner-fade-enter-active,
.banner-fade-leave-active {
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
}
.banner-fade-enter-from,
.banner-fade-leave-to {
  opacity: 0;
  transform: translate(-50%, 8px);
}
</style>
