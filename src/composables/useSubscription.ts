import { ref, computed } from 'vue';
import type { SubscriptionTier, LLMModel, ModelCategory, UsageMetadata } from '../types';
import { CATEGORY_MIN_TIER } from '../types';
import {
  callGetBalance,
  callGetModels,
  callCreateCheckout,
  callCreateTopupCheckout,
  callCreatePortalSession,
} from '../services/cloud-functions';
import { FALLBACK_MODELS } from '../config/models';
import { AuthService } from '../services/auth';

// Global subscription state
const tier = ref<SubscriptionTier>('free');
const subscriptionCredits = ref(0); // cents
const prepaidCredits = ref(0); // cents
const currentPeriodEnd = ref<number | null>(null);
const availableModels = ref<LLMModel[]>(FALLBACK_MODELS);
const isLoadingBalance = ref(false);
const isLoadingModels = ref(false);
const premiumTrialRemaining = ref(0);
/** Set when an anonymous user tries to buy credits; App.vue opens sign-up. */
const authRequiredForPurchase = ref(false);
/** Credit purchase to resume once the user has signed up. */
const pendingCreditPurchase = ref<number | null>(null);

export function useSubscription() {
  const totalBalance = computed(() => subscriptionCredits.value + prepaidCredits.value);

  const displayBalance = computed(() => ({
    subscription: (subscriptionCredits.value / 100).toFixed(2),
    prepaid: (prepaidCredits.value / 100).toFixed(2),
    total: (totalBalance.value / 100).toFixed(2),
  }));

  const periodEndDate = computed(() =>
    currentPeriodEnd.value ? new Date(currentPeriodEnd.value) : null
  );

  const daysUntilReset = computed(() => {
    if (!periodEndDate.value) return null;
    const now = new Date();
    const diff = periodEndDate.value.getTime() - now.getTime();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  });

  const tierOrder: Record<SubscriptionTier, number> = { free: 0, pro: 1, max: 2 };

  /** Whether the plan itself includes a category (ignores credits and trial). */
  function tierIncludesCategory(category: ModelCategory): boolean {
    const requiredTier = CATEGORY_MIN_TIER[category];
    return tierOrder[tier.value] >= tierOrder[requiredTier];
  }

  /** Mirrors resolveModelAccess() on the server. */
  function canAccessCategory(category: ModelCategory): boolean {
    if (tierIncludesCategory(category)) return true;
    if (prepaidCredits.value > 0) return true;
    return category !== 'frontier' && premiumTrialRemaining.value > 0;
  }

  /** True when a category is only available through the free trial. */
  function isTrialCategory(category: ModelCategory): boolean {
    return (
      !tierIncludesCategory(category) &&
      prepaidCredits.value <= 0 &&
      category !== 'frontier' &&
      premiumTrialRemaining.value > 0
    );
  }

  function canAccessModel(model: LLMModel): boolean {
    return canAccessCategory(model.category);
  }

  const maxModelsPerPrompt = computed(() => {
    if (tier.value === 'free') return 2;
    if (tier.value === 'pro') return 5;
    return Infinity; // max
  });

  const webSearchEnabled = computed(() => tier.value !== 'free');

  // Credit warning thresholds (for free tier only — paid tiers have enough credits)
  const isLowBalance = computed(
    () => tier.value === 'free' && totalBalance.value > 0 && totalBalance.value < 50
  );
  const isCriticalBalance = computed(
    () => tier.value === 'free' && totalBalance.value > 0 && totalBalance.value < 10
  );
  const isZeroBalance = computed(() => totalBalance.value <= 0);

  /** Refresh balance from server */
  async function refreshBalance(): Promise<void> {
    isLoadingBalance.value = true;
    try {
      const balance = await callGetBalance();
      tier.value = balance.tier;
      subscriptionCredits.value = balance.subscriptionCredits;
      prepaidCredits.value = balance.prepaidCredits;
      currentPeriodEnd.value = balance.currentPeriodEnd;
      premiumTrialRemaining.value = balance.premiumTrialRemaining ?? 0;
    } catch (error) {
      console.error('[Subscription] Failed to refresh balance:', error);
    } finally {
      isLoadingBalance.value = false;
    }
  }

  /** Load models from server */
  async function refreshModels(): Promise<void> {
    isLoadingModels.value = true;
    try {
      const models = await callGetModels();
      availableModels.value = models.length > 0 ? models : FALLBACK_MODELS;
    } catch (error) {
      console.error(
        '[Subscription] Failed to load models from server, using fallback catalog:',
        error
      );
      availableModels.value = FALLBACK_MODELS;
    } finally {
      isLoadingModels.value = false;
    }
  }

  /** Optimistically deduct balance after a message (real deduction happens server-side) */
  function applyUsageUpdate(usage: UsageMetadata): void {
    if (usage.balanceAfter) {
      subscriptionCredits.value = usage.balanceAfter.subscriptionCredits;
      prepaidCredits.value = usage.balanceAfter.prepaidCredits;
    } else {
      // Reconciliation failed server-side; refresh from server
      refreshBalance();
    }
  }

  /** Redirect to Stripe Checkout for subscription upgrade */
  async function upgradeToTier(targetTier: 'pro' | 'max'): Promise<void> {
    const url = await callCreateCheckout(targetTier);
    window.location.href = url;
  }

  /** Redirect to Stripe Checkout for credit top-up */
  async function buyCredits(amountCents: number): Promise<void> {
    if (AuthService.isAnonymous()) {
      // Credits must belong to a real account; resume after sign-up.
      pendingCreditPurchase.value = amountCents;
      authRequiredForPurchase.value = true;
      return;
    }
    pendingCreditPurchase.value = null;
    const url = await callCreateTopupCheckout(amountCents);
    window.location.href = url;
  }

  /** Open Stripe Customer Portal */
  async function openBillingPortal(): Promise<void> {
    const url = await callCreatePortalSession();
    window.open(url, '_blank');
  }

  return {
    // State
    tier,
    subscriptionCredits,
    prepaidCredits,
    currentPeriodEnd,
    availableModels,
    isLoadingBalance,
    isLoadingModels,
    premiumTrialRemaining,
    authRequiredForPurchase,
    pendingCreditPurchase,

    // Computed
    totalBalance,
    displayBalance,
    periodEndDate,
    daysUntilReset,
    maxModelsPerPrompt,
    webSearchEnabled,
    isLowBalance,
    isCriticalBalance,
    isZeroBalance,

    // Methods
    canAccessCategory,
    canAccessModel,
    tierIncludesCategory,
    isTrialCategory,
    refreshBalance,
    refreshModels,
    applyUsageUpdate,
    upgradeToTier,
    buyCredits,
    openBillingPortal,
  };
}
