<template>
  <div class="fixed inset-0 flex z-[100]" style="background: var(--color-background)">
    <!-- Sidebar with Tabs -->
    <div
      class="w-64 border-r flex flex-col"
      style="border-color: var(--color-border); background: var(--color-background-secondary)"
    >
      <!-- Back Button -->
      <div class="p-4 border-b" style="border-color: var(--color-border)">
        <button
          @click="handleBack"
          class="flex items-center gap-2 text-sm font-semibold hover:opacity-80 transition-opacity"
          style="color: var(--color-text-primary)"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          Back
        </button>
      </div>

      <!-- Tab List -->
      <div class="flex-1 p-4">
        <h2
          class="text-xs font-bold uppercase tracking-wider mb-4"
          style="color: var(--color-text-tertiary)"
        >
          Settings
        </h2>
        <div class="space-y-1">
          <button
            v-for="tab in tabs"
            :key="tab.id"
            @click="activeTab = tab.id"
            class="w-full text-left px-4 py-3 rounded-lg transition-all text-sm font-semibold"
            :class="
              activeTab === tab.id
                ? 'text-primary border border-primary'
                : 'text-secondary hover:bg-white/5 border border-transparent'
            "
            :style="activeTab === tab.id ? 'background: var(--color-primary);' : ''"
          >
            <span :style="activeTab === tab.id ? 'color: var(--color-background);' : ''">
              {{ tab.name }}
            </span>
          </button>
        </div>
      </div>
    </div>

    <!-- Main Content Area -->
    <div class="flex-1 flex flex-col overflow-hidden">
      <!-- Plan & Usage Tab -->
      <div v-if="activeTab === 'plan'" class="flex-1 overflow-y-auto p-8">
        <div class="max-w-3xl">
          <!-- Current Plan Badge -->
          <div class="mb-6">
            <h2 class="text-lg font-bold mb-4" style="color: var(--color-text-primary)">
              Your Plan
            </h2>
            <div
              class="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold uppercase tracking-wider"
              :style="tierBadgeStyle"
            >
              {{ subscription.tier.value }}
            </div>
          </div>

          <!-- Balance Card -->
          <div
            class="rounded-lg p-6 mb-6"
            style="
              background: var(--color-background-secondary);
              border: 1px solid var(--color-border);
            "
          >
            <h3 class="text-sm font-bold mb-4" style="color: var(--color-text-primary)">Balance</h3>

            <!-- Subscription Credits -->
            <div class="mb-4">
              <div class="flex justify-between items-center mb-2">
                <span class="text-xs font-semibold" style="color: var(--color-text-secondary)"
                  >Subscription Credits</span
                >
                <span class="text-sm font-bold" style="color: var(--color-text-primary)"
                  >${{ subscription.displayBalance.value.subscription }}</span
                >
              </div>
              <div class="w-full h-2 rounded-full" style="background: var(--color-border)">
                <div
                  class="h-2 rounded-full transition-all"
                  style="background: var(--color-primary)"
                  :style="{ width: subscriptionProgressWidth }"
                ></div>
              </div>
              <div
                v-if="subscription.daysUntilReset.value !== null"
                class="text-[10px] font-medium mt-1"
                style="color: var(--color-text-tertiary)"
              >
                Resets in {{ subscription.daysUntilReset.value }} day{{
                  subscription.daysUntilReset.value !== 1 ? 's' : ''
                }}
              </div>
            </div>

            <!-- Prepaid Credits -->
            <div class="flex justify-between items-center mb-4">
              <span class="text-xs font-semibold" style="color: var(--color-text-secondary)"
                >Prepaid Credits</span
              >
              <span class="text-sm font-bold" style="color: var(--color-text-primary)"
                >${{ subscription.displayBalance.value.prepaid }}</span
              >
            </div>

            <!-- Total -->
            <div
              class="pt-3 border-t flex justify-between items-center"
              style="border-color: var(--color-border)"
            >
              <span class="text-sm font-bold" style="color: var(--color-text-primary)"
                >Total Balance</span
              >
              <span class="text-lg font-bold" style="color: var(--color-primary)"
                >${{ subscription.displayBalance.value.total }}</span
              >
            </div>
          </div>

          <!-- Plan Comparison -->
          <div class="mb-6">
            <h3 class="text-sm font-bold mb-4" style="color: var(--color-text-primary)">Plans</h3>
            <div class="grid grid-cols-3 gap-4">
              <!-- Free Plan -->
              <div
                class="rounded-lg p-4"
                :class="
                  subscription.tier.value === 'free'
                    ? 'border-2 border-primary'
                    : 'border border-white/10'
                "
                style="background: var(--color-background-secondary)"
              >
                <div
                  class="text-xs font-bold uppercase tracking-wider mb-1"
                  style="color: var(--color-text-tertiary)"
                >
                  Free
                </div>
                <div class="text-xl font-bold mb-3" style="color: var(--color-text-primary)">
                  $0<span class="text-xs font-normal">/mo</span>
                </div>
                <ul class="space-y-1.5 text-xs" style="color: var(--color-text-secondary)">
                  <li>$2.00/mo credits</li>
                  <li>Budget models only</li>
                  <li>2 models per prompt</li>
                </ul>
                <div
                  v-if="subscription.tier.value === 'free'"
                  class="mt-4 text-xs font-bold text-center py-2 rounded-md"
                  style="background: var(--color-primary-muted); color: var(--color-primary)"
                >
                  Current Plan
                </div>
              </div>

              <!-- Pro Plan -->
              <div
                class="rounded-lg p-4"
                :class="
                  subscription.tier.value === 'pro'
                    ? 'border-2 border-primary'
                    : 'border border-white/10'
                "
                style="background: var(--color-background-secondary)"
              >
                <div
                  class="text-xs font-bold uppercase tracking-wider mb-1"
                  style="color: var(--color-text-tertiary)"
                >
                  Pro
                </div>
                <div class="text-xl font-bold mb-3" style="color: var(--color-text-primary)">
                  $20<span class="text-xs font-normal">/mo</span>
                </div>
                <ul class="space-y-1.5 text-xs" style="color: var(--color-text-secondary)">
                  <li>$20.00/mo credits</li>
                  <li>Budget + Standard + Premium</li>
                  <li>5 models per prompt</li>
                  <li>Web search</li>
                </ul>
                <button
                  v-if="subscription.tier.value === 'free'"
                  @click="handleUpgrade('pro')"
                  :disabled="isUpgrading"
                  class="mt-4 w-full text-xs font-bold text-center py-2 rounded-md transition-all hover:opacity-80"
                  style="background: var(--color-primary); color: var(--color-background)"
                >
                  {{ isUpgrading ? 'Redirecting...' : 'Upgrade to Pro' }}
                </button>
                <div
                  v-else-if="subscription.tier.value === 'pro'"
                  class="mt-4 text-xs font-bold text-center py-2 rounded-md"
                  style="background: var(--color-primary-muted); color: var(--color-primary)"
                >
                  Current Plan
                </div>
              </div>

              <!-- Max Plan -->
              <div
                class="rounded-lg p-4"
                :class="
                  subscription.tier.value === 'max'
                    ? 'border-2 border-primary'
                    : 'border border-white/10'
                "
                style="background: var(--color-background-secondary)"
              >
                <div
                  class="text-xs font-bold uppercase tracking-wider mb-1"
                  style="color: var(--color-text-tertiary)"
                >
                  Max
                </div>
                <div class="text-xl font-bold mb-3" style="color: var(--color-text-primary)">
                  $100<span class="text-xs font-normal">/mo</span>
                </div>
                <ul class="space-y-1.5 text-xs" style="color: var(--color-text-secondary)">
                  <li>$120.00/mo credits (20% bonus)</li>
                  <li>All models incl. Frontier</li>
                  <li>Unlimited models per prompt</li>
                  <li>Web search</li>
                </ul>
                <button
                  v-if="subscription.tier.value !== 'max'"
                  @click="handleUpgrade('max')"
                  :disabled="isUpgrading"
                  class="mt-4 w-full text-xs font-bold text-center py-2 rounded-md transition-all hover:opacity-80"
                  style="background: var(--color-primary); color: var(--color-background)"
                >
                  {{ isUpgrading ? 'Redirecting...' : 'Upgrade to Max' }}
                </button>
                <div
                  v-else
                  class="mt-4 text-xs font-bold text-center py-2 rounded-md"
                  style="background: var(--color-primary-muted); color: var(--color-primary)"
                >
                  Current Plan
                </div>
              </div>
            </div>
          </div>

          <!-- Buy Credits -->
          <div
            class="rounded-lg p-6 mb-6"
            style="
              background: var(--color-background-secondary);
              border: 1px solid var(--color-border);
            "
          >
            <h3 class="text-sm font-bold mb-2" style="color: var(--color-text-primary)">
              Buy Credits
            </h3>
            <p class="text-xs mb-4" style="color: var(--color-text-tertiary)">
              Prepaid credits roll over and never expire. Use them when your monthly credits run
              out.
            </p>
            <template v-if="subscription.tier.value !== 'free'">
              <div class="flex gap-2 mb-3">
                <button
                  v-for="amount in [500, 1000, 2000]"
                  :key="amount"
                  @click="handleBuyCredits(amount)"
                  :disabled="isBuyingCredits"
                  class="btn-material px-4 py-2 text-sm font-semibold flex-1"
                >
                  ${{ (amount / 100).toFixed(0) }}
                </button>
              </div>
              <div class="flex gap-2">
                <input
                  v-model.number="customTopupAmount"
                  type="number"
                  min="5"
                  max="500"
                  placeholder="Custom amount ($)"
                  class="input-material flex-1 text-sm"
                />
                <button
                  @click="handleCustomTopup"
                  :disabled="isBuyingCredits || !customTopupAmount || customTopupAmount < 5"
                  class="btn-material px-4 py-2 text-sm font-semibold"
                  :style="
                    !customTopupAmount || customTopupAmount < 5
                      ? 'opacity: 0.5; cursor: not-allowed;'
                      : 'background: var(--color-primary-muted); color: var(--color-primary); border-color: var(--color-primary);'
                  "
                >
                  Buy
                </button>
              </div>
            </template>
            <div
              v-else
              class="rounded-md p-3"
              style="background: rgba(249, 115, 22, 0.1); border: 1px solid rgba(249, 115, 22, 0.3)"
            >
              <p class="text-xs font-medium" style="color: rgb(249, 115, 22)">
                Upgrade to Pro or Max to purchase prepaid credits.
              </p>
            </div>
          </div>

          <!-- Manage Billing -->
          <button
            v-if="subscription.tier.value !== 'free'"
            @click="handleManageBilling"
            class="btn-material w-full py-3 text-sm font-semibold"
            style="
              background: var(--color-primary-muted);
              color: var(--color-primary);
              border-color: var(--color-primary);
            "
          >
            Manage Billing
          </button>
        </div>
      </div>

      <!-- Models Tab (Read-Only Catalog) -->
      <div v-if="activeTab === 'models'" class="flex-1 overflow-y-auto p-8">
        <div class="max-w-3xl">
          <h2 class="text-lg font-bold mb-1" style="color: var(--color-text-primary)">
            Model Catalog
          </h2>
          <p class="text-xs mb-6" style="color: var(--color-text-tertiary)">
            {{ availableModels.length }} models available. Select models from the chat input
            dropdown.
          </p>

          <div v-for="cat in CATEGORY_ORDER" :key="cat" class="mb-6">
            <div class="flex items-center gap-2 mb-3">
              <h3 class="text-sm font-bold" style="color: var(--color-text-primary)">
                {{ CATEGORY_LABELS[cat] }}
              </h3>
              <span
                v-if="!subscription.canAccessCategory(cat)"
                class="text-[10px] font-bold px-2 py-0.5 rounded"
                style="
                  background: rgba(249, 115, 22, 0.2);
                  color: rgb(249, 115, 22);
                  border: 1px solid rgba(249, 115, 22, 0.3);
                "
              >
                {{ CATEGORY_MIN_TIER[cat] === 'pro' ? 'Pro+' : 'Max' }}
              </span>
            </div>

            <div
              v-if="!subscription.canAccessCategory(cat)"
              class="rounded-lg p-4 mb-3"
              style="background: rgba(255, 255, 255, 0.03); border: 1px solid var(--color-border)"
            >
              <p class="text-xs font-medium" style="color: var(--color-text-tertiary)">
                Upgrade to {{ CATEGORY_MIN_TIER[cat] === 'pro' ? 'Pro' : 'Max' }} to access
                {{ CATEGORY_LABELS[cat].toLowerCase() }} models.
              </p>
            </div>

            <div
              class="grid grid-cols-2 gap-3"
              :class="{ 'opacity-40': !subscription.canAccessCategory(cat) }"
            >
              <div
                v-for="model in modelsInCategory(cat)"
                :key="model.id"
                class="p-4 rounded-lg"
                style="
                  background: var(--color-background-secondary);
                  border: 1px solid var(--color-border);
                "
              >
                <div class="flex items-center gap-2 mb-1">
                  <h4 class="text-sm font-bold truncate" style="color: var(--color-text-primary)">
                    {{ model.name }}
                  </h4>
                </div>
                <p class="text-xs mb-2 truncate" style="color: var(--color-text-tertiary)">
                  {{ model.provider }}
                </p>
                <div class="flex flex-wrap gap-2 text-xs" style="color: var(--color-text-tertiary)">
                  <span>{{ formatContextLength(model.contextLength) }} ctx</span>
                  <span
                    >${{ formatPrice(model.pricing.prompt) }}/${{
                      formatPrice(model.pricing.completion)
                    }}
                    /1M</span
                  >
                </div>
              </div>
            </div>
          </div>

          <!-- Refresh -->
          <div class="mt-4 pt-4 border-t" style="border-color: var(--color-border)">
            <button
              @click="handleRefreshModels"
              :disabled="isRefreshingModels"
              class="btn-material w-full py-3 text-sm font-semibold flex items-center justify-center gap-2"
              :style="
                isRefreshingModels
                  ? 'opacity: 0.6; cursor: not-allowed;'
                  : 'background: var(--color-primary-muted); color: var(--color-primary); border-color: var(--color-primary);'
              "
            >
              <svg
                v-if="!isRefreshingModels"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <path
                  d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"
                />
              </svg>
              <svg
                v-if="isRefreshingModels"
                class="animate-spin"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <path d="M21 12a9 9 0 1 1-6.219-8.56" />
              </svg>
              {{ isRefreshingModels ? 'Refreshing...' : 'Refresh Model List' }}
            </button>
            <p
              v-if="props.settings.lastModelRefresh"
              class="text-[10px] text-center mt-2"
              style="color: var(--color-text-tertiary)"
            >
              Last refreshed {{ formatLastRefresh() }}
            </p>
          </div>
        </div>
      </div>

      <!-- Account Tab -->
      <div v-if="activeTab === 'account'" class="flex-1 overflow-y-auto p-8">
        <div class="max-w-2xl">
          <!-- Signed-in user (non-anonymous) -->
          <div v-if="currentUser && !currentUser.isAnonymous" class="mb-8">
            <h2 class="text-lg font-bold mb-4" style="color: var(--color-text-primary)">
              Account Information
            </h2>

            <div
              class="rounded-lg p-4 mb-4"
              style="
                background: var(--color-background-secondary);
                border: 1px solid var(--color-border);
              "
            >
              <div class="flex items-center justify-between mb-3">
                <span class="text-sm font-semibold" style="color: var(--color-text-tertiary)"
                  >Email</span
                >
                <span class="text-sm font-medium" style="color: var(--color-text-primary)">{{
                  currentUser.email || 'Not available'
                }}</span>
              </div>
              <div v-if="currentUser.displayName" class="flex items-center justify-between">
                <span class="text-sm font-semibold" style="color: var(--color-text-tertiary)"
                  >Display Name</span
                >
                <span class="text-sm font-medium" style="color: var(--color-text-primary)">{{
                  currentUser.displayName
                }}</span>
              </div>
            </div>

            <div
              class="rounded-lg p-4 mb-6"
              style="background: var(--color-success-bg); border: 1px solid rgba(34, 197, 94, 0.3)"
            >
              <p
                class="text-xs leading-relaxed font-medium"
                style="color: var(--color-text-primary)"
              >
                You are signed in. Your data is securely synced to the cloud.
              </p>
            </div>

            <button
              @click="emit('logout')"
              :disabled="isAuthenticating"
              class="btn-material px-6 py-3 font-semibold w-full flex items-center justify-center gap-2"
              :style="
                isAuthenticating
                  ? 'opacity: 0.6; cursor: not-allowed;'
                  : 'background: var(--color-error); border-color: var(--color-error);'
              "
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              {{ isAuthenticating ? 'Signing out...' : 'Sign Out' }}
            </button>
          </div>

          <!-- Anonymous or not signed in -->
          <div v-else class="mb-8">
            <div
              class="rounded-lg p-6 text-center"
              style="
                background: var(--color-background-secondary);
                border: 1px solid var(--color-border);
              "
            >
              <svg
                class="mx-auto mb-4"
                width="48"
                height="48"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                style="color: var(--color-text-tertiary)"
              >
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
              <p class="text-sm font-medium mb-2" style="color: var(--color-text-primary)">
                Not signed in
              </p>
              <p class="text-xs" style="color: var(--color-text-tertiary)">
                Sign in with Google to sync your data across devices and keep your conversations
                safe.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import type { Settings, LLMModel, ModelCategory } from '../types';
