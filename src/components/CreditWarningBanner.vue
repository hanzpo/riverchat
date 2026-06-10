<template>
  <!-- Floating banner for low/critical balance -->
  <div
    v-if="visible && !dismissed"
    class="fixed bottom-4 left-1/2 -translate-x-1/2 z-[100] px-5 py-3 rounded-lg shadow-lg flex items-center gap-3 text-sm font-medium max-w-md"
    :style="bannerStyle"
  >
    <span>{{ message }}</span>
    <button @click="$emit('upgrade')" class="btn-material shrink-0" :style="buttonStyle">
      Upgrade
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

  <!-- Blocking overlay when balance is zero -->
  <div v-if="isZero" class="modal-backdrop z-[150]">
    <div class="modal-content w-[440px] p-8 text-center">
      <div class="text-3xl font-bold mb-2" style="color: var(--color-error)">Out of credits</div>
      <p class="text-sm mb-6" style="color: var(--color-text-secondary)">
        Upgrade your plan to keep chatting.
      </p>
      <div class="flex gap-3 justify-center">
        <button
          @click="$emit('upgrade-to', 'pro')"
          class="btn-material"
          style="
            padding: 10px 20px;
            font-weight: 600;
            background: var(--color-primary-muted);
            color: var(--color-primary);
            border-color: var(--color-primary);
          "
        >
          Pro &mdash; $20/mo
        </button>
        <button
          @click="$emit('upgrade-to', 'max')"
          class="btn-material"
          style="padding: 10px 20px; font-weight: 600"
        >
          Max &mdash; $100/mo
        </button>
      </div>
      <p class="text-xs mt-4" style="color: var(--color-text-tertiary)">
        Credits refresh monthly, or upgrade for more.
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';

const props = defineProps<{
  isLow: boolean;
  isCritical: boolean;
  isZero: boolean;
}>();

defineEmits<{
  (e: 'upgrade'): void;
  (e: 'upgrade-to', tier: 'pro' | 'max'): void;
}>();

const dismissed = ref(false);

const visible = computed(() => props.isLow || props.isCritical);

const message = computed(() =>
  props.isCritical ? 'Almost out of credits' : 'Credits running low'
);

const bannerStyle = computed(() =>
  props.isCritical
    ? 'background: rgba(220, 38, 38, 0.15); border: 1px solid rgba(220, 38, 38, 0.4); color: #fca5a5;'
    : 'background: rgba(234, 179, 8, 0.15); border: 1px solid rgba(234, 179, 8, 0.4); color: #fde68a;'
);

const buttonStyle = computed(() =>
  props.isCritical
    ? 'padding: 6px 14px; font-size: 13px; font-weight: 600; background: rgba(220, 38, 38, 0.2); color: #fca5a5; border-color: rgba(220, 38, 38, 0.5);'
    : 'padding: 6px 14px; font-size: 13px; font-weight: 600; background: rgba(234, 179, 8, 0.2); color: #fde68a; border-color: rgba(234, 179, 8, 0.5);'
);
</script>
