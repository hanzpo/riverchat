import { ref, type Ref } from 'vue';
import type { River, Settings, LLMModel } from '../types';
import { resolveModelIds, DEFAULT_MODEL_ID } from '../types';
import type { ShowToast } from './useToast';

export interface NodeConfirmationsDeps {
  currentRiver: Ref<River | null>;
  settings: Ref<Settings>;
  availableModels: Ref<LLMModel[]>;
  deleteNode: (nodeId: string) => void;
  updateNodeContent: (nodeId: string, content: string) => void;
  generateAIResponse: (
    parentNodeId: string,
    model: LLMModel,
    webSearchEnabled?: boolean
  ) => Promise<void>;
  showToast: ShowToast;
  /** Called after a batch delete completes to clear multi-select UI state. */
  onBatchDeleteDone: () => void;
}

/**
 * Payload-carrying confirmation dialogs for destructive node actions
 * (extracted from App.vue): single-branch delete, batch delete, and
 * edit-and-resubmit.
 *
 * The ref shapes are part of the useKeyboardShortcuts contract (Escape
 * closes them in priority order) — keep them stable.
 */
export function useNodeConfirmations(deps: NodeConfirmationsDeps) {
  const deleteConfirmation = ref({
    isOpen: false,
    nodeId: '',
  });

  const deleteBatchConfirmation = ref({
    isOpen: false,
    nodeIds: [] as string[],
  });

  const editConfirmation = ref({
    isOpen: false,
    nodeId: '',
    content: '',
  });

  function requestDeleteBranch(nodeId: string) {
    deleteConfirmation.value = {
      isOpen: true,
      nodeId,
    };
  }

  function requestDeleteBranchesBatch(nodeIds: string[]) {
    deleteBatchConfirmation.value = {
      isOpen: true,
      nodeIds,
    };
  }

  function requestEditResubmit(nodeId: string) {
    if (!deps.currentRiver.value) return;
    const node = deps.currentRiver.value.nodes[nodeId];
    if (!node) return;

    // The EditResubmitModal auto-focuses its textarea when it opens
    editConfirmation.value = {
      isOpen: true,
      nodeId,
      content: node.content,
    };
  }

  function confirmDeleteBranch() {
    const nodeId = deleteConfirmation.value.nodeId;
    if (nodeId) {
      deps.deleteNode(nodeId);
      deps.showToast('Branch deleted', 'success');
    }
  }

  function confirmDeleteBranchesBatch() {
    const nodeIds = deleteBatchConfirmation.value.nodeIds;
    const river = deps.currentRiver.value;
    if (nodeIds.length > 0 && river) {
      // Filter out nodes that are descendants of other nodes in the selection
      // This prevents trying to delete nodes that will already be deleted as descendants
      const nodeIdsSet = new Set(nodeIds);
      const nodesToDelete = nodeIds.filter((nodeId) => {
        const node = river.nodes[nodeId];
        if (!node) return false;

        // Check if any ancestor of this node is also in the selection
        let currentParentId = node.parentId;
        while (currentParentId) {
          if (nodeIdsSet.has(currentParentId)) {
            // An ancestor is in the selection, so skip this node (it will be deleted with its ancestor)
            return false;
          }
          const parentNode = river.nodes[currentParentId];
          currentParentId = parentNode?.parentId || null;
        }
        return true;
      });

      // Delete only the top-level selected nodes (descendants will be deleted automatically)
      nodesToDelete.forEach((nodeId) => {
        deps.deleteNode(nodeId);
      });

      deps.showToast(`Deleted ${nodeIds.length} nodes`, 'success');
    }
    deleteBatchConfirmation.value.isOpen = false;

    // Clear multi-selection state to prevent chat window from showing
    deps.onBatchDeleteDone();
  }

  function confirmEditResubmit() {
    const nodeId = editConfirmation.value.nodeId;
    const newContent = editConfirmation.value.content.trim();
    const river = deps.currentRiver.value;
    if (!river || !nodeId || !newContent) return;

    const node = river.nodes[nodeId];
    if (!node) return;

    // Close the edit modal
    editConfirmation.value.isOpen = false;

    if (newContent !== node.content) {
      // Delete all children first
      const children = Object.values(river.nodes).filter((n) => n.parentId === nodeId);
      children.forEach((child) => deps.deleteNode(child.id));

      // Update node content
      deps.updateNodeContent(nodeId, newContent);

      // Generate new response
      const editModelId = deps.settings.value.lastUsedModelId || DEFAULT_MODEL_ID;
      const editResolved = resolveModelIds([editModelId], deps.availableModels.value);
      const model = editResolved[0] || deps.availableModels.value[0];
      if (model) {
        deps.generateAIResponse(nodeId, model, false);
        deps.showToast('Message updated, generating new response...', 'info');
      } else {
        deps.showToast('No models available', 'error');
      }
    } else {
      deps.showToast('No changes made', 'info');
    }
  }

  /** True when any confirmation dialog owned by this composable is open. */
  function isAnyConfirmationOpen(): boolean {
    return (
      deleteConfirmation.value.isOpen ||
      editConfirmation.value.isOpen ||
      deleteBatchConfirmation.value.isOpen
    );
  }

  return {
    deleteConfirmation,
    deleteBatchConfirmation,
    editConfirmation,
    requestDeleteBranch,
    requestDeleteBranchesBatch,
    requestEditResubmit,
    confirmDeleteBranch,
    confirmDeleteBranchesBatch,
    confirmEditResubmit,
    isAnyConfirmationOpen,
  };
}
