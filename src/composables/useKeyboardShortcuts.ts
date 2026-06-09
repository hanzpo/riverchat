import { onUnmounted, type Ref } from 'vue';
import type { MessageNode, River } from '../types';
import type { useModals } from './useModals';

export interface KeyboardShortcutsOptions {
  // State
  modals: ReturnType<typeof useModals>;
  deleteConfirmation: Ref<{ isOpen: boolean; nodeId: string }>;
  editConfirmation: Ref<{ isOpen: boolean; nodeId: string; content: string }>;
  deleteBatchConfirmation: Ref<{ isOpen: boolean; nodeIds: string[] }>;
  currentRiver: Ref<River | null>;
  selectedNodeId: Ref<string | null>;
  isNewRootMode: Ref<boolean>;

  // Queries
  isAnyModalOpen: () => boolean;

  // Actions
  selectNode: (nodeId: string | null) => void;
  clearPendingMessage: () => void;
  createRootNode: () => void;
  branchFrom: (nodeId: string) => void;
  regenerate: (parentNodeId: string) => void;
  editResubmit: (nodeId: string) => void;
  copyMessage: (content: string) => void;
  deleteBranch: (nodeId: string) => void;
  viewMessage: (node: MessageNode) => void;
  toggleMinimap: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
  zoomReset: () => void;
  selectAllNodes: () => void;
  focusChatInput: () => void;
  showToast: (message: string, type?: 'info' | 'success' | 'error') => void;
}

/**
 * Global keyboard shortcuts for the app shell (extracted from App.vue).
 *
 * Call `register()` once the app is ready to start handling shortcuts;
 * the listener is removed automatically when the owning component unmounts.
 */
