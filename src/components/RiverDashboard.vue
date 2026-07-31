<template>
  <div v-if="isOpen" class="modal-backdrop z-[200]" @click.self="emit('close')">
    <div class="modal-content w-[700px] max-h-[80vh] p-8 flex flex-col">
      <div class="mb-6">
        <h2
          class="text-xl font-semibold mb-2"
          style="color: var(--color-text-primary); letter-spacing: -0.01em"
        >
          Your Rivers
        </h2>
        <p class="text-sm font-medium" style="color: var(--color-text-secondary)">
          Manage your conversation sessions
        </p>
      </div>

      <!-- Create New River -->
      <div class="mb-5">
        <div class="flex gap-3">
          <input
            v-model="newRiverName"
            type="text"
            placeholder="Enter river name..."
            class="input-material flex-1"
            @keyup.enter="handleCreateRiver"
          />
          <button
            @click="handleCreateRiver"
            :disabled="!newRiverName.trim() || isLoading"
            class="btn-material px-5 py-2.5 whitespace-nowrap flex items-center justify-center gap-3"
            style="min-width: 140px"
          >
            <div v-if="isLoading" class="loading-spinner-small"></div>
            <span>{{ isLoading ? 'Creating...' : '+ New River' }}</span>
          </button>
        </div>
      </div>

      <!-- Rivers List -->
      <div class="flex-1 overflow-y-auto min-h-[200px] overflow-x-visible">
        <div
          v-if="rivers.length === 0"
          class="text-center py-15 px-5"
          style="color: var(--color-text-secondary)"
        >
          <p class="text-sm mb-2 font-medium">No rivers yet</p>
          <p class="text-xs font-medium" style="color: var(--color-text-tertiary)">
            Create your first conversation river above
          </p>
        </div>

        <div v-else class="flex flex-col gap-3">
          <div
            v-for="river in sortedRivers"
            :key="river.id"
            class="card-material card-material-hover p-4 cursor-pointer flex justify-between items-center overflow-visible"
            @click="handleOpenRiver(river.id)"
          >
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 mb-1.5">
                <!-- Inline rename input -->
                <div
                  v-if="editingRiverId === river.id"
                  class="flex items-center gap-2 flex-1"
                  @click.stop
                >
                  <input
                    ref="renameInput"
                    v-model="editingRiverName"
                    type="text"
                    class="input-material text-sm font-semibold"
                    style="padding: 2px 8px; height: 28px"
                    @keyup.enter="confirmRename"
                    @keyup.escape="cancelRename"
                    @blur="confirmRename"
                  />
                  <button
                    @mousedown.prevent="confirmRename"
                    class="btn-material"
                    style="padding: 4px 6px"
                    title="Save"
                  >
                    <PhCheck :size="14" />
                  </button>
                  <button
                    @mousedown.prevent="cancelRename"
                    class="btn-material"
                    style="padding: 4px 6px"
                    title="Cancel"
                  >
                    <PhX :size="14" />
                  </button>
                </div>
                <!-- Normal river name display -->
                <h3
                  v-else
                  class="text-sm font-semibold overflow-hidden text-ellipsis whitespace-nowrap"
                  style="color: var(--color-text-primary); letter-spacing: -0.01em"
                >
                  {{ river.name }}
                </h3>
                <span
                  v-if="river.id === activeRiverId && editingRiverId !== river.id"
                  class="px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide"
                  style="
                    background: var(--color-success-bg);
                    color: var(--color-success);
                    border: 1px solid var(--color-success);
                  "
                >
                  Active
                </span>
              </div>
              <div class="flex gap-4 text-xs font-medium" style="color: var(--color-text-tertiary)">
                <span>{{ formatDate(river.lastModified) }}</span>
                <span>{{ getNodeCount(river) }} nodes</span>
              </div>
            </div>

            <div v-if="editingRiverId !== river.id" class="flex gap-2" @click.stop>
              <button
                @click="handleRenameRiver(river)"
                :disabled="isLoading"
                class="btn-material"
                style="padding: 6px 10px; font-size: 12px"
                title="Rename"
              >
                <PhPencilSimple :size="14" />
              </button>
              <button
                @click="handleDeleteRiver(river)"
                :disabled="isLoading"
                class="btn-material"
                style="padding: 6px 10px; font-size: 12px"
                title="Delete"
              >
                <PhTrash :size="14" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Close Button -->
      <div class="flex justify-end mt-5 pt-5" style="border-top: 1px solid var(--color-border)">
        <button @click="emit('close')" class="btn-material" style="padding: 8px 16px">Close</button>
      </div>

      <!-- Loading Overlay -->
      <div
        v-if="isLoading"
        class="absolute inset-0 flex items-center justify-center rounded-lg"
        style="background: rgba(0, 0, 0, 0.5); backdrop-filter: blur(2px)"
      >
        <div style="display: flex; flex-direction: column; align-items: center">
          <div class="loading-spinner" style="margin-bottom: 20px"></div>
          <p class="text-sm font-semibold" style="color: var(--color-text-primary)">
            Processing...
          </p>
        </div>
      </div>
    </div>
  </div>

  <!-- Confirmation Modal for Delete -->
  <ConfirmationModal
    :is-open="deleteConfirmation.isOpen"
    title="Delete River?"
    :message="`Are you sure you want to delete &quot;${deleteConfirmation.riverName}&quot;? This action cannot be undone.`"
    confirm-text="Delete"
    cancel-text="Cancel"
    :is-dangerous="true"
    @confirm="confirmDelete"
    @close="deleteConfirmation.isOpen = false"
  />
