import { ref, computed, watch } from 'vue';
import { v4 as uuidv4 } from 'uuid';
import type { River, MessageNode, LLMModel, Settings } from '../types';
import { DEFAULT_MODEL_ID } from '../types';
import { FirestoreStorageService } from '../services/firestore-storage';
import { LLMAPIService } from '../services/llm-api';
import { useSubscription } from './useSubscription';
import { usePostHog, captureException } from './usePostHog';

// Simple debounce utility
function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) & { cancel: () => void } {
  let timeout: ReturnType<typeof setTimeout> | null = null;

  const executedFunction = function (...args: Parameters<T>) {
    const later = () => {
      timeout = null;
      func(...args);
    };

    if (timeout) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(later, wait);
  };

  executedFunction.cancel = function () {
    if (timeout) {
      clearTimeout(timeout);
      timeout = null;
    }
  };

  return executedFunction;
}

// Global state
const currentRiver = ref<River | null>(null);
const settings = ref<Settings>({
  lastUsedModelId: null,
  selectedModelIds: [],
  lastModelRefresh: undefined,
});
const selectedNodeId = ref<string | null>(null);
const allRivers = ref<River[]>([]);
const isLoading = ref(false);
const isInitializing = ref(true); // Flag to prevent auto-save during initial load

// Track active LLM stream AbortControllers so they can be cancelled
// when the user switches rivers or logs out.
const activeStreamControllers = new Set<AbortController>();