export function useKeyboardShortcuts(opts: KeyboardShortcutsOptions) {
  const {
    modals,
    deleteConfirmation,
    editConfirmation,
    deleteBatchConfirmation,
    currentRiver,
    selectedNodeId,
    isNewRootMode,
  } = opts;

  let keyboardHandler: ((e: KeyboardEvent) => void) | null = null;

  function register() {
    if (keyboardHandler) return;

    keyboardHandler = (e: KeyboardEvent) => {
      // Check if user is typing in an input/textarea/contenteditable
      const target = e.target as HTMLElement;
      const isTyping = target?.tagName === 'INPUT' ||
                       target?.tagName === 'TEXTAREA' ||
                       target?.isContentEditable;

      // Escape: Close modals one at a time (always available)
      if (e.key === 'Escape') {
        // Close in priority order: confirmation dialogs > chat modal > other modals > settings > chat panel
        if (deleteConfirmation.value.isOpen) {
          deleteConfirmation.value.isOpen = false;
        } else if (editConfirmation.value.isOpen) {
          editConfirmation.value.isOpen = false;
        } else if (deleteBatchConfirmation.value.isOpen) {
          deleteBatchConfirmation.value.isOpen = false;
        } else if (modals.showChatModal.value) {
          modals.showChatModal.value = false;
        } else if (modals.showMessageViewer.value) {
          modals.showMessageViewer.value = false;
        } else if (modals.showHelp.value) {
          modals.showHelp.value = false;
        } else if (modals.showRiverDashboard.value) {
          modals.showRiverDashboard.value = false;
        } else if (modals.showAuth.value) {
          modals.showAuth.value = false;
        } else if (modals.showCreateRiver.value) {
          modals.showCreateRiver.value = false;
          opts.clearPendingMessage();
        } else if (modals.showOnboarding.value) {
          modals.showOnboarding.value = false;
        } else if (modals.showWelcome.value) {
          modals.showWelcome.value = false;
        } else if (modals.showSettings.value) {
          modals.showSettings.value = false;
        } else if (selectedNodeId.value || isNewRootMode.value) {
          opts.selectNode(null);
          isNewRootMode.value = false;
        }
        return;
      }

      // Block all other shortcuts when a modal is open
      if (opts.isAnyModalOpen()) return;

      // Ctrl/Cmd + ?: Show keyboard shortcuts help
      if ((e.ctrlKey || e.metaKey) && e.key === '?') {
        e.preventDefault();
        modals.showHelp.value = true;
      }

      // Ctrl/Cmd + K: Open rivers dashboard
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        modals.showRiverDashboard.value = true;
      }

      // Ctrl/Cmd + ,: Open settings
      if ((e.ctrlKey || e.metaKey) && e.key === ',') {
        e.preventDefault();
        modals.showSettings.value = true;
      }

      // Ctrl/Cmd + N: Create new river
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault();
        modals.showRiverDashboard.value = true;
      }

      // Alt/Option + R: Create new root node
      if (e.altKey && (e.key === 'r' || e.key === 'R')) {
        e.preventDefault();
        if (currentRiver.value) {
          opts.createRootNode();
        }
      }

      // Ctrl/Cmd + D: Deselect node
      if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
        e.preventDefault();
        opts.selectNode(null);
        isNewRootMode.value = false;
      }

      // Ctrl/Cmd + ]: Toggle chat panel (close if open)
      if ((e.ctrlKey || e.metaKey) && e.key === ']') {
        e.preventDefault();
        if (selectedNodeId.value || isNewRootMode.value) {
          opts.selectNode(null);
          isNewRootMode.value = false;
        }
      }

      // Ctrl/Cmd + [: Focus chat input
      if ((e.ctrlKey || e.metaKey) && e.key === '[') {
        e.preventDefault();
        opts.focusChatInput();
      }

      // Ctrl/Cmd + M: Toggle minimap
      if ((e.ctrlKey || e.metaKey) && e.key === 'm') {
        e.preventDefault();
        opts.toggleMinimap();
      }

      // Ctrl/Cmd + +/=: Zoom in
      if ((e.ctrlKey || e.metaKey) && (e.key === '+' || e.key === '=')) {
        e.preventDefault();
        opts.zoomIn();
      }

      // Ctrl/Cmd + -: Zoom out
      if ((e.ctrlKey || e.metaKey) && e.key === '-') {
        e.preventDefault();
        opts.zoomOut();
      }

      // Ctrl/Cmd + 0: Reset zoom
      if ((e.ctrlKey || e.metaKey) && e.key === '0') {
        e.preventDefault();
        opts.zoomReset();
      }

      // Ctrl/Cmd + A: Select all nodes
      if ((e.ctrlKey || e.metaKey) && e.key === 'a' && !isTyping) {
        e.preventDefault();
        opts.selectAllNodes();
      }

      // Ctrl/Cmd + Enter: Send message (when chat input is focused)
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && isTyping) {
        e.preventDefault();
        // Dispatch custom event that ChatHistory/ChatModal listen for
        window.dispatchEvent(new CustomEvent('riverchat:send-message'));
      }

      // Actions that require a selected node
      if (selectedNodeId.value && currentRiver.value) {
        const currentNode = currentRiver.value.nodes[selectedNodeId.value];

        // Ctrl/Cmd + B: Branch from selected node
        if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
          e.preventDefault();
          opts.branchFrom(selectedNodeId.value);
          opts.showToast('Branch from this node by sending a new message', 'info');
        }

        // Ctrl/Cmd + G: Regenerate AI response
        if ((e.ctrlKey || e.metaKey) && e.key === 'g') {
          e.preventDefault();
          if (currentNode?.type === 'ai' && currentNode.parentId) {
            opts.regenerate(currentNode.parentId);
          } else {
            opts.showToast('Can only regenerate AI responses', 'error');
          }
        }

        // Ctrl/Cmd + E: Edit & resubmit
        if ((e.ctrlKey || e.metaKey) && e.key === 'e') {
          e.preventDefault();
          if (currentNode?.type === 'user') {
            opts.editResubmit(selectedNodeId.value);
          } else {
            opts.showToast('Can only edit user messages', 'error');
          }
        }

        // Ctrl/Cmd + C: Copy message (only if not typing and no text selected)
        if ((e.ctrlKey || e.metaKey) && e.key === 'c' && !isTyping) {
          const selectedText = window.getSelection()?.toString();
          if (!selectedText && currentNode) {
            e.preventDefault();
            opts.copyMessage(currentNode.content);
          }
          // Otherwise, allow native copy behavior
        }

        // Ctrl/Cmd + Shift + V: View full message (avoid hijacking native paste)
        if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'V' || e.key === 'v') && !isTyping) {
          e.preventDefault();
          if (currentNode) {
            opts.viewMessage(currentNode);
          }
        }

        // Ctrl/Cmd + Delete: Delete branch
        if ((e.ctrlKey || e.metaKey) && e.key === 'Delete') {
          e.preventDefault();
          opts.deleteBranch(selectedNodeId.value);
        }
      }
    };

    window.addEventListener('keydown', keyboardHandler);
  }

  function unregister() {
    if (keyboardHandler) {
      window.removeEventListener('keydown', keyboardHandler);
      keyboardHandler = null;
    }
  }

  onUnmounted(unregister);

  return { register, unregister };
}
