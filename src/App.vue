<template>
  <div
    class="w-screen h-screen overflow-hidden relative"
    style="background: var(--color-background)"
    :data-initialized="hasInitialized || undefined"
  >
    <!-- Floating App Title and Navigation (Top Left) -->
    <AppHeader
      v-if="!showSettings"
      :river-name="currentRiver?.name ?? null"
      :current-user="currentUser"
      :is-authenticating="isAuthenticating"
      @show-rivers="handleShowRiverDashboard"
      @show-help="showHelp = true"
      @show-settings="showSettings = true"
      @show-auth="showAuth = true"
    />

    <!-- Main Content -->
    <div class="flex h-screen">
      <!-- Left Panel: Graph Canvas -->
      <div class="flex-1 relative overflow-hidden">
        <GraphCanvas
          ref="graphCanvas"
          v-if="currentRiver"
          :nodes="currentRiver.nodes"
          :root-node-id="currentRiver.rootNodeId"
          :selected-node-id="selectedNodeId"
          :show-minimap="showMinimap"
          @node-select="selectNode"
          @node-double-click="handleNodeDoubleClick"
          @branch-from="handleBranchFrom"
          @regenerate="regenerate"
          @edit-resubmit="requestEditResubmit"
          @delete-branch="requestDeleteBranch"
          @delete-branches-batch="requestDeleteBranchesBatch"
          @update-position="updateNodePosition"
          @update-positions-batch="updateNodePositionsBatch"
          @copy-message="handleCopyMessage"
          @create-root-node="handleCreateRootNode"
          @pane-click="handlePaneClick"
          @selection-change="handleSelectionChange"
        />

        <!-- New Root Node Button (Floating - top right) -->
        <button
          v-if="
            currentRiver &&
            !selectedNodeId &&
            !isNewRootMode &&
            !hasMultipleNodesSelected &&
            !showSettings
          "
          @click="handleCreateRootNode"
          class="fixed top-4 right-4 z-50 btn-material px-5 py-2.5 text-sm font-bold flex items-center gap-2 shadow-elevation-3"
        >
          <PhPlus :size="16" />
          <span>New Root Node</span>
        </button>

        <div
          v-if="!currentRiver"
          class="flex items-center justify-center h-full"
          style="background: var(--color-background)"
        >
          <div class="text-center">
            <h2
              class="text-2xl font-semibold mb-3"
              style="color: var(--color-text-primary); letter-spacing: -0.02em"
            >
              Welcome to RiverChat
            </h2>
            <p class="text-sm mb-6 font-medium" style="color: var(--color-text-secondary)">
              Create a new river to start your first conversation
            </p>
            <button
              @click="showCreateRiver = true"
              class="btn-material"
              style="padding: 10px 20px; font-size: 14px; font-weight: 600"
            >
              + Create River
            </button>
          </div>
        </div>
      </div>

      <!-- Right Panel: Chat History -->
      <div
        ref="chatPanel"
        v-if="(selectedNodeId || isNewRootMode) && !hasMultipleNodesSelected && !showChatModal"
        class="flex flex-col relative"
        :style="{
          width: `${chatPanelWidth}px`,
          borderLeft: '1px solid var(--color-border)',
          background: 'var(--color-background-secondary)',
        }"
      >
        <!-- Resize Handle -->
        <div class="resize-handle z-10" @mousedown="startResize"></div>

        <ChatHistory
          :path="currentPath"
          :selected-node-id="selectedNodeId"
          :is-new-root-mode="isNewRootMode"
          :all-nodes="currentRiver?.nodes || {}"
          :settings="settings"
          :is-sending="isSendingMessage"
          :current-user="currentUser"
          @send="sendMessage"
          @resend="resend"
          @node-select="selectNode"
          @branch-from-text="branchFromSelection"
          @chat-model-changed="handleChatModelChanged"
          @close="handleCloseChatPanel"
          @pop-out="handlePopOutChat"
        />
      </div>
    </div>

    <!-- Onboarding Tooltip -->
    <OnboardingTooltip
      :visible="!!tour.activeTip.value && !showSettings && !showWelcome && !showOnboarding"
      :tip="tour.activeTip.value"
      @dismiss="onboarding.dismissTip"
      @dismiss-all="onboarding.dismissAllTips"
    />

    <!-- Auth Prompt Banner -->
    <AuthPromptBanner
      v-if="currentUser?.isAnonymous && !showAuth && !showWelcome && !showOnboarding"
      :visible="showAuthPrompt"
      :message="authPromptMessage"
      @sign-up="
        showAuth = true;
        analytics.capture('upgrade_prompt_clicked', { source: 'auth_banner' });
      "
    />

    <!-- Modals -->
    <!-- A/B tested onboarding: control = WelcomeModal, inline-chat = OnboardingModal -->
    <WelcomeModal
      v-if="onboardingVariant === 'control'"
      :is-open="showWelcome"
      :can-dismiss="true"
      @close="showWelcome = false"
    />
    <OnboardingModal
      v-else
      :is-open="showOnboarding"
      :can-dismiss="true"
      @send-first-message="onboarding.handleFirstMessage"
      @skip="showOnboarding = false"
    />

    <SettingsPage
      v-if="showSettings"
      :settings="settings"
      :current-user="currentUser"
      :is-authenticating="isAuthenticating"
      @save="handleSaveSettings"
      @close="showSettings = false"
      @logout="logout"
    />

    <RiverDashboard
      :is-open="showRiverDashboard"
      :rivers="allRivers || []"
      :active-river-id="currentRiver?.id || null"
      :is-loading="isRiverOperationLoading"
      @create="riverOps.create"
      @open="riverOps.open"
      @rename="riverOps.rename"
      @delete="riverOps.remove"
      @close="showRiverDashboard = false"
    />

    <MessageViewerModal
      :is-open="showMessageViewer"
      :message="viewingMessage"
      @close="showMessageViewer = false"
    />

    <ConfirmationModal
      :is-open="deleteConfirmation.isOpen"
      title="Delete Branch?"
      message="Are you sure you want to delete this branch? All messages in this branch and its children will be permanently deleted."
      confirm-text="Delete"
      cancel-text="Cancel"
      :is-dangerous="true"
      @confirm="confirmDeleteBranch"
      @close="deleteConfirmation.isOpen = false"
    />

    <EditResubmitModal
      :is-open="editConfirmation.isOpen"
      v-model="editConfirmation.content"
      @confirm="confirmEditResubmit"
      @close="editConfirmation.isOpen = false"
    />

    <ConfirmationModal
      :is-open="deleteBatchConfirmation.isOpen"
      title="Delete Multiple Nodes?"
      :message="`Are you sure you want to delete ${deleteBatchConfirmation.nodeIds.length} selected nodes? All messages in these branches and their children will be permanently deleted.`"
      confirm-text="Delete All"
      cancel-text="Cancel"
      :is-dangerous="true"
      @confirm="confirmDeleteBranchesBatch"
      @close="deleteBatchConfirmation.isOpen = false"
    />

    <KeyboardShortcutsModal :is-open="showHelp" @close="showHelp = false" />

    <ChatModal
      v-if="showChatModal"
      :is-open="showChatModal"
      :path="currentPath"
      :selected-node-id="selectedNodeId"
      :is-new-root-mode="isNewRootMode"
      :all-nodes="currentRiver?.nodes || {}"
      :settings="settings"
      :is-sending="isSendingMessage"
      :current-user="currentUser"
      @send="sendMessage"
      @resend="resend"
      @node-select="selectNode"
      @branch-from-text="branchFromSelection"
      @chat-model-changed="handleChatModelChanged"
      @close="showChatModal = false"
    />

    <!-- Auth Modal -->
    <AuthModal
      :is-open="showAuth"
      :river-count="allRivers?.length ?? 0"
      :message-count="totalMessageCount"
      @close="showAuth = false"
      @authenticated="handleAuthenticated"
    />

    <!-- Create River Modal -->
    <CreateRiverModal
      :is-open="showCreateRiver"
      @create="riverOps.createFromModal"
      @close="
        showCreateRiver = false;
        clearPendingMessage();
      "
    />

    <!-- Credit Warning Banner -->
    <CreditWarningBanner
      v-if="hasInitialized && subscription.tier.value === 'free'"
      :is-low="subscription.isLowBalance.value"
      :is-critical="subscription.isCriticalBalance.value"
      :is-zero="subscription.isZeroBalance.value"
      @upgrade="handleCreditWarningUpgrade('pro')"
      @upgrade-to="handleCreditWarningUpgrade"
    />

    <!-- Toast Notification (z-index scale documented in style.css) -->
    <div v-if="toast.visible && !showSettings" class="toast z-[800]" :class="`toast-${toast.type}`">
      {{ toast.message }}
    </div>

    <!-- Loading Overlay -->
    <div v-if="isLoading" class="loading-overlay z-[700]">
      <div class="loading-content"><div class="loading-spinner"></div></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch, defineAsyncComponent } from 'vue';