import { CATEGORY_ORDER, CATEGORY_LABELS, CATEGORY_MIN_TIER } from '../types';
import { useSubscription } from '../composables/useSubscription';
import { sortModels } from '../services/openrouter';

interface Props {
  settings: Settings;
  currentUser?: {
    uid: string;
    email: string | null;
    displayName: string | null;
    isAnonymous?: boolean;
  } | null;
  isAuthenticating?: boolean;
}

interface Emits {
  (e: 'save', settings: Settings): void;
  (e: 'close'): void;
  (e: 'logout'): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const subscription = useSubscription();

const tabs: Array<{ id: 'plan' | 'models' | 'account'; name: string }> = [
  { id: 'plan', name: 'Plan & Usage' },
  { id: 'models', name: 'Models' },
  { id: 'account', name: 'Account' },
];

const activeTab = ref<'plan' | 'models' | 'account'>('plan');

// Models state
const availableModels = computed(() => subscription.availableModels.value);
const sortedModels = computed(() => sortModels([...availableModels.value]));

// Plan tab state
const isUpgrading = ref(false);
const isBuyingCredits = ref(false);
const customTopupAmount = ref<number | null>(null);

// Models tab state
const isRefreshingModels = ref(false);

const tierBadgeStyle = computed(() => {
  const styles: Record<string, string> = {
    free: 'background: rgba(34,197,94,0.15); color: rgb(34,197,94); border: 1px solid rgba(34,197,94,0.3);',
    pro: 'background: rgba(59,130,246,0.15); color: rgb(59,130,246); border: 1px solid rgba(59,130,246,0.3);',
    max: 'background: rgba(168,85,247,0.15); color: rgb(168,85,247); border: 1px solid rgba(168,85,247,0.3);',
  };
  return styles[subscription.tier.value] || styles.free;
});

const subscriptionProgressWidth = computed(() => {
  const tierCredits: Record<string, number> = { free: 200, pro: 2000, max: 12000 };
  const max = tierCredits[subscription.tier.value] || 200;
  const pct = Math.min(100, (subscription.subscriptionCredits.value / max) * 100);
  return `${pct}%`;
});

function modelsInCategory(cat: ModelCategory): LLMModel[] {
  return sortedModels.value.filter((m) => m.category === cat);
}

function formatContextLength(length: number): string {
  if (length >= 1000000) return `${(length / 1000000).toFixed(1)}M`;
  if (length >= 1000) return `${(length / 1000).toFixed(0)}K`;
  return length.toString();
}

function formatPrice(price: number): string {
  if (price === 0) return '0';
  if (price < 0.01) return price.toFixed(4);
  if (price < 1) return price.toFixed(2);
  return price.toFixed(2);
}

function formatLastRefresh(): string {
  if (!props.settings.lastModelRefresh) return 'Never';
  const diff = Date.now() - props.settings.lastModelRefresh;
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)} min ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return new Date(props.settings.lastModelRefresh).toLocaleDateString();
}

