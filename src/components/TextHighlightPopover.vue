<template>
  <div
    v-if="visible"
    class="text-highlight-popover z-[600]"
    :style="{
      left: `${position.x}px`,
      top: `${position.y}px`,
    }"
  >
    <button
      class="popover-button"
      @click.stop="$emit('branch')"
      @mousedown.stop
      title="Create a new branch with this text as context"
    >
      <span class="label">Branch with Selection</span>
    </button>
  </div>
</template>

<script setup lang="ts">
interface Props {
  visible: boolean;
  position: { x: number; y: number };
}

interface Emits {
  (e: 'branch'): void;
}

defineProps<Props>();
defineEmits<Emits>();
</script>

<style scoped>
.text-highlight-popover {
  position: fixed;
  display: flex;
  gap: 4px;
  background: var(--color-background-elevated);
  backdrop-filter: blur(16px);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 6px;
  box-shadow: var(--shadow-xl);
  animation: popover-appear 0.15s var(--ease-in-out);
  transform: translateY(-100%) translateY(-12px);
}

@keyframes popover-appear {
  from {
    opacity: 0;
    transform: translateY(-100%) translateY(-6px) scale(0.95);
  }
  to {
    opacity: 1;
    transform: translateY(-100%) translateY(-12px) scale(1);
  }
}

.popover-button {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  background: var(--color-primary-muted);
  border: 1px solid var(--color-primary);
  border-radius: 8px;
  color: var(--color-primary);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s var(--ease-in-out);
  white-space: nowrap;
}

.popover-button:hover {
  background: rgba(13, 153, 255, 0.25);
  border-color: var(--color-primary-hover);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px var(--color-primary-muted);
}

.popover-button:active {
  transform: translateY(0);
}

.popover-button .icon {
  font-size: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.popover-button .label {
  font-weight: 700;
  letter-spacing: 0.02em;
}
</style>
