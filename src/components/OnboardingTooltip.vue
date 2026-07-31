<template>
  <Teleport to="body">
    <transition name="tooltip-fade">
      <div
        v-if="visible && tip"
        class="fixed z-[500] flex flex-col gap-2 px-4 py-3 rounded-lg shadow-xl max-w-xs animate-fade-in"
        style="
          top: 120px;
          left: 24px;
          background: var(--color-background);
          border: 1px solid var(--color-primary);
          box-shadow: 0 0 12px rgba(13, 153, 255, 0.15);
        "
      >
        <div class="flex items-start gap-2.5">
          <p
            class="flex-1 text-xs font-medium leading-relaxed"
            style="color: var(--color-text-primary)"
          >
            {{ tip.message }}
          </p>
          <button
            @click="$emit('dismiss', tip.id)"
            class="shrink-0 p-1 -m-1 rounded hover:bg-white/10 opacity-60 hover:opacity-100 transition-all"
            style="color: var(--color-text-secondary)"
            title="Dismiss"
          >
            <PhX :size="16" weight="bold" />
          </button>
        </div>
        <button
          @click="$emit('dismiss-all')"
          class="self-start text-[11px] opacity-40 hover:opacity-70 transition-opacity"
          style="color: var(--color-text-secondary)"
        >
          Don't show tips
        </button>
      </div>
    </transition>
  </Teleport>
</template>

<script setup lang="ts">
import type { TourTip } from '../composables/useOnboardingTour';
import { PhX } from '@phosphor-icons/vue';

defineProps<{
  visible: boolean;
  tip: TourTip | null;
}>();

defineEmits<{
  (e: 'dismiss', tipId: string): void;
  (e: 'dismiss-all'): void;
}>();
</script>

<style scoped>
.tooltip-fade-enter-active,
.tooltip-fade-leave-active {
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
}
.tooltip-fade-enter-from,
.tooltip-fade-leave-to {
  opacity: 0;
  transform: translateY(4px);
}
</style>
