import { ref, computed } from 'vue';
import type { Settings } from '../types';

export interface TourTip {
  id: string;
  message: string;
  /** CSS selector or ref-based anchor for positioning */
  anchor: string;
  /** Milestone that triggers this tip */
  trigger: 'first_ai_response' | 'third_message' | 'fifth_message' | 'second_session';
}

const TOUR_TIPS: TourTip[] = [
  {
    id: 'click_node',
    message: 'Click any node in the graph to see the full conversation path.',
    anchor: 'graph-node',
    trigger: 'first_ai_response',
  },
  {
    id: 'add_model',
    message: 'Add another model to compare responses side by side.',
    anchor: 'add-model-button',
    trigger: 'third_message',
  },
  {
    id: 'highlight_text',
    message: 'Highlight text in any AI response to branch the conversation.',
    anchor: 'chat-message',
    trigger: 'fifth_message',
  },
  {
    id: 'new_root',
    message: 'Start a new thread in the same river to explore a different angle.',
    anchor: 'new-root-button',
    trigger: 'second_session',
  },
];

// Persisted state: which tips have been dismissed
const dismissedTips = ref<string[]>([]);
const messageCount = ref(0);
const sessionCount = ref(0);
const hasReceivedFirstAIResponse = ref(false);

export function useOnboardingTour() {
  /** Initialize from saved settings */
  function initFromSettings(settings: Settings) {
    dismissedTips.value = settings.dismissedTips ?? [];
    messageCount.value = settings.messageCount ?? 0;
    sessionCount.value = (settings.sessionCount ?? 0) + 1; // increment on load
  }

  /** Get current settings fields to persist */
  function getSettingsUpdate(): Partial<Settings> {
    return {
      dismissedTips: dismissedTips.value,
      messageCount: messageCount.value,
      sessionCount: sessionCount.value,
    };
  }

  /** Record that a message was sent */
  function recordMessage() {
    messageCount.value++;
  }

  /** Record that an AI response was received */
  function recordAIResponse() {
    hasReceivedFirstAIResponse.value = true;
  }

  /** The currently active tip (only one at a time) */
  const activeTip = computed((): TourTip | null => {
    for (const tip of TOUR_TIPS) {
      if (dismissedTips.value.includes(tip.id)) continue;

      switch (tip.trigger) {
        case 'first_ai_response':
          if (hasReceivedFirstAIResponse.value) return tip;
          break;
        case 'third_message':
          if (messageCount.value >= 3) return tip;
          break;
        case 'fifth_message':
          if (messageCount.value >= 5) return tip;
          break;
        case 'second_session':
          if (sessionCount.value >= 2) return tip;
          break;
      }
    }
    return null;
  });

  /** Dismiss the current tip */
  function dismissTip(tipId: string) {
    if (!dismissedTips.value.includes(tipId)) {
      dismissedTips.value = [...dismissedTips.value, tipId];
    }
  }

  /** Dismiss all tips at once */
  function dismissAll() {
    dismissedTips.value = TOUR_TIPS.map((tip) => tip.id);
  }

  /** Whether all tips have been completed */
  const tourComplete = computed(() =>
    TOUR_TIPS.every((tip) => dismissedTips.value.includes(tip.id))
  );

  return {
    activeTip,
    tourComplete,
    messageCount,
    initFromSettings,
    getSettingsUpdate,
    recordMessage,
    recordAIResponse,
    dismissTip,
    dismissAll,
  };
}