async function handleRefreshModels() {
  if (isRefreshingModels.value) return;
  isRefreshingModels.value = true;
  try {
    await subscription.refreshModels();
    emit('save', { ...props.settings, lastModelRefresh: Date.now() });
  } catch (error) {
    console.error('[SettingsPage] Failed to refresh models:', error);
    alert('Failed to refresh models. Please check your connection and try again.');
  } finally {
    isRefreshingModels.value = false;
  }
}

async function handleUpgrade(tier: 'pro' | 'max') {
  isUpgrading.value = true;
  try {
    await subscription.upgradeToTier(tier);
  } catch (error) {
    console.error('Failed to start checkout:', error);
    alert('Failed to start checkout. Please try again.');
  } finally {
    isUpgrading.value = false;
  }
}

async function handleBuyCredits(amountCents: number) {
  isBuyingCredits.value = true;
  try {
    await subscription.buyCredits(amountCents);
  } catch (error) {
    console.error('Failed to start top-up:', error);
    alert('Failed to start top-up. Please try again.');
  } finally {
    isBuyingCredits.value = false;
  }
}

async function handleCustomTopup() {
  if (!customTopupAmount.value || customTopupAmount.value < 5) return;
  await handleBuyCredits(Math.round(customTopupAmount.value * 100));
}

async function handleManageBilling() {
  try {
    await subscription.openBillingPortal();
  } catch (error) {
    console.error('Failed to open billing portal:', error);
    alert('Failed to open billing portal. Please try again.');
  }
}

function handleBack() {
  emit('close');
}
</script>

<style scoped>
.animate-spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
</style>