</template>

<script setup lang="ts">
import { ref, computed, nextTick } from 'vue';
import type { River } from '../types';
import { PhPencilSimple, PhTrash, PhCheck, PhX } from '@phosphor-icons/vue';
import ConfirmationModal from './ConfirmationModal.vue';

interface Props {
  isOpen: boolean;
  rivers: River[];
  activeRiverId: string | null;
  isLoading?: boolean;
}

interface Emits {
  (e: 'create', name: string): void;
  (e: 'open', riverId: string): void;
  (e: 'rename', riverId: string, newName: string): void;
  (e: 'delete', riverId: string): void;
  (e: 'close'): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const newRiverName = ref('');
const editingRiverId = ref<string | null>(null);
const editingRiverName = ref('');
const deleteConfirmation = ref({
  isOpen: false,
  riverId: '',
  riverName: '',
});

const sortedRivers = computed(() => {
  if (!props.rivers || !Array.isArray(props.rivers)) {
    return [];
  }
  return [...props.rivers].sort((a, b) => {
    return new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime();
  });
});

function handleCreateRiver() {
  if (newRiverName.value.trim()) {
    emit('create', newRiverName.value.trim());
    newRiverName.value = '';
  }
}

function handleOpenRiver(riverId: string) {
  emit('open', riverId);
  emit('close');
}

const renameInput = ref<HTMLInputElement | null>(null);

function handleRenameRiver(river: River) {
  editingRiverId.value = river.id;
  editingRiverName.value = river.name;
  nextTick(() => {
    if (renameInput.value) {
      // Handle ref array from v-for (Vue returns array of refs)
      const input = Array.isArray(renameInput.value) ? renameInput.value[0] : renameInput.value;
      if (input) {
        input.focus();
        input.select();
      }
    }
  });
}

function confirmRename() {
  if (!editingRiverId.value) return;
  const trimmed = editingRiverName.value.trim();
  const river = props.rivers.find((r) => r.id === editingRiverId.value);
  if (trimmed && river && trimmed !== river.name) {
    emit('rename', editingRiverId.value, trimmed);
  }
  editingRiverId.value = null;
  editingRiverName.value = '';
}

function cancelRename() {
  editingRiverId.value = null;
  editingRiverName.value = '';
}

function handleDeleteRiver(river: River) {
  deleteConfirmation.value = {
    isOpen: true,
    riverId: river.id,
    riverName: river.name,
  };
}

function confirmDelete() {
  if (deleteConfirmation.value.riverId) {
    emit('delete', deleteConfirmation.value.riverId);
  }
  deleteConfirmation.value = {
    isOpen: false,
    riverId: '',
    riverName: '',
  };
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString();
}

function getNodeCount(river: River): number {
  if (!river.nodes || typeof river.nodes !== 'object') {
    return 0;
  }
  return Object.keys(river.nodes).length;
}
</script>

<style scoped>
/* Loading Spinners */
.loading-spinner {
  width: 40px;
  height: 40px;
  border: 3px solid rgba(255, 255, 255, 0.1);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.loading-spinner-small {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
  flex-shrink: 0;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
