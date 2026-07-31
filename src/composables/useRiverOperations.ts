import { ref, type Ref } from 'vue';
import type { River, LLMModel } from '../types';
import type { usePostHog } from './usePostHog';
import type { ShowToast } from './useToast';
import type { PendingMessage } from './useMessaging';

export interface RiverOperationsDeps {
  allRivers: Ref<River[]>;
  currentRiver: Ref<River | null>;
  createRiver: (name: string) => Promise<River>;
  loadRiver: (riverId: string) => Promise<boolean>;
  renameRiver: (riverId: string, newName: string) => Promise<void>;
  deleteRiver: (riverId: string) => Promise<void>;
  analytics: ReturnType<typeof usePostHog>;
  showToast: ShowToast;
  /** Take (and clear) any message queued before a river existed. */
  consumePendingMessage: () => PendingMessage | null;
  sendMessage: (content: string, models: LLMModel[], webSearchEnabled: boolean) => Promise<void>;
}

/**
 * River CRUD handlers with loading state and toasts (extracted from App.vue).
 */
export function useRiverOperations(deps: RiverOperationsDeps) {
  const isRiverOperationLoading = ref(false);

  /** Create from the river dashboard. */
  async function create(name: string) {
    isRiverOperationLoading.value = true;
    try {
      const river = await deps.createRiver(name);
      deps.analytics.capture('river_created', { source: 'dashboard' });
      deps.showToast(`Created "${river.name}"`, 'success');
    } catch (_error) {
      deps.showToast('Failed to create river', 'error');
    } finally {
      isRiverOperationLoading.value = false;
    }
  }

  /** Create from the create-river modal, then flush any queued message. */
  async function createFromModal(name: string) {
    // Capture pending message before the first await, because the modal's
    // synchronous 'close' event will null it out while we're suspended.
    const savedPendingMessage = deps.consumePendingMessage();
    isRiverOperationLoading.value = true;
    try {
      const river = await deps.createRiver(name);
      deps.showToast(`Created "${river.name}"`, 'success');
      // Send any pending message that was queued before the river existed
      if (savedPendingMessage && deps.currentRiver.value) {
        await deps.sendMessage(
          savedPendingMessage.content,
          savedPendingMessage.models,
          savedPendingMessage.webSearchEnabled
        );
      }
    } catch (_error) {
      deps.showToast('Failed to create river', 'error');
    } finally {
      isRiverOperationLoading.value = false;
    }
  }

  async function open(riverId: string) {
    isRiverOperationLoading.value = true;
    try {
      if (await deps.loadRiver(riverId)) {
        deps.showToast('River loaded', 'success');
      }
    } catch (_error) {
      deps.showToast('Failed to load river', 'error');
    } finally {
      isRiverOperationLoading.value = false;
    }
  }

  async function rename(riverId: string, newName: string) {
    isRiverOperationLoading.value = true;
    try {
      await deps.renameRiver(riverId, newName);
      deps.showToast('River renamed', 'success');
    } catch (_error) {
      deps.showToast('Failed to rename river', 'error');
    } finally {
      isRiverOperationLoading.value = false;
    }
  }

  async function remove(riverId: string) {
    isRiverOperationLoading.value = true;
    try {
      const river = deps.allRivers.value.find((r) => r.id === riverId);
      await deps.deleteRiver(riverId);
      deps.showToast(`Deleted "${river?.name}"`, 'success');
    } catch (_error) {
      deps.showToast('Failed to delete river', 'error');
    } finally {
      isRiverOperationLoading.value = false;
    }
  }

  return {
    isRiverOperationLoading,
    create,
    createFromModal,
    open,
    rename,
    remove,
  };
}
