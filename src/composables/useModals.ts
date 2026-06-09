import { ref } from 'vue';

/**
 * Centralized open/close state for App-level modals.
 *
 * Confirmation dialogs that carry a payload (delete/edit confirmations)
 * stay in App.vue; this composable only owns the simple boolean toggles.
 */
export function useModals() {
  const showWelcome = ref(false);
  const showSettings = ref(false);
  const showRiverDashboard = ref(false);
  const showMessageViewer = ref(false);
  const showHelp = ref(false);
  const showChatModal = ref(false);
  const showAuth = ref(false);
  const showCreateRiver = ref(false);
  const showOnboarding = ref(false);

  /** True when any of the modals owned by this composable is open. */
  function isAnyOpen(): boolean {
    return showWelcome.value || showSettings.value || showRiverDashboard.value ||
           showMessageViewer.value || showHelp.value || showChatModal.value ||
           showAuth.value || showCreateRiver.value || showOnboarding.value;
  }

  return {
    showWelcome,
    showSettings,
    showRiverDashboard,
    showMessageViewer,
    showHelp,
    showChatModal,
    showAuth,
    showCreateRiver,
    showOnboarding,
    isAnyOpen,
  };
}
