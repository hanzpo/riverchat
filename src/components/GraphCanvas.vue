<template>
  <div class="graph-canvas" ref="canvasContainer">
    <VueFlow
      v-model:nodes="flowNodes"
      v-model:edges="flowEdges"
      :default-zoom="1"
      :min-zoom="0.2"
      :max-zoom="2"
      :fit-view-on-init="true"
      :delete-key-code="null"
      @node-click="handleNodeClick"
      @node-double-click="handleNodeDoubleClick"
      @node-context-menu="handleNodeContextMenu"
      @node-drag-start="handleNodeDragStart"
      @node-drag="handleNodeDrag"
      @node-drag-stop="handleNodeDragStop"
      @pane-click="handlePaneClick"
      @pane-context-menu="handlePaneContextMenu"
    >
      <Background variant="dots" pattern-color="#404040" :gap="30" />
      <Controls />
      <MiniMap v-show="props.showMinimap !== false" />

      <template #node-custom="nodeProps">
        <CustomNode
          :data="nodeProps.data"
          :selected="nodeProps.selected"
          @click="handleNodeClick"
          @double-click="handleNodeDoubleClick"
          @context-menu="handleNodeContextMenu"
        />
      </template>
    </VueFlow>

    <!-- Selection Rectangle -->
    <div
      v-if="selectionBox.active"
      class="selection-rectangle z-10"
      :style="{
        left: `${selectionBox.x}px`,
        top: `${selectionBox.y}px`,
        width: `${selectionBox.width}px`,
        height: `${selectionBox.height}px`,
      }"
    ></div>

    <!-- Context Menu -->
    <div
      v-if="contextMenu.visible"
      class="context-menu z-[300]"
      :style="{
        left: `${contextMenu.x}px`,
        top: `${contextMenu.y}px`,
      }"
      @click="closeContextMenu"
    >
      <!-- Pane Context Menu (when no node is selected) -->
      <template v-if="!contextMenu.node && contextMenu.selectedNodes.length === 0">
        <div class="context-menu-item" @click="handleCreateRootNode">
          <PhPlus :size="16" />
          <span>New Root Node</span>
        </div>
      </template>

      <!-- Multiple Nodes Selected -->
      <template v-else-if="contextMenu.selectedNodes.length > 1">
        <div class="context-menu-item context-menu-item-header">
          {{ contextMenu.selectedNodes.length }} Nodes Selected
        </div>

        <div class="context-menu-item context-menu-item-danger" @click="handleDeleteMultipleNodes">
          <PhTrash :size="16" />
          <span>Delete Selected Nodes</span>
        </div>
      </template>

      <!-- Single Node Context Menu -->
      <template v-else>
        <div
          v-if="contextMenu.node?.type === 'user'"
          class="context-menu-item"
          @click="handleEditAndResubmit"
        >
          <PhPencilSimple :size="16" />
          <span>Edit & Resubmit</span>
        </div>

        <div class="context-menu-item" @click="handleBranchFromHere">
          <PhGitBranch :size="16" />
          <span>Branch From Here</span>
        </div>

        <div
          v-if="contextMenu.node?.type === 'ai'"
          class="context-menu-item"
          @click="handleRegenerateResponse"
        >
          <PhArrowClockwise :size="16" />
          <span>Regenerate Response</span>
        </div>

        <div class="context-menu-item" @click="handleCopyMessage">
          <PhCopy :size="16" />
          <span>Copy Message</span>
        </div>

        <div class="context-menu-item" @click="handleViewFull">
          <PhEye :size="16" />
          <span>View Full Message</span>
        </div>

        <div class="context-menu-item context-menu-item-danger" @click="handleDeleteBranch">
          <PhTrash :size="16" />
          <span>Delete Branch</span>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, computed, nextTick, onMounted, onUnmounted } from 'vue';