import { useRiverChat } from './composables/useRiverChat';
import { usePostHog } from './composables/usePostHog';
import { useOnboardingTour } from './composables/useOnboardingTour';
import { useModals } from './composables/useModals';
import { useKeyboardShortcuts } from './composables/useKeyboardShortcuts';
import { useToast } from './composables/useToast';
import { useResizablePanel } from './composables/useResizablePanel';
import { useAuthLifecycle } from './composables/useAuthLifecycle';
import { useNodeConfirmations } from './composables/useNodeConfirmations';
import { useMessaging } from './composables/useMessaging';
import { useRiverOperations } from './composables/useRiverOperations';
import { useOnboardingFlow } from './composables/useOnboardingFlow';
import { useCheckoutRedirect } from './composables/useCheckoutRedirect';
import { copyToClipboard } from './composables/useClipboard';
import type { MessageNode, Settings } from './types';
import { PhPlus } from '@phosphor-icons/vue';

// Critical components loaded immediately
import AppHeader from './components/AppHeader.vue';
import GraphCanvas from './components/GraphCanvas.vue';
import ChatHistory from './components/ChatHistory.vue';
import EditResubmitModal from './components/EditResubmitModal.vue';
import WelcomeModal from './components/WelcomeModal.vue';

// Non-critical components lazy loaded
const ChatModal = defineAsyncComponent(() => import('./components/ChatModal.vue'));
const OnboardingModal = defineAsyncComponent(() => import('./components/OnboardingModal.vue'));
const OnboardingTooltip = defineAsyncComponent(() => import('./components/OnboardingTooltip.vue'));
const AuthPromptBanner = defineAsyncComponent(() => import('./components/AuthPromptBanner.vue'));
const SettingsPage = defineAsyncComponent(() => import('./components/SettingsPage.vue'));
const RiverDashboard = defineAsyncComponent(() => import('./components/RiverDashboard.vue'));
const MessageViewerModal = defineAsyncComponent(
  () => import('./components/MessageViewerModal.vue')
);
const ConfirmationModal = defineAsyncComponent(() => import('./components/ConfirmationModal.vue'));
const KeyboardShortcutsModal = defineAsyncComponent(
  () => import('./components/KeyboardShortcutsModal.vue')
);
const AuthModal = defineAsyncComponent(() => import('./components/AuthModal.vue'));
const CreateRiverModal = defineAsyncComponent(() => import('./components/CreateRiverModal.vue'));
const CreditWarningBanner = defineAsyncComponent(
  () => import('./components/CreditWarningBanner.vue')
);