export function useRiverChat() {
  const subscription = useSubscription();

  const selectedNode = computed(() => {
    if (!currentRiver.value || !selectedNodeId.value) return null;
    return currentRiver.value.nodes[selectedNodeId.value] || null;
  });

  // Debounced save function to reduce Firestore writes
  const debouncedSaveRiver = debounce(async (river: River) => {
    await FirestoreStorageService.saveRiver(river);
  }, 1000); // Save at most once per second

  // Debounced save for settings (reduce writes)
  const debouncedSaveSettings = debounce(async (newSettings: Settings) => {
    console.log('[useRiverChat] Auto-saving settings to Firestore (debounced)');
    await FirestoreStorageService.saveSettings(newSettings);
  }, 2000); // Save at most once per 2 seconds

  // Save current river whenever it changes (debounced, skip during initialization).
  // NOTE: this deep watch traverses the whole river (every node, including
  // streaming content) on each flush. `flush: 'post'` batches the traversal
  // to once per render flush instead of once per sync mutation. A fuller fix
  // would replace the deep watch with explicit save triggers (or a version
  // counter bumped by mutation helpers), but that changes the save model and
  // is intentionally not done here.
  watch(
    currentRiver,
    (river) => {
      if (river && !isInitializing.value) {
        debouncedSaveRiver(river);
      }
    },
    { deep: true, flush: 'post' }
  );

  // Save settings whenever they change (but skip during initialization to preserve cloud data).
  // Deep watch kept for correctness (settings are mutated in place in several
  // places); flush: 'post' batches the traversal per render flush.
  watch(
    settings,
    async (newSettings) => {
      if (isInitializing.value) {
        console.log('[useRiverChat] Skipping auto-save during initialization');
        return;
      }
      // Use debounced save to reduce writes
      debouncedSaveSettings(newSettings);
    },
    { deep: true, flush: 'post' }
  );

  // Refresh rivers list
  async function refreshRivers(forceRefresh: boolean = false): Promise<void> {
    allRivers.value = await FirestoreStorageService.getRivers(!forceRefresh);
  }

  // River Management
  async function createRiver(name: string): Promise<River> {
    const river: River = {
      id: uuidv4(),
      name,
      createdAt: new Date().toISOString(),
      lastModified: new Date().toISOString(),
      nodes: {},
      rootNodeId: null,
    };

    await FirestoreStorageService.saveRiver(river);
    currentRiver.value = river;
    // Save as last visited river
    settings.value.lastVisitedRiverId = river.id;
    await FirestoreStorageService.saveSettings(settings.value);
    // Force refresh to ensure new river appears immediately
    await refreshRivers(true);

    // Track river creation
    const analytics = usePostHog();
    analytics.capture('river_created', {
      river_id: river.id,
      river_name: name,
    });

    return river;
  }

  /** Abort all in-flight LLM streams (e.g. when switching rivers). */
  function abortActiveStreams(): void {
    for (const ctrl of activeStreamControllers) {
      ctrl.abort();
    }
    activeStreamControllers.clear();
  }

  async function loadRiver(riverId: string): Promise<boolean> {
    // Cancel any streams still running for the old river
    abortActiveStreams();

    const river = await FirestoreStorageService.getRiver(riverId);
    if (river) {
      currentRiver.value = river;
      selectedNodeId.value = null;
      // Save as last visited river
      settings.value.lastVisitedRiverId = riverId;
      if (!isInitializing.value) {
        await FirestoreStorageService.saveSettings(settings.value);
      }

      // Track river loaded
      const analytics = usePostHog();
      analytics.capture('river_loaded', {
        river_id: riverId,
        node_count: Object.keys(river.nodes).length,
      });

      return true;
    }
    return false;
  }

  async function deleteRiver(riverId: string): Promise<void> {
    const river = await FirestoreStorageService.getRiver(riverId);
    const nodeCount = river ? Object.keys(river.nodes).length : 0;

    await FirestoreStorageService.deleteRiver(riverId);
    if (currentRiver.value?.id === riverId) {
      currentRiver.value = null;
      selectedNodeId.value = null;
    }
    // Clear lastVisitedRiverId if the deleted river was the last visited
    if (settings.value.lastVisitedRiverId === riverId) {
      settings.value.lastVisitedRiverId = null;
      await FirestoreStorageService.saveSettings(settings.value);
    }
    // Force refresh to ensure deleted river is removed immediately
    await refreshRivers(true);

    // Track river deletion
    const analytics = usePostHog();
    analytics.capture('river_deleted', {
      river_id: riverId,
      node_count: nodeCount,
    });
  }

  async function renameRiver(riverId: string, newName: string): Promise<void> {
    const river = await FirestoreStorageService.getRiver(riverId);
    if (river) {
      river.name = newName;
      river.lastModified = new Date().toISOString();
      await FirestoreStorageService.saveRiver(river);
      if (currentRiver.value?.id === riverId) {
        currentRiver.value.name = newName;
      }
      // Force refresh to bypass cache and get immediate update
      await refreshRivers(true);
    }
  }

  // Helper function to estimate node dimensions based on content
  function estimateNodeDimensions(node: MessageNode): { width: number; height: number } {
    const BASE_WIDTH = 300; // Average node width (min 280, max 320)
    const BASE_HEIGHT = 120; // Base height for header, timestamp, etc.
    const BRANCH_METADATA_HEIGHT = 80; // Extra height for branch metadata

    let estimatedHeight = BASE_HEIGHT;

    // Add height based on content length (accounting for word wrap at ~300px width)
    const contentLength = node.content.length;
    const estimatedLines = Math.ceil(contentLength / 40); // ~40 chars per line at 300px
    estimatedHeight += estimatedLines * 20; // ~20px per line

    // Add extra height for branch metadata
    if (node.branchMetadata) {
      estimatedHeight += BRANCH_METADATA_HEIGHT;
    }

    // Cap at reasonable max
    estimatedHeight = Math.min(estimatedHeight, 400);

    return { width: BASE_WIDTH, height: estimatedHeight };
  }

  // Helper function to calculate smart position for new nodes
  function calculateSmartPosition(parentId: string | null): { x: number; y: number } | undefined {
    if (!currentRiver.value) return undefined;

    const BASE_HORIZONTAL_SPACING = 80; // Minimum gap between nodes
    const BASE_VERTICAL_SPACING = 50; // Minimum gap between levels

    if (!parentId) {
      // This is a new root node - find all existing root nodes
      const rootNodes = Object.values(currentRiver.value.nodes).filter((n) => !n.parentId);

      if (rootNodes.length === 0) {
        // First node ever
        return { x: 0, y: 0 };
      }

      // Find the rightmost position among all nodes and calculate spacing
      const allPositions = Object.values(currentRiver.value.nodes)
        .map((n) => n.position)
        .filter((p) => p !== undefined) as { x: number; y: number }[];

      if (allPositions.length === 0) {
        // No positions stored yet, use default spacing
        return { x: rootNodes.length * 500, y: 0 };
      }

      // Find the rightmost node and its dimensions
      const maxX = Math.max(...allPositions.map((p) => p.x));
      const rightmostNode = Object.values(currentRiver.value.nodes).find(
        (n) => n.position?.x === maxX
      );

      if (rightmostNode) {
        const nodeDims = estimateNodeDimensions(rightmostNode);
        return { x: maxX + nodeDims.width + BASE_HORIZONTAL_SPACING, y: 0 };
      }

      return { x: maxX + 380, y: 0 };
    }

    // Node with a parent - position it below the parent
    const parent = currentRiver.value.nodes[parentId];
    if (!parent) return undefined;

    const parentPos = parent.position;
    if (!parentPos) {
      // Parent has no stored position, will be calculated by layout algorithm
      return undefined;
    }

    // Get parent dimensions
    const parentDims = estimateNodeDimensions(parent);

    // Find siblings (other children of the same parent)
    const siblings = Object.values(currentRiver.value.nodes).filter(
      (n) => n.parentId === parentId && n.position
    );

    if (siblings.length === 0) {
      // First child - position directly below parent
      return {
        x: parentPos.x,
        y: parentPos.y + parentDims.height + BASE_VERTICAL_SPACING,
      };
    }

    // Position to the right of existing siblings
    const siblingPositions = siblings.map((s) => s.position!);
    const maxSiblingX = Math.max(...siblingPositions.map((p) => p.x));

    // Find the rightmost sibling to calculate proper spacing
    const rightmostSibling = siblings.find((s) => s.position?.x === maxSiblingX);
    let horizontalSpacing = 380; // Default

    if (rightmostSibling) {
      const siblingDims = estimateNodeDimensions(rightmostSibling);
      horizontalSpacing = siblingDims.width + BASE_HORIZONTAL_SPACING;
    }

    return {
      x: maxSiblingX + horizontalSpacing,
      y: parentPos.y + parentDims.height + BASE_VERTICAL_SPACING,
    };
  }

  // Node Management
  function createUserNode(content: string, parentId: string | null = null): MessageNode {
    if (!currentRiver.value) {
      throw new Error('No active river');
    }

    const node: MessageNode = {
      id: uuidv4(),
      type: 'user',
      content,
      timestamp: Date.now(),
      parentId,
      state: 'complete',
      position: calculateSmartPosition(parentId),
    };

    currentRiver.value.nodes[node.id] = node;

    if (!currentRiver.value.rootNodeId) {
      currentRiver.value.rootNodeId = node.id;
    }

    return node;
  }

  function createAINode(parentId: string, model: LLMModel): MessageNode {
    if (!currentRiver.value) {
      throw new Error('No active river');
    }

    const node: MessageNode = {
      id: uuidv4(),
      type: 'ai',
      content: '',
      timestamp: Date.now(),
      parentId,
      state: 'generating',
      model,
      position: calculateSmartPosition(parentId),
    };

    currentRiver.value.nodes[node.id] = node;
    return node;
  }

  async function generateAIResponse(
    userNodeId: string,
    model: LLMModel,
    webSearchEnabled: boolean = false
  ): Promise<void> {
    if (!currentRiver.value) {
      throw new Error('No active river');
    }

    const userNode = currentRiver.value.nodes[userNodeId];
    if (!userNode) {
      throw new Error('User node not found');
    }

    const aiNode = createAINode(userNodeId, model);
    selectedNodeId.value = aiNode.id;

    // Update last used model
    settings.value.lastUsedModelId = model.id;

    // Capture the river ID at call time so streaming callbacks
    // only mutate the river that initiated the request.
    const riverId = currentRiver.value.id;

    // Create an AbortController for this stream so it can be cancelled
    // if the user switches rivers or logs out.
    const controller = new AbortController();
    activeStreamControllers.add(controller);

    const analytics = usePostHog();
    const startTime = Date.now();

    // Track message sent
    analytics.capture('message_sent', {
      river_id: riverId,
      model: model,
      web_search_enabled: webSearchEnabled,
      message_length: userNode.content.length,
      tier: subscription.tier.value,
    });

    await LLMAPIService.streamResponse(
      model,
      userNode,
      currentRiver.value.nodes,
      webSearchEnabled,
      (token: string) => {
        // On token received — verify we're still on the same river
        if (currentRiver.value?.id === riverId) {
          const node = currentRiver.value.nodes[aiNode.id];
          if (node) {
            node.content += token;
          }
        }
      },
      (usage) => {
        // On complete
        activeStreamControllers.delete(controller);
        if (currentRiver.value?.id === riverId) {
          const node = currentRiver.value.nodes[aiNode.id];
          if (node) {
            node.state = 'complete';

            // Apply usage update to local balance
            if (usage) {
              subscription.applyUsageUpdate(usage);
            }

            // Track response completed
            const duration = Date.now() - startTime;
            analytics.capture('ai_response_completed', {
              river_id: riverId,
              model: model,
              duration_ms: duration,
              response_length: node.content.length,
              web_search_enabled: webSearchEnabled,
              cost_cents: usage?.cost,
            });
          }
        }
      },
      (error: string) => {
        // On error
        activeStreamControllers.delete(controller);
        if (currentRiver.value?.id === riverId) {
          const node = currentRiver.value.nodes[aiNode.id];
          if (node) {
            node.state = 'error';
            node.error = error;

            // Re-sync balance from server since the proxy may have
            // reconciled a partial reservation without sending a usage event
            subscription.refreshBalance();

            // Track error
            captureException(new Error(error), {
              context: 'ai_response_generation',
              river_id: riverId,
              model: model,
              web_search_enabled: webSearchEnabled,
            });
          }
        }
      },
      controller.signal
    );
  }

  async function branchFromText(
    sourceNodeId: string,
    highlightedText: string,
    userPrompt: string,
    model: LLMModel,
    webSearchEnabled: boolean = false
  ): Promise<void> {
    if (!currentRiver.value) {
      throw new Error('No active river');
    }

    const sourceNode = currentRiver.value.nodes[sourceNodeId];
    if (!sourceNode) {
      throw new Error('Source node not found');
    }

    // Store only the user's prompt as the content
    // The highlighted text is stored in branchMetadata
    const userNode: MessageNode = {
      id: uuidv4(),
      type: 'user',
      content: userPrompt,
      timestamp: Date.now(),
      parentId: sourceNodeId,
      state: 'complete',
      position: calculateSmartPosition(sourceNodeId),
      branchMetadata: {
        sourceNodeId,
        highlightedText,
        elaborationPrompt: userPrompt,
      },
    };

    currentRiver.value.nodes[userNode.id] = userNode;
    selectedNodeId.value = userNode.id;

    // Track branch creation
    const analytics = usePostHog();
    analytics.capture('branch_created', {
      river_id: currentRiver.value.id,
      source_node_id: sourceNodeId,
      highlighted_text_length: highlightedText.length,
      prompt_length: userPrompt.length,
      model: model,
    });

    // Generate AI response for this branch
    await generateAIResponse(userNode.id, model, webSearchEnabled);
  }

  function deleteNode(nodeId: string): void {
    if (!currentRiver.value) return;

    const nodesToDelete = new Set<string>();
    const queue = [nodeId];

    // Find all descendants
    while (queue.length > 0) {
      const currentId = queue.shift()!;
      nodesToDelete.add(currentId);

      // Find children
      Object.values(currentRiver.value.nodes).forEach((node) => {
        if (node.parentId === currentId) {
          queue.push(node.id);
        }
      });
    }

    // Delete all nodes
    nodesToDelete.forEach((id) => {
      delete currentRiver.value!.nodes[id];
    });

    // Clear selection if deleted
    if (selectedNodeId.value && nodesToDelete.has(selectedNodeId.value)) {
      selectedNodeId.value = null;
    }

    // Clear root if deleted
    if (currentRiver.value.rootNodeId && nodesToDelete.has(currentRiver.value.rootNodeId)) {
      currentRiver.value.rootNodeId = null;
    }
  }

  function updateNodeContent(nodeId: string, content: string): void {
    if (!currentRiver.value) return;
    const node = currentRiver.value.nodes[nodeId];
    if (node) {
      node.content = content;
    }
  }

  function updateNodePosition(nodeId: string, position: { x: number; y: number }): void {
    if (!currentRiver.value) return;
    const node = currentRiver.value.nodes[nodeId];
    if (node) {
      node.position = position;
    }
  }

  function updateNodePositionsBatch(
    updates: Array<{ nodeId: string; position: { x: number; y: number } }>
  ): void {
    if (!currentRiver.value) return;
    // Update all positions in a single operation to minimize reactivity triggers
    updates.forEach(({ nodeId, position }) => {
      const node = currentRiver.value!.nodes[nodeId];
      if (node) {
        node.position = position;
      }
    });
  }

  function getPathToNode(nodeId: string): MessageNode[] {
    if (!currentRiver.value) return [];

    const path: MessageNode[] = [];
    let currentNode: MessageNode | undefined = currentRiver.value.nodes[nodeId];

    while (currentNode) {
      path.unshift(currentNode);
      currentNode = currentNode.parentId
        ? currentRiver.value.nodes[currentNode.parentId]
        : undefined;
    }

    return path;
  }

  function getChildren(nodeId: string): MessageNode[] {
    if (!currentRiver.value) return [];

    return Object.values(currentRiver.value.nodes).filter((node) => node.parentId === nodeId);
  }

  // Settings Management
  async function updateSettings(
    newSettings: Partial<Settings>,
    immediate: boolean = false
  ): Promise<void> {
    // Merge new settings into current settings
    const mergedSettings = { ...settings.value, ...newSettings };
    settings.value = mergedSettings;

    if (immediate) {
      // Cancel any pending debounced save so it doesn't overwrite
      // this immediate save with stale data later.
      debouncedSaveSettings.cancel();
    }

    // Save to storage
    await FirestoreStorageService.saveSettings(mergedSettings);
  }

  // Selection
  function selectNode(nodeId: string | null): void {
    selectedNodeId.value = nodeId;
  }

  // Clear all state (for logout)
  function clearState(): void {
    abortActiveStreams();
    debouncedSaveRiver.cancel();
    debouncedSaveSettings.cancel();
    currentRiver.value = null;
    selectedNodeId.value = null;
  }

  // Initialize - load data and subscription state.
  // Serialized: concurrent calls wait for the current run to finish,
  // then a single force-refresh runs if any caller requested one.
  let pendingForceRefresh = false;
  let initPromise: Promise<void> | null = null;

  async function initialize(forceRefresh: boolean = false): Promise<void> {
    if (isLoading.value) {
      if (forceRefresh) {
        pendingForceRefresh = true;
      }
      // Wait for the current run (and any queued force-refresh) to finish
      // so the caller sees fully-loaded state when its await resolves.
      if (initPromise) await initPromise;
      return;
    }

    isLoading.value = true;
    isInitializing.value = true; // Prevent auto-save during load
    debouncedSaveRiver.cancel(); // Cancel any pending river save to prevent cross-user writes
    debouncedSaveSettings.cancel(); // Cancel any pending debounced save to prevent stale writes

    initPromise = (async () => {
      try {
        // Load settings from cache first for instant UI, then sync in background
        console.log('[useRiverChat] Loading settings from storage...');
        settings.value = await FirestoreStorageService.getSettings(!forceRefresh);
        console.log('[useRiverChat] Settings loaded successfully');

        // Load subscription balance and models from server
        await Promise.all([subscription.refreshBalance(), subscription.refreshModels()]);

        // Validate and set default selected models
        if (subscription.availableModels.value.length > 0) {
          const availableIds = new Set(subscription.availableModels.value.map((m) => m.id));
          const currentIds = settings.value.selectedModelIds || [];
          const validIds = currentIds.filter((id) => availableIds.has(id));

          if (validIds.length === 0) {
            // No valid models selected — set default
            const defaultModel = subscription.availableModels.value.find(
              (m) => m.id === DEFAULT_MODEL_ID
            );
            settings.value.selectedModelIds = [
              defaultModel?.id ?? subscription.availableModels.value[0]!.id,
            ];
            await FirestoreStorageService.saveSettings(settings.value);
          } else if (validIds.length !== currentIds.length) {
            // Some models were stale — keep only valid ones
            settings.value.selectedModelIds = validIds;
            await FirestoreStorageService.saveSettings(settings.value);
          }
          settings.value.lastModelRefresh = Date.now();
        }

        // Load rivers (bypass cache on force refresh to avoid stale cross-user data)
        await refreshRivers(forceRefresh);

        // Load the last visited river, or fall back to the most recent river
        if (allRivers.value && allRivers.value.length > 0) {
          const lastVisitedId = settings.value.lastVisitedRiverId;
          const lastVisitedExists =
            lastVisitedId && allRivers.value.some((r) => r.id === lastVisitedId);
          const riverToLoad = lastVisitedExists ? lastVisitedId! : allRivers.value[0]!.id;
          await loadRiver(riverToLoad);
        }
      } catch (error) {
        console.error('Failed to initialize:', error);
      } finally {
        isLoading.value = false;
        // Enable auto-save after initialization complete
        isInitializing.value = false;
        console.log('[useRiverChat] Initialization complete, auto-save enabled');

        // If a force refresh was queued while we were loading, run it now
        if (pendingForceRefresh) {
          console.log('[useRiverChat] Running queued force refresh');
          pendingForceRefresh = false;
          await initialize(true);
        }
      }
    })();

    await initPromise;
  }

  return {
    // State
    currentRiver,
    settings,
    selectedNodeId,
    allRivers,
    isLoading,
    subscription,

    // Computed
    selectedNode,

    // River methods
    createRiver,
    loadRiver,
    deleteRiver,
    renameRiver,
    refreshRivers,

    // Node methods
    createUserNode,
    generateAIResponse,
    branchFromText,
    deleteNode,
    updateNodeContent,
    updateNodePosition,
    updateNodePositionsBatch,
    getPathToNode,
    getChildren,

    // Settings methods
    updateSettings,

    // Selection methods
    selectNode,

    // State management
    clearState,

    // Initialization
    initialize,
  };
}