import { VueFlow, useVueFlow } from '@vue-flow/core';
import type { NodeMouseEvent, NodeDragEvent, GraphNode } from '@vue-flow/core';
import { Background } from '@vue-flow/background';
import { Controls } from '@vue-flow/controls';
import { MiniMap } from '@vue-flow/minimap';
import type { MessageNode, VueFlowNode, VueFlowEdge } from '../types';
import {
  PhPlus,
  PhTrash,
  PhPencilSimple,
  PhGitBranch,
  PhArrowClockwise,
  PhCopy,
  PhEye,
} from '@phosphor-icons/vue';
import CustomNode from './CustomNode.vue';

// Import Vue Flow styles
import '@vue-flow/core/dist/style.css';
import '@vue-flow/core/dist/theme-default.css';
import '@vue-flow/controls/dist/style.css';
import '@vue-flow/minimap/dist/style.css';

interface Props {
  nodes: Record<string, MessageNode>;
  rootNodeId: string | null;
  selectedNodeId: string | null;
  showMinimap?: boolean;
}

interface Emits {
  (e: 'node-select', nodeId: string | null): void;
  (e: 'node-double-click', node: MessageNode): void;
  (e: 'branch-from', nodeId: string): void;
  (e: 'regenerate', nodeId: string): void;
  (e: 'edit-resubmit', nodeId: string): void;
  (e: 'delete-branch', nodeId: string): void;
  (e: 'delete-branches-batch', nodeIds: string[]): void;
  (e: 'copy-message', content: string): void;
  (e: 'update-position', nodeId: string, position: { x: number; y: number }): void;
  (
    e: 'update-positions-batch',
    updates: Array<{ nodeId: string; position: { x: number; y: number } }>
  ): void;
  (e: 'create-root-node'): void;
  (e: 'pane-click'): void;
  (e: 'selection-change', hasMultipleSelected: boolean): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const {
  getSelectedNodes,
  project,
  vueFlowRef,
  zoomIn,
  zoomOut,
  fitView,
  addSelectedNodes,
  findNode,
} = useVueFlow();

// Track nodes being dragged to batch position updates
const draggedNodes = ref<Set<string>>(new Set());
const isDragging = ref(false);

// Selection box state
const canvasContainer = ref<HTMLElement | null>(null);
const selectionBox = ref({
  active: false,
  startX: 0,
  startY: 0,
  x: 0,
  y: 0,
  width: 0,
  height: 0,
});
const isRightDragging = ref(false);
let rightButtonDown = false;
let rightDragDetected = false;
let rightClickStart: { x: number; y: number } | null = null;
let pendingContextMenu:
  | { type: 'pane'; event: MouseEvent }
  | { type: 'node'; event: NodeMouseEvent | MouseEvent }
  | null = null;

function onDocMouseDown(event: MouseEvent) {
  if (event.button === 2) {
    rightButtonDown = true;
    rightDragDetected = false;
    rightClickStart = { x: event.clientX, y: event.clientY };
    pendingContextMenu = null;
  }
}

function onDocMouseMove(event: MouseEvent) {
  if (rightButtonDown && rightClickStart && !rightDragDetected) {
    const dx = event.clientX - rightClickStart.x;
    const dy = event.clientY - rightClickStart.y;
    if (dx * dx + dy * dy > 25) {
      rightDragDetected = true;
    }
  }
}

function onDocMouseUp(event: MouseEvent) {
  if (event.button === 2) {
    rightButtonDown = false;
    // Show the pending context menu only if no drag happened
    if (pendingContextMenu && !isRightDragging.value && !rightDragDetected) {
      const pending = pendingContextMenu;
      pendingContextMenu = null;
      if (pending.type === 'pane') {
        showPaneContextMenu(pending.event);
      } else {
        showNodeContextMenu(pending.event);
      }
    } else {
      pendingContextMenu = null;
    }
  }
}

// Watch for selection changes and emit to parent.
// Only the selection count matters for the emitted value, so watch the
// length instead of deep-watching every selected node object.
watch(
  () => getSelectedNodes.value.length,
  (selectedCount) => {
    emit('selection-change', selectedCount > 1);
  }
);

const contextMenu = ref({
  visible: false,
  x: 0,
  y: 0,
  node: null as MessageNode | null,
  selectedNodes: [] as MessageNode[],
});

// Use a ref instead of computed to avoid interfering with VueFlow's drag handling
const flowNodes = ref<VueFlowNode[]>([]);

// Function to sync flow nodes from props
function syncFlowNodes() {
  // Don't sync during drag to avoid interfering with VueFlow's position management
  if (isDragging.value) return;

  const nodeMap = props.nodes;

  // Calculate positions - use stored positions when available, otherwise calculate
  const positions = calculatePositions(nodeMap, props.rootNodeId);

  // Build a map of current flow nodes for easy lookup
  const currentFlowNodesMap = new Map(flowNodes.value.map((n) => [n.id, n]));

  const result: VueFlowNode[] = [];

  Object.values(nodeMap).forEach((node) => {
    const pos = node.position || positions[node.id] || { x: 0, y: 0 };

    // Check if this node already exists in flowNodes
    const existingNode = currentFlowNodesMap.get(node.id);

    if (existingNode) {
      // Update existing node in-place to preserve VueFlow's internal references
      existingNode.position = pos;
      existingNode.data = node;
      result.push(existingNode);
    } else {
      // New node - create it
      result.push({
        id: node.id,
        type: 'custom',
        position: pos,
        data: node,
      });
    }
  });

  flowNodes.value = result;
}

// Watch for node additions/removals and river (re)loads, and sync.
// A deep watch on props.nodes would re-run syncFlowNodes on every token of a
// streaming response (node.content mutations), which is O(nodes²) per flush.
// Node objects are shared by reference with VueFlow node data, so content,
// state and position mutations propagate reactively without a re-sync —
// only membership changes (key set) or a wholesale replacement of the nodes
// object (river switch/reload) require rebuilding the flow nodes array.
watch(() => [props.nodes, Object.keys(props.nodes).join('\n')] as const, syncFlowNodes, {
  immediate: true,
});

// Convert edges
const flowEdges = computed<VueFlowEdge[]>(() => {
  const result: VueFlowEdge[] = [];

  Object.values(props.nodes).forEach((node) => {
    if (node.parentId && props.nodes[node.parentId]) {
      result.push({
        id: `${node.parentId}-${node.id}`,
        source: node.parentId,
        target: node.id,
        animated: node.state === 'generating',
        style: {
          stroke: node.state === 'generating' ? '#4a9eff' : 'rgba(255, 255, 255, 0.2)',
          strokeWidth: '2.5',
          strokeDasharray: node.state === 'generating' ? '5, 5' : '0',
        },
      });
    }
  });

  return result;
});

// Enhanced layout algorithm that handles multiple root nodes
function calculatePositions(
  nodes: Record<string, MessageNode>,
  _rootId: string | null
): Record<string, { x: number; y: number }> {
  const positions: Record<string, { x: number; y: number }> = {};

  const ROOT_SPACING = 500; // Space between different root trees

  // Find all root nodes (nodes without parents)
  const rootNodes = Object.values(nodes).filter((n) => !n.parentId);

  if (rootNodes.length === 0) return positions;

  // Layout each root tree
  let currentRootX = 0;

  rootNodes.forEach((rootNode) => {
    const treePositions = layoutTree(rootNode.id, nodes, currentRootX);
    Object.assign(positions, treePositions);

    // Find the max X position used by this tree
    const maxX = Math.max(...Object.values(treePositions).map((p) => p.x));
    currentRootX = maxX + ROOT_SPACING;
  });

  return positions;
}

function layoutTree(
  rootId: string,
  nodes: Record<string, MessageNode>,
  startX: number
): Record<string, { x: number; y: number }> {
  const positions: Record<string, { x: number; y: number }> = {};
  const HORIZONTAL_SPACING = 350;
  const VERTICAL_SPACING = 200;

  function layoutNode(nodeId: string, depth: number, horizontalIndex: number): number {
    const node = nodes[nodeId];
    if (!node) return horizontalIndex;

    positions[nodeId] = {
      x: startX + horizontalIndex * HORIZONTAL_SPACING,
      y: depth * VERTICAL_SPACING,
    };

    // Find children
    const children = Object.values(nodes).filter((n) => n.parentId === nodeId);

    let currentIndex = horizontalIndex;
    children.forEach((child, index) => {
      if (index > 0) currentIndex++;
      currentIndex = layoutNode(child.id, depth + 1, currentIndex);
    });

    return currentIndex;
  }

  layoutNode(rootId, 0, 0);
  return positions;
}

// Auto-fit view disabled to avoid distracting zoom behavior
// Users can manually zoom using the controls

// Selection box handlers
function startSelectionBox(event: MouseEvent) {
  // Only start selection on right-click
  if (event.button !== 2) return;

  const rect = canvasContainer.value?.getBoundingClientRect();
  if (!rect) return;

  isRightDragging.value = false;

  selectionBox.value = {
    active: true,
    startX: event.clientX - rect.left,
    startY: event.clientY - rect.top,
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
    width: 0,
    height: 0,
  };

  // Add event listeners
  document.addEventListener('mousemove', updateSelectionBox);
  document.addEventListener('mouseup', endSelectionBox);
}

function updateSelectionBox(event: MouseEvent) {
  if (!selectionBox.value.active) return;

  const rect = canvasContainer.value?.getBoundingClientRect();
  if (!rect) return;

  const currentX = event.clientX - rect.left;
  const currentY = event.clientY - rect.top;

  const minX = Math.min(selectionBox.value.startX, currentX);
  const minY = Math.min(selectionBox.value.startY, currentY);
  const maxX = Math.max(selectionBox.value.startX, currentX);
  const maxY = Math.max(selectionBox.value.startY, currentY);

  selectionBox.value.x = minX;
  selectionBox.value.y = minY;
  selectionBox.value.width = maxX - minX;
  selectionBox.value.height = maxY - minY;

  // If we've dragged more than 5 pixels, consider it a drag
  const dragDistance = Math.sqrt(
    Math.pow(currentX - selectionBox.value.startX, 2) +
      Math.pow(currentY - selectionBox.value.startY, 2)
  );

  if (dragDistance > 5) {
    isRightDragging.value = true;
  }
}

function endSelectionBox(_event: MouseEvent) {
  if (!selectionBox.value.active) return;

  if (isRightDragging.value) {
    selectNodesInBox();
  }

  isRightDragging.value = false;
  selectionBox.value.active = false;

  document.removeEventListener('mousemove', updateSelectionBox);
  document.removeEventListener('mouseup', endSelectionBox);
}

function selectNodesInBox() {
  if (!selectionBox.value.active || !vueFlowRef.value) return;

  const rect = canvasContainer.value?.getBoundingClientRect();
  if (!rect) return;

  // Convert selection box coordinates from screen space to flow space
  const boxMinScreen = {
    x: selectionBox.value.x,
    y: selectionBox.value.y,
  };
  const boxMaxScreen = {
    x: selectionBox.value.x + selectionBox.value.width,
    y: selectionBox.value.y + selectionBox.value.height,
  };

  // Project screen coordinates to flow coordinates
  const boxMin = project(boxMinScreen);
  const boxMax = project(boxMaxScreen);

  // Find node IDs within the selection box
  const nodeIdsToSelect: string[] = [];

  flowNodes.value.forEach((node) => {
    const nodeLeft = node.position.x;
    const nodeTop = node.position.y;
    // Use the node's measured dimensions from Vue Flow, falling back to an
    // approximate size if the node hasn't been measured yet.
    const graphNode = findNode(node.id);
    const nodeWidth = graphNode?.dimensions.width || 300;
    const nodeHeight = graphNode?.dimensions.height || 100;
    const nodeRight = nodeLeft + nodeWidth;
    const nodeBottom = nodeTop + nodeHeight;

    // Check if node intersects with selection box
    const intersects =
      nodeLeft < boxMax.x && nodeRight > boxMin.x && nodeTop < boxMax.y && nodeBottom > boxMin.y;

    if (intersects) {
      nodeIdsToSelect.push(node.id);
    }
  });

  // Update selection by setting the selected property on Vue Flow's nodes
  flowNodes.value.forEach((node) => {
    const graphNode = findNode(node.id);
    if (graphNode) {
      graphNode.selected = nodeIdsToSelect.includes(node.id);
    }
  });
}

// Event handlers. These are bound both to Vue Flow events (NodeMouseEvent)
// and to CustomNode emits (which pass the MessageNode directly).
function handleNodeClick(event: NodeMouseEvent | MessageNode) {
  const nodeId = 'node' in event ? event.node.id : event.id;
  if (nodeId) {
    emit('node-select', nodeId);
  }
}

function handleNodeDoubleClick(event: NodeMouseEvent | MessageNode) {
  const node = 'node' in event ? (event.node.data as MessageNode) : event;
  if (node) {
    emit('node-double-click', node);
  }
}

function clampMenuPosition(
  x: number,
  y: number,
  menuWidth: number = 220,
  menuHeight: number = 250
): { x: number; y: number } {
  const maxX = window.innerWidth - menuWidth - 8;
  const maxY = window.innerHeight - menuHeight - 8;
  return {
    x: Math.max(8, Math.min(x, maxX)),
    y: Math.max(8, Math.min(y, maxY)),
  };
}

function handleNodeContextMenu(event: NodeMouseEvent | MouseEvent) {
  if (rightButtonDown) {
    // Defer until mouseup to check if it was a drag
    pendingContextMenu = { type: 'node', event };
    return;
  }
  showNodeContextMenu(event);
}

function showNodeContextMenu(event: NodeMouseEvent | MouseEvent) {
  // CustomNode emits a bare MouseEvent (no node payload); Vue Flow emits
  // a NodeMouseEvent whose `event` may be a mouse or touch event.
  const mouseEvent = event instanceof Event ? event : event.event;
  const node = event instanceof Event ? null : (event.node.data as MessageNode);

  if (node && mouseEvent && 'clientX' in mouseEvent) {
    const selectedNodes = getSelectedNodes.value || [];
    const selectedNodesData = selectedNodes.map((n) => n.data as MessageNode);

    const pos = clampMenuPosition(mouseEvent.clientX, mouseEvent.clientY);

    contextMenu.value = {
      visible: true,
      x: pos.x,
      y: pos.y,
      node,
      selectedNodes: selectedNodesData.length > 1 ? selectedNodesData : [],
    };
  }
}

function handlePaneClick() {
  emit('node-select', null);
  emit('pane-click');
  emit('selection-change', false);
  closeContextMenu();
}

function handlePaneContextMenu(event: MouseEvent) {
  if (rightButtonDown) {
    // Defer until mouseup to check if it was a drag
    pendingContextMenu = { type: 'pane', event };
    return;
  }
  showPaneContextMenu(event);
}

function showPaneContextMenu(mouseEvent: MouseEvent) {
  if (mouseEvent) {
    const selectedNodes = getSelectedNodes.value || [];
    const selectedNodesData =
      selectedNodes.length > 1 ? selectedNodes.map((n) => n.data as MessageNode) : [];

    const menuHeight = selectedNodesData.length > 1 ? 100 : 60;
    const pos = clampMenuPosition(mouseEvent.clientX, mouseEvent.clientY, 220, menuHeight);

    contextMenu.value = {
      visible: true,
      x: pos.x,
      y: pos.y,
      node: null,
      selectedNodes: selectedNodesData,
    };
  }
}

let dragBatchTimeout: ReturnType<typeof setTimeout> | null = null;

function handleNodeDragStart() {
  // Mark that dragging has started - this prevents syncFlowNodes from running
  isDragging.value = true;
  draggedNodes.value.clear();
  if (dragBatchTimeout) {
    clearTimeout(dragBatchTimeout);
    dragBatchTimeout = null;
  }
}

function handleNodeDrag() {
  // During drag, VueFlow handles positions internally
  // We don't need to do anything here
}

async function handleNodeDragStop(event: NodeDragEvent) {
  const nodeId = event.node?.id;
  const position = event.node?.position;

  if (!nodeId || !position) return;

  // Get all currently selected nodes from VueFlow
  const selectedNodes = getSelectedNodes.value || [];

  // If multiple nodes are selected, batch update all of them
  if (selectedNodes.length > 1) {
    // Add this node to the dragged nodes set
    draggedNodes.value.add(nodeId);

    // Use a short timeout to batch all dragStop events that arrive in
    // the same frame, instead of waiting for every single selected node.
    // This avoids getting stuck if VueFlow doesn't fire dragStop for
    // all nodes (e.g., node was deselected during drag).
    if (dragBatchTimeout) clearTimeout(dragBatchTimeout);
    dragBatchTimeout = setTimeout(async () => {
      dragBatchTimeout = null;
      // Collect positions for all selected nodes from VueFlow's current state
      const updates = selectedNodes
        .filter((node) => node.position)
        .map((node) => ({
          nodeId: node.id,
          position: { x: node.position!.x, y: node.position!.y },
        }));

      // Emit a single batch update event
      emit('update-positions-batch', updates);

      // Clear the dragged nodes set
      draggedNodes.value.clear();

      // Wait for Vue to process the update before allowing sync
      await nextTick();
      await nextTick(); // Double nextTick to ensure props have propagated
      isDragging.value = false;
    }, 50);
  } else {
    // Single node drag - update immediately
    emit('update-position', nodeId, { x: position.x, y: position.y });

    // Wait for Vue to process the update before allowing sync
    await nextTick();
    await nextTick(); // Double nextTick to ensure props have propagated
    isDragging.value = false;
  }
}

function closeContextMenu() {
  contextMenu.value.visible = false;
}

// Context menu actions
function handleBranchFromHere() {
  if (contextMenu.value.node) {
    emit('branch-from', contextMenu.value.node.id);
  }
}

function handleRegenerateResponse() {
  if (contextMenu.value.node?.parentId) {
    emit('regenerate', contextMenu.value.node.parentId);
  }
}

function handleEditAndResubmit() {
  if (contextMenu.value.node) {
    emit('edit-resubmit', contextMenu.value.node.id);
  }
}

function handleDeleteBranch() {
  if (contextMenu.value.node) {
    emit('delete-branch', contextMenu.value.node.id);
  }
}

function handleDeleteMultipleNodes() {
  if (contextMenu.value.selectedNodes.length > 0) {
    // Collect all node IDs and emit as a batch
    const nodeIds = contextMenu.value.selectedNodes.map((node) => node.id);
    emit('delete-branches-batch', nodeIds);
  }
}

function handleCopyMessage() {
  if (contextMenu.value.node) {
    emit('copy-message', contextMenu.value.node.content);
  }
}

function handleViewFull() {
  if (contextMenu.value.node) {
    emit('node-double-click', contextMenu.value.node);
  }
}

function handleCreateRootNode() {
  emit('create-root-node');
}

function handleKeyboardDelete(event: KeyboardEvent) {
  // Handle plain Delete or Backspace key. Modified combinations are
  // ignored: Ctrl/Cmd+Delete is handled by the app-level keyboard
  // shortcuts (useKeyboardShortcuts) for the app-selected node, and
  // handling it here too used to open two confirmation dialogs at once.
  if (
    (event.key === 'Delete' || event.key === 'Backspace') &&
    !event.ctrlKey &&
    !event.metaKey &&
    !event.altKey
  ) {
    // Check if user is typing in an input field
    const target = event.target as HTMLElement;
    const isTyping =
      target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;

    if (isTyping) {
      // Don't interfere with typing
      return;
    }

    // Get currently selected nodes
    const selectedNodes = getSelectedNodes.value || [];

    if (selectedNodes.length > 0) {
      // Prevent default browser behavior
      event.preventDefault();

      // Extract node IDs from selected nodes
      const nodeIds = selectedNodes.map((node) => node.id);

      // Emit the batch delete event to trigger the proper deletion flow
      // This will show the confirmation dialog and properly delete nodes with descendants
      emit('delete-branches-batch', nodeIds);
    }
  }
}

// Close context menu on click outside
function handleClickOutside(event: MouseEvent) {
  const target = event.target as HTMLElement;
  if (!target.closest('.context-menu')) {
    closeContextMenu();
  }
}

// Setup selection box on pane
// We need to detect right-click on the pane to start selection box
let selectionPaneElement: Element | null = null;

onMounted(() => {
  // Add click listener for closing context menu
  window.addEventListener('click', handleClickOutside);

  // Add keyboard listener for node deletion
  window.addEventListener('keydown', handleKeyboardDelete);

  // Track right-click drag globally (capture phase to fire before Vue Flow)
  document.addEventListener('mousedown', onDocMouseDown, true);
  document.addEventListener('mousemove', onDocMouseMove, true);
  document.addEventListener('mouseup', onDocMouseUp, true);

  // Find the Vue Flow pane element
  selectionPaneElement = document.querySelector('.vue-flow__pane');
  selectionPaneElement?.addEventListener('mousedown', startSelectionBox as EventListener);
});

onUnmounted(() => {
  // Remove click listener
  window.removeEventListener('click', handleClickOutside);

  // Remove keyboard listener
  window.removeEventListener('keydown', handleKeyboardDelete);

  // Remove right-click drag tracking
  document.removeEventListener('mousedown', onDocMouseDown, true);
  document.removeEventListener('mousemove', onDocMouseMove, true);
  document.removeEventListener('mouseup', onDocMouseUp, true);

  // Remove the pane selection listener (safe even if it was never attached)
  selectionPaneElement?.removeEventListener('mousedown', startSelectionBox as EventListener);
  selectionPaneElement = null;

  // Clean up any lingering event listeners
  document.removeEventListener('mousemove', updateSelectionBox);
  document.removeEventListener('mouseup', endSelectionBox);

  // Cancel any pending drag batch timeout
  if (dragBatchTimeout) {
    clearTimeout(dragBatchTimeout);
    dragBatchTimeout = null;
  }
});

// Expose methods for parent component to call via ref
defineExpose({
  zoomIn: () => zoomIn(),
  zoomOut: () => zoomOut(),
  fitView: () => fitView(),
  selectAllNodes: () => {
    const graphNodes = flowNodes.value
      .map((n) => findNode(n.id))
      .filter((n): n is GraphNode => !!n);
    addSelectedNodes(graphNodes);
    return graphNodes.length;
  },
});
</script>

<style scoped>
.graph-canvas {
  width: 100%;
  height: 100%;
  position: relative;
  background: #0e0e0e;
}

:deep(.vue-flow__background) {
  background-color: #0e0e0e;
}

:deep(.vue-flow__minimap) {
  background: rgba(10, 10, 10, 0.95);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 8px;
}

:deep(.vue-flow__minimap-node) {
  fill: rgba(74, 158, 255, 0.4);
  stroke: rgba(74, 158, 255, 0.6);
  stroke-width: 2;
}

:deep(.vue-flow__controls) {
  background: rgba(10, 10, 10, 0.95);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 8px;
  box-shadow:
    0 3px 6px rgba(0, 0, 0, 0.15),
    0 2px 4px rgba(0, 0, 0, 0.12);
}

:deep(.vue-flow__controls-button) {
  background: transparent;
  border: none;
  border-bottom: 1px solid rgba(255, 255, 255, 0.15);
  color: rgba(255, 255, 255, 0.9);
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  font-weight: 600;
}

:deep(.vue-flow__controls-button svg) {
  fill: rgba(255, 255, 255, 0.9);
  max-width: 16px;
  max-height: 16px;
}

:deep(.vue-flow__controls-button:hover) {
  background: rgba(74, 158, 255, 0.15);
  color: rgba(255, 255, 255, 1);
}

:deep(.vue-flow__controls-button:hover svg) {
  fill: rgba(255, 255, 255, 1);
}

:deep(.vue-flow__controls-button:last-child) {
  border-bottom: none;
}

.selection-rectangle {
  position: absolute;
  border: 2px solid rgba(74, 158, 255, 0.8);
  background: rgba(74, 158, 255, 0.15);
  pointer-events: none;
  backdrop-filter: blur(2px);
}
</style>