const {
  currentRiver,
  settings,
  selectedNodeId,
  allRivers,
  isLoading,
  subscription,
  createRiver,
  loadRiver,
  deleteRiver,
  renameRiver,
  refreshRivers,
  createUserNode,
  generateAIResponse,
  branchFromText,
  deleteNode,
  updateNodeContent,
  updateNodePosition,
  updateNodePositionsBatch,
  getPathToNode,
  updateSettings,
  selectNode,
  clearState,
  initialize,
} = useRiverChat();

const analytics = usePostHog();
const tour = useOnboardingTour();

// Modal states (open/close toggles live in the useModals composable)
const modals = useModals();
const {
  showWelcome,
  showSettings,
  showRiverDashboard,
  showMessageViewer,
  showHelp,
  showChatModal,
  showAuth,
  showCreateRiver,
  showOnboarding,
} = modals;

// App-shell UI state
const viewingMessage = ref<MessageNode | null>(null);
const isNewRootMode = ref(false);
const hasMultipleNodesSelected = ref(false);
const hasInitialized = ref(false);
const showMinimap = ref(true);
const graphCanvas = ref<InstanceType<typeof GraphCanvas> | null>(null);

const { toast, showToast } = useToast();

// Resizable chat panel
const {
  panelWidth: chatPanelWidth,
  panelEl: chatPanel,
  startResize,
  restoreSavedWidth,
} = useResizablePanel();

// Current conversation path
const currentPath = computed(() => {
  if (!selectedNodeId.value) return [];
  return getPathToNode(selectedNodeId.value);
});

// Total message count across all rivers (for auth modal)
const totalMessageCount = computed(() => {
  if (!allRivers.value) return 0;
  return allRivers.value.reduce((sum, r) => sum + Object.keys(r.nodes).length, 0);
});

// Authentication lifecycle (cached-auth restore, session bootstrap,
// auth-change re-initialization, logout)
const authLifecycle = useAuthLifecycle({
  initialize,
  clearSelectedModels: () => {
    settings.value.selectedModelIds = [];
  },
  clearState,
  showToast,
});
const { currentUser, isAuthenticating, logout } = authLifecycle;

