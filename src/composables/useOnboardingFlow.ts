import { ref, nextTick, type Ref } from 'vue';
import type { River, Settings, LLMModel } from '../types';
import { resolveModelIds, DEFAULT_MODEL_ID } from '../types';
import type { usePostHog } from './usePostHog';
import type { useOnboardingTour } from './useOnboardingTour';
import type { ChatPanelUser } from './useChatPanel';

const ONBOARDING_VARIANTS = ['control', 'inline-chat', 'auto-river'];

export interface OnboardingFlowDeps {
  analytics: ReturnType<typeof usePostHog>;
  tour: ReturnType<typeof useOnboardingTour>;
  settings: Ref<Settings>;
  updateSettings: (newSettings: Partial<Settings>, immediate?: boolean) => Promise<void>;
  currentUser: Ref<ChatPanelUser | null>;
  allRivers: Ref<River[]>;
  currentRiver: Ref<River | null>;
  createRiver: (name: string) => Promise<River>;
  isNewRootMode: Ref<boolean>;
  showWelcome: Ref<boolean>;
  showOnboarding: Ref<boolean>;
  availableModels: Ref<LLMModel[]>;
  sendMessage: (content: string, models: LLMModel[], webSearchEnabled: boolean) => Promise<void>;
}

/**
 * New-user onboarding flow (extracted from App.vue): A/B variant selection,
 * auto-created first river, first-message handling, tour milestone
 * persistence, and contextual sign-in prompts for anonymous users.
 */
export function useOnboardingFlow(deps: OnboardingFlowDeps) {
  // A/B tested onboarding: control = WelcomeModal, inline-chat = OnboardingModal
  const onboardingVariant = ref<string>('control');

  // Contextual sign-in prompt banner (anonymous users)
  const authPromptMessage = ref('');
  const showAuthPrompt = ref(false);

  /** Initialize the tour from saved settings and stamp the first visit. */
  function initFromSettings() {
    deps.tour.initFromSettings(deps.settings.value);
    if (!deps.settings.value.firstVisitTimestamp) {
      deps.settings.value.firstVisitTimestamp = Date.now();
    }
  }

  /** Determine onboarding variant via PostHog feature flag. */
  function resolveVariant() {
    const variant = deps.analytics.getFeatureFlag('onboarding-variant');
    onboardingVariant.value =
      typeof variant === 'string' && ONBOARDING_VARIANTS.includes(variant)
        ? variant
        : 'inline-chat'; // default to new experience
  }

  /**
   * New user onboarding: auto-create a river and open the chat panel so they
   * can start chatting immediately, then show the onboarding modal on top.
   * Call after the app has initialized.
   */
  async function startIfNewUser() {
    if (
      (deps.currentUser.value && !deps.currentUser.value.isAnonymous) ||
      deps.allRivers.value.length !== 0
    ) {
      return;
    }

    try {
      await deps.createRiver('My First River');
      deps.isNewRootMode.value = true;
      deps.analytics.capture('onboarding_river_auto_created');
    } catch (_error) {
      console.error('[App] Failed to auto-create onboarding river:', _error);
    }

    deps.analytics.capture('onboarding_variant_shown', { variant: onboardingVariant.value });
    if (onboardingVariant.value === 'control') {
      deps.showWelcome.value = true;
    } else if (onboardingVariant.value === 'inline-chat') {
      deps.showOnboarding.value = true;
    }
    // 'auto-river' variant: skip modal entirely, user sees the river + chat input directly
  }

  /** Handle the first message sent from the OnboardingModal. */
  async function handleFirstMessage(content: string) {
    deps.showOnboarding.value = false;
    deps.analytics.capture('first_message_sent', { source: 'onboarding_modal' });

    // Let the modal close and any pending state updates flush before we
    // read currentRiver, so we can't race the auto-created river.
    await nextTick();

    // If no river exists yet (shouldn't happen since we auto-create, but safety)
    if (!deps.currentRiver.value) {
      const name = content.slice(0, 30) + (content.length > 30 ? '...' : '');
      await deps.createRiver(name);
      deps.isNewRootMode.value = true;
    }

    // Resolve default models and send
    const models = resolveModelIds(
      deps.settings.value.selectedModelIds.length > 0
        ? deps.settings.value.selectedModelIds
        : [DEFAULT_MODEL_ID],
      deps.availableModels.value
    );
    if (models.length > 0) {
      await deps.sendMessage(content, models, false);
    }
  }

  /** Persist current tour milestone state into settings. */
  function persistTourState() {
    deps.updateSettings({ ...deps.settings.value, ...deps.tour.getSettingsUpdate() });
  }

  /** Record a sent message: tour milestone + contextual auth prompt checks. */
  function recordMessageMilestones() {
    deps.tour.recordMessage();
    persistTourState();
    checkAuthPromptMilestones();
  }

  /** Record that AI responses arrived (tour milestone). */
  function recordAIResponse() {
    deps.tour.recordAIResponse();
  }

  /** Dismiss a tour tooltip and persist. */
  function dismissTip(tipId: string) {
    deps.tour.dismissTip(tipId);
    persistTourState();
  }

  function dismissAllTips() {
    deps.tour.dismissAll();
    persistTourState();
  }

  /** Check milestones to trigger contextual auth prompts (anonymous users only). */
  function checkAuthPromptMilestones() {
    if (!deps.currentUser.value?.isAnonymous) return;

    const count = deps.tour.messageCount.value;
    if (count === 3) {
      authPromptMessage.value = 'Sign in to save your conversations across devices';
      showAuthPrompt.value = true;
      deps.analytics.capture('upgrade_prompt_shown', {
        source: 'auth_banner',
        trigger: 'third_message',
      });
    } else if (deps.allRivers.value.length >= 2 && count >= 5) {
      authPromptMessage.value = `You have ${deps.allRivers.value.length} conversations. Sign in to keep them safe.`;
      showAuthPrompt.value = true;
      deps.analytics.capture('upgrade_prompt_shown', {
        source: 'auth_banner',
        trigger: 'multiple_rivers',
      });
    } else if (
      deps.settings.value.firstVisitTimestamp &&
      Date.now() - deps.settings.value.firstVisitTimestamp > 7 * 24 * 60 * 60 * 1000
    ) {
      authPromptMessage.value =
        "You've been using RiverChat for a week. Sign in to sync your data.";
      showAuthPrompt.value = true;
      deps.analytics.capture('upgrade_prompt_shown', {
        source: 'auth_banner',
        trigger: 'seven_days',
      });
    }
  }

  return {
    onboardingVariant,
    authPromptMessage,
    showAuthPrompt,
    initFromSettings,
    resolveVariant,
    startIfNewUser,
    handleFirstMessage,
    recordMessageMilestones,
    recordAIResponse,
    dismissTip,
    dismissAllTips,
  };
}
