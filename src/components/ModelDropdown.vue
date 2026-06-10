<template>
  <div class="relative" ref="dropdownRef">
    <button
      @click="isOpen = !isOpen"
      class="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition-all hover:bg-white/10"
      style="color: var(--color-text-primary); border: 1px solid var(--color-border)"
    >
      <span class="truncate max-w-[160px]">{{ selectedModelName }}</span>
      <svg
        width="10"
        height="10"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2.5"
        stroke-linecap="round"
        stroke-linejoin="round"
        class="flex-shrink-0 transition-transform"
        :class="{ 'rotate-180': isOpen }"
      >
        <path d="M6 9l6 6 6-6" />
      </svg>
    </button>

    <Teleport to="body">
      <div v-if="isOpen" class="fixed inset-0 z-[400]" @click="isOpen = false" />
      <div
        v-if="isOpen"
        ref="menuRef"
        class="fixed z-[400] w-[280px] max-h-[360px] overflow-y-auto rounded-lg shadow-xl py-1"
        :style="menuStyle"
        style="background: var(--color-background); border: 1px solid var(--color-border)"
      >
        <template v-for="cat in CATEGORY_ORDER" :key="cat">
          <div v-if="modelsInCategory(cat).length > 0">
            <div class="px-3 py-1.5 flex items-center gap-2">
              <span
                class="text-[10px] font-bold uppercase tracking-wider"
                style="color: var(--color-text-tertiary)"
              >
                {{ CATEGORY_LABELS[cat] }}
              </span>
              <span
                v-if="!canAccessCategory(cat)"
                class="text-[9px] font-bold px-1.5 py-0.5 rounded"
                style="
                  background: rgba(249, 115, 22, 0.2);
                  color: rgb(249, 115, 22);
                  border: 1px solid rgba(249, 115, 22, 0.3);
                "
              >
                {{ CATEGORY_MIN_TIER[cat] === 'pro' ? 'Pro' : 'Max' }}
              </span>
            </div>
            <button
              v-for="model in modelsInCategory(cat)"
              :key="model.id"
              @click="
                canAccessCategory(cat) ? selectModel(model.id) : showUpgradeForModel(model, $event)
              "
              class="w-full text-left px-3 py-2 flex items-center justify-between transition-colors"
              :class="
                canAccessCategory(cat)
                  ? 'hover:bg-white/5 cursor-pointer'
                  : 'opacity-40 cursor-pointer hover:opacity-60'
              "
            >
              <div class="min-w-0">
                <div
                  class="text-xs font-semibold truncate"
                  :style="
                    model.id === selectedModelId
                      ? 'color: var(--color-primary);'
                      : 'color: var(--color-text-primary);'
                  "
                >
                  {{ model.name }}
                </div>
                <div class="text-[10px] truncate" style="color: var(--color-text-tertiary)">
                  {{ model.provider }}
                </div>
              </div>
              <svg
                v-if="model.id === selectedModelId"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2.5"
                class="flex-shrink-0"
                style="color: var(--color-primary)"
              >
                <path d="M20 6L9 17l-5-5" />
              </svg>
            </button>
          </div>
        </template>
      </div>
    </Teleport>

    <!-- Upgrade Popover for locked models -->
    <UpgradePopover
      :visible="upgradePopover.visible"
      :position="upgradePopover.position"
      :title="upgradePopover.title"
      :description="upgradePopover.description"
      :target-tier="upgradePopover.targetTier"
      @close="upgradePopover.visible = false"
      @upgrade="handleUpgrade"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue';
import type { LLMModel, ModelCategory } from '../types';
import { CATEGORY_ORDER, CATEGORY_LABELS, CATEGORY_MIN_TIER } from '../types';
import { useSubscription } from '../composables/useSubscription';
import { usePostHog } from '../composables/usePostHog';
import { sortModels } from '../services/openrouter';
import UpgradePopover from './UpgradePopover.vue';

interface Props {
  selectedModelId: string | null;
  availableModels: LLMModel[];
}

interface Emits {
  (e: 'select', modelId: string): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();
const { canAccessCategory, upgradeToTier } = useSubscription();
const posthogAnalytics = usePostHog();

const isOpen = ref(false);
const dropdownRef = ref<HTMLElement | null>(null);
const menuRef = ref<HTMLElement | null>(null);
const menuStyle = ref<Record<string, string>>({});

const upgradePopover = ref({
  visible: false,
  position: { top: 0, left: 0 },
  title: '',
  description: '',
  targetTier: 'pro' as 'pro' | 'max',
});

const sortedModels = computed(() => sortModels([...props.availableModels]));

const selectedModelName = computed(() => {
  if (!props.selectedModelId) return 'Select model';
  const model = props.availableModels.find((m) => m.id === props.selectedModelId);
  return model?.name || props.selectedModelId;
});

function modelsInCategory(cat: ModelCategory): LLMModel[] {
  return sortedModels.value.filter((m) => m.category === cat);
}

function selectModel(modelId: string) {
  emit('select', modelId);
  isOpen.value = false;
}

function showUpgradeForModel(model: LLMModel, event: MouseEvent) {
  const rect = (event.target as HTMLElement).getBoundingClientRect();
  const targetTier = CATEGORY_MIN_TIER[model.category] as 'pro' | 'max';
  upgradePopover.value = {
    visible: true,
    position: { top: rect.top, left: rect.right + 8 },
    title: `Unlock ${model.name}`,
    description: `${CATEGORY_LABELS[model.category]} models require a ${targetTier === 'max' ? 'Max' : 'Pro'} subscription.`,
    targetTier,
  };
  isOpen.value = false;
  posthogAnalytics.capture('upgrade_prompt_shown', {
    source: 'model_dropdown',
    model: model.id,
    target_tier: targetTier,
  });
}

function handleUpgrade(tier: 'pro' | 'max') {
  upgradePopover.value.visible = false;
  posthogAnalytics.capture('upgrade_prompt_clicked', {
    source: 'model_dropdown',
    target_tier: tier,
  });
  upgradeToTier(tier);
}

watch(isOpen, async (open) => {
  if (open && dropdownRef.value) {
    await nextTick();
    const rect = dropdownRef.value.getBoundingClientRect();
    const menuHeight = 360;
    const menuWidth = 280;
    const spaceBelow = window.innerHeight - rect.bottom - 8;
    const top = spaceBelow >= menuHeight ? rect.bottom + 4 : rect.top - menuHeight - 4;
    // Clamp left so menu doesn't overflow right edge of viewport
    const maxLeft = window.innerWidth - menuWidth - 8;
    const left = Math.max(8, Math.min(rect.left, maxLeft));
    menuStyle.value = {
      top: `${Math.max(8, top)}px`,
      left: `${left}px`,
    };
  }
});
</script>