// Message sending / resending / branching / regeneration
const messaging = useMessaging({
  currentRiver,
  currentPath,
  isNewRootMode,
  settings,
  availableModels: subscription.availableModels,
  createUserNode,
  generateAIResponse,
  branchFromText,
  selectNode,
  analytics,
  showToast,
  onRequireRiver: () => {
    showCreateRiver.value = true;
  },
  // `onboarding` is declared below; these run long after setup completes
  onMessageSent: () => onboarding.recordMessageMilestones(),
  onResponsesSettled: () => onboarding.recordAIResponse(),
});
const {
  isSendingMessage,
  sendMessage,
  resend,
  branchFromSelection,
  regenerate,
  clearPendingMessage,
} = messaging;

// River CRUD with loading state and toasts
const riverOps = useRiverOperations({
  allRivers,
  currentRiver,
  createRiver,
  loadRiver,
  renameRiver,
  deleteRiver,
  analytics,
  showToast,
  consumePendingMessage: messaging.consumePendingMessage,
  sendMessage,
});
const { isRiverOperationLoading } = riverOps;

// New-user onboarding flow (variant selection, auto river, auth prompts)
const onboarding = useOnboardingFlow({
  analytics,
  tour,
  settings,
  updateSettings,
  currentUser,
  allRivers,
  currentRiver,
  createRiver,
  isNewRootMode,
  showWelcome,
  showOnboarding,
  availableModels: subscription.availableModels,
  sendMessage,
});
const { onboardingVariant, authPromptMessage, showAuthPrompt } = onboarding;

// Destructive-action confirmation dialogs (delete branch, batch delete,
// edit & resubmit)
const confirmations = useNodeConfirmations({
  currentRiver,
  settings,
  availableModels: subscription.availableModels,
  deleteNode,
  updateNodeContent,
  generateAIResponse,
  showToast,
  onBatchDeleteDone: () => {
    hasMultipleNodesSelected.value = false;
  },
});
const {
  deleteConfirmation,
  deleteBatchConfirmation,
  editConfirmation,
  requestDeleteBranch,
  requestDeleteBranchesBatch,
  requestEditResubmit,
  confirmDeleteBranch,
  confirmDeleteBranchesBatch,
  confirmEditResubmit,
} = confirmations;

// Stripe checkout/top-up redirect handling
const checkout = useCheckoutRedirect({
  analytics,
  showToast,
  refreshBalance: subscription.refreshBalance,
  refreshModels: subscription.refreshModels,
});

// Update page title when river changes
watch(
  currentRiver,
  (river) => {
    if (river) {
      document.title = `${river.name} - RiverChat`;
    } else {
      document.title = 'RiverChat - Branching AI Conversations | Chat with Multiple AI Models';
    }
  },
  { immediate: true }
);

// Track user properties when they change
watch(
  () => currentRiver.value,
  (river) => {
    if (river && currentUser.value) {
      analytics.setUserProperties({
        river_count: allRivers.value.length,
        active_river_node_count: Object.keys(river.nodes).length,
      });
    }
  },
  { deep: false }
);

// Initialize app
onMounted(async () => {
  // Optimistic render from cached auth, then wait for a real session
  // (anonymous sign-in if needed) so cloud function calls have a valid token
  authLifecycle.restoreCachedUser();
  await authLifecycle.ensureSession();

  // Initialize the app with cached data (auth is now guaranteed to be ready)
  await initialize();
  hasInitialized.value = true;

  // Listen to authentication state changes
  authLifecycle.listenForAuthChanges();

  // Load saved chat panel width from session storage
  restoreSavedWidth();

  // Onboarding: tour state, A/B variant, and new-user auto river
  onboarding.initFromSettings();
  onboarding.resolveVariant();
  await onboarding.startIfNewUser();

  // Handle Stripe checkout redirects
  checkout.handleRedirectParams();

  // Setup keyboard shortcuts (unregistered automatically on unmount)
  keyboardShortcuts.register();

  // Set dark theme on body
  document.body.className = 'dark-theme';
});

// Credit warning handler
function handleCreditWarningUpgrade(tier: 'pro' | 'max') {
  analytics.capture('upgrade_prompt_clicked', { source: 'credit_warning', target_tier: tier });
  subscription.upgradeToTier(tier);
}

// Authentication handlers
async function handleAuthenticated() {
  // Close the auth modal — onAuthStateChanged will handle re-initialization
  // (signInWithGoogle fires onAuthStateChanged before returning, so initialize()
  // is already triggered by the time this runs)
  showAuth.value = false;
  showToast('Successfully signed in!', 'success');
}

// Settings Management
async function handleSaveSettings(newSettings: Settings) {
  await updateSettings(newSettings);
  showSettings.value = false;
  showToast('Settings saved', 'success');
}

// River Management
async function handleShowRiverDashboard() {
  // Refresh rivers to get latest node counts
  await refreshRivers(true);
  showRiverDashboard.value = true;
}

// Node Interactions
function handleNodeDoubleClick(node: MessageNode) {
  viewingMessage.value = node;
  showMessageViewer.value = true;
}

async function handleBranchFrom(nodeId: string) {
  selectNode(nodeId);
  showToast('Branch from this node by sending a new message', 'info');
}

async function handleCopyMessage(content: string) {
  if (await copyToClipboard(content)) {
    showToast('Message copied to clipboard', 'success');
  } else {
    showToast('Failed to copy to clipboard', 'error');
  }
}

function handleCreateRootNode() {
  // Enter new root mode - open chat window for new conversation
  selectNode(null);
  isNewRootMode.value = true;
}

function handlePaneClick() {
  // Hide chat when clicking on canvas
  isNewRootMode.value = false;
}

function handleSelectionChange(hasMultiple: boolean) {
  hasMultipleNodesSelected.value = hasMultiple;
}

async function handleChatModelChanged(modelIds: string[]) {
  // Persist to database immediately (bypass debounce for real-time persistence)
  await updateSettings({ selectedModelIds: modelIds }, true);
}

function handleCloseChatPanel() {
  selectNode(null);
  isNewRootMode.value = false;
}

function handlePopOutChat() {
  showChatModal.value = true;
}

// Check if any modal or overlay is currently open
function isAnyModalOpen(): boolean {
  return modals.isAnyOpen() || confirmations.isAnyConfirmationOpen();
}

// Keyboard shortcuts (handler logic lives in useKeyboardShortcuts;
// registered in onMounted, unregistered automatically on unmount)
const keyboardShortcuts = useKeyboardShortcuts({
  modals,
  deleteConfirmation,
  editConfirmation,
  deleteBatchConfirmation,
  currentRiver,
  selectedNodeId,
  isNewRootMode,
  isAnyModalOpen,
  selectNode,
  clearPendingMessage,
  createRootNode: handleCreateRootNode,
  branchFrom: handleBranchFrom,
  regenerate,
  editResubmit: requestEditResubmit,
  copyMessage: handleCopyMessage,
  deleteBranch: requestDeleteBranch,
  viewMessage: (node) => {
    viewingMessage.value = node;
    showMessageViewer.value = true;
  },
  toggleMinimap: handleToggleMinimap,
  zoomIn: handleZoomIn,
  zoomOut: handleZoomOut,
  zoomReset: handleZoomReset,
  selectAllNodes: handleSelectAllNodes,
  focusChatInput,
  showToast,
});

// Focus the chat input textarea (marked with data-chat-input in ChatInputArea)
function focusChatInput() {
  const chatInput = document.querySelector<HTMLTextAreaElement>('textarea[data-chat-input]');
  chatInput?.focus();
}

// Graph control functions (using exposed Vue Flow API methods)
function handleZoomIn() {
  graphCanvas.value?.zoomIn();
}

function handleZoomOut() {
  graphCanvas.value?.zoomOut();
}

function handleZoomReset() {
  graphCanvas.value?.fitView();
}

function handleToggleMinimap() {
  showMinimap.value = !showMinimap.value;
}

function handleSelectAllNodes() {
  if (currentRiver.value && graphCanvas.value) {
    const count = graphCanvas.value.selectAllNodes();
    showToast(`Selected ${count} nodes`, 'info');
  }
}
</script>

<style>
/* Loading Overlay */
.loading-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
}

.loading-content {
  display: flex;
  align-items: center;
  justify-content: center;
}

.loading-spinner {
  width: 48px;
  height: 48px;
  border: 4px solid rgba(255, 255, 255, 0.1);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.resize-handle {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 6px;
  cursor: col-resize;
  background: transparent;
  transition: background-color 0.15s ease;
  will-change: background-color;
  touch-action: none;
}

.resize-handle:hover {
  background: var(--color-primary);
  opacity: 0.3;
}

.resize-handle:active {
  background: var(--color-primary);
  opacity: 0.5;
}

/* Prevent text selection during resize */
body.resizing,
body.resizing * {
  user-select: none !important;
  cursor: col-resize !important;
}

@media (max-width: 768px) {
  .resize-handle {
    display: none;
  }
}
</style>
