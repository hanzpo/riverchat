<template>
  <div v-if="isOpen" class="modal-backdrop z-[200]" @click.self="$emit('close')">
    <div
      ref="modalEl"
      tabindex="-1"
      role="dialog"
      aria-modal="true"
      aria-labelledby="shortcuts-modal-title"
      class="modal-content shortcuts-modal-content"
    >
      <div class="modal-header">
        <h2 id="shortcuts-modal-title" class="modal-title">⌨️ Keyboard Shortcuts</h2>
        <button @click="$emit('close')" class="modal-close-btn" aria-label="Close">✕</button>
      </div>
      <div class="modal-body">
        <div class="shortcuts-grid">
          <!-- General -->
          <div class="shortcuts-section">
            <h3 class="section-title">General</h3>
            <div class="shortcuts-list">
              <div class="shortcut-item">
                <div class="shortcut-keys">
                  <kbd>{{ ctrlKey }}</kbd>
                  <span>+</span>
                  <kbd>?</kbd>
                </div>
                <div class="shortcut-description">Show this help dialog</div>
              </div>
              <div class="shortcut-item">
                <div class="shortcut-keys">
                  <kbd>{{ ctrlKey }}</kbd>
                  <span>+</span>
                  <kbd>,</kbd>
                </div>
                <div class="shortcut-description">Open settings</div>
              </div>
              <div class="shortcut-item">
                <div class="shortcut-keys">
                  <kbd>{{ ctrlKey }}</kbd>
                  <span>+</span>
                  <kbd>K</kbd>
                </div>
                <div class="shortcut-description">Open rivers dashboard</div>
              </div>
              <div class="shortcut-item">
                <div class="shortcut-keys">
                  <kbd>Esc</kbd>
                </div>
                <div class="shortcut-description">Close modal/panel</div>
              </div>
            </div>
          </div>

          <!-- Rivers & Navigation -->
          <div class="shortcuts-section">
            <h3 class="section-title">Rivers & Navigation</h3>
            <div class="shortcuts-list">
              <div class="shortcut-item">
                <div class="shortcut-keys">
                  <kbd>{{ ctrlKey }}</kbd>
                  <span>+</span>
                  <kbd>N</kbd>
                </div>
                <div class="shortcut-description">Create new river</div>
              </div>
              <div class="shortcut-item">
                <div class="shortcut-keys">
                  <kbd>Alt</kbd>
                  <span>+</span>
                  <kbd>R</kbd>
                </div>
                <div class="shortcut-description">Create new root node</div>
              </div>
              <div class="shortcut-item">
                <div class="shortcut-keys">
                  <kbd>{{ ctrlKey }}</kbd>
                  <span>+</span>
                  <kbd>Enter</kbd>
                </div>
                <div class="shortcut-description">Send message</div>
              </div>
              <div class="shortcut-item">
                <div class="shortcut-keys">
                  <kbd>{{ ctrlKey }}</kbd>
                  <span>+</span>
                  <kbd>D</kbd>
                </div>
                <div class="shortcut-description">Deselect node</div>
              </div>
            </div>
          </div>

          <!-- Node Actions -->
          <div class="shortcuts-section">
            <h3 class="section-title">Node Actions</h3>
            <div class="shortcuts-list">
              <div class="shortcut-item">
                <div class="shortcut-keys">
                  <kbd>{{ ctrlKey }}</kbd>
                  <span>+</span>
                  <kbd>B</kbd>
                </div>
                <div class="shortcut-description">Branch from selected node</div>
              </div>
              <div class="shortcut-item">
                <div class="shortcut-keys">
                  <kbd>{{ ctrlKey }}</kbd>
                  <span>+</span>
                  <kbd>G</kbd>
                </div>
                <div class="shortcut-description">Regenerate AI response</div>
              </div>
              <div class="shortcut-item">
                <div class="shortcut-keys">
                  <kbd>{{ ctrlKey }}</kbd>
                  <span>+</span>
                  <kbd>E</kbd>
                </div>
                <div class="shortcut-description">Edit & resubmit message</div>
              </div>
              <div class="shortcut-item">
                <div class="shortcut-keys">
                  <kbd>{{ ctrlKey }}</kbd>
                  <span>+</span>
                  <kbd>C</kbd>
                </div>
                <div class="shortcut-description">Copy selected message</div>
              </div>
              <div class="shortcut-item">
                <div class="shortcut-keys">
                  <kbd>{{ ctrlKey }}</kbd>
                  <span>+</span>
                  <kbd>Delete</kbd>
                </div>
                <div class="shortcut-description">Delete selected node/branch</div>
              </div>
              <div class="shortcut-item">
                <div class="shortcut-keys">
                  <kbd>{{ ctrlKey }}</kbd>
                  <span>+</span>
                  <kbd>Shift</kbd>
                  <span>+</span>
                  <kbd>V</kbd>
                </div>
                <div class="shortcut-description">View full message</div>
              </div>
            </div>
          </div>

          <!-- Panel Controls -->
          <div class="shortcuts-section">
            <h3 class="section-title">Panel Controls</h3>
            <div class="shortcuts-list">
              <div class="shortcut-item">
                <div class="shortcut-keys">
                  <kbd>{{ ctrlKey }}</kbd>
                  <span>+</span>
                  <kbd>[</kbd>
                </div>
                <div class="shortcut-description">Focus chat input</div>
              </div>
              <div class="shortcut-item">
                <div class="shortcut-keys">
                  <kbd>{{ ctrlKey }}</kbd>
                  <span>+</span>
                  <kbd>]</kbd>
                </div>
                <div class="shortcut-description">Toggle chat panel</div>
              </div>
            </div>
          </div>

          <!-- Tips -->
          <div class="shortcuts-section shortcuts-section-full">
            <h3 class="section-title">💡 Tips</h3>
            <div class="tips-list">
              <div class="tip-item">
                <strong>Multi-select:</strong> Hold <kbd>{{ ctrlKey }}</kbd> and click nodes to
                select multiple, then use context menu to delete all at once.
              </div>
              <div class="tip-item">
                <strong>Quick branch:</strong> Right-click any node to see available actions in the
                context menu.
              </div>
              <div class="tip-item">
                <strong>Text branching:</strong> Select text in any message to create a new branch
                exploring that specific part.
              </div>
              <div class="tip-item">
                <strong>Resize panel:</strong> Drag the left edge of the chat panel to resize it to
                your preference.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useModalA11y } from '../composables/useModalA11y';

interface Props {
  isOpen: boolean;
}

const props = defineProps<Props>();
defineEmits<{
  (e: 'close'): void;
}>();

const modalEl = ref<HTMLElement | null>(null);
useModalA11y(() => props.isOpen, modalEl);

// Detect OS for correct modifier key display
const ctrlKey = computed(() => {
  const isMac = typeof navigator !== 'undefined' && navigator.userAgent.includes('Mac');
  return isMac ? '⌘' : 'Ctrl';
});
</script>

<style scoped>
/* Uses global .modal-backdrop and .modal-content classes from style.css */
.shortcuts-modal-content {
  max-width: 1100px;
  width: 90%;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  border-bottom: 1px solid var(--color-border);
}

.modal-title {
  font-size: 20px;
  font-weight: 600;
  color: var(--color-text-primary);
  letter-spacing: -0.01em;
  margin: 0;
  display: flex;
  align-items: center;
  gap: 8px;
}

.modal-close-btn {
  background: transparent;
  border: none;
  color: var(--color-text-secondary);
  font-size: 20px;
  cursor: pointer;
  padding: 8px 12px;
  border-radius: 8px;
  transition: all 0.15s var(--ease-in-out);
}

.modal-close-btn:hover {
  background: var(--color-background-hover);
  color: var(--color-text-primary);
}

.modal-body {
  flex: 1;
  overflow-y: auto;
  padding: 20px 24px;
}

.shortcuts-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 20px;
}

.shortcuts-section {
  background: var(--color-background-secondary);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 16px;
}

.shortcuts-section-full {
  grid-column: 1 / -1;
}

.section-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-primary);
  margin: 0 0 12px 0;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--color-border);
  letter-spacing: -0.01em;
}

.shortcuts-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.shortcut-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  padding: 8px;
  border-radius: 8px;
  transition: background 0.15s var(--ease-in-out);
}

.shortcut-item:hover {
  background: var(--color-background-hover);
}

.shortcut-keys {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.shortcut-keys span {
  color: var(--color-text-disabled);
  font-size: 12px;
}

kbd {
  background: var(--color-background-tertiary);
  border: 1px solid var(--color-border-light);
  border-radius: 4px;
  padding: 4px 8px;
  font-family:
    'Inter',
    system-ui,
    -apple-system,
    sans-serif;
  font-size: 12px;
  font-weight: 500;
  color: var(--color-text-primary);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
  min-width: 24px;
  text-align: center;
  display: inline-block;
}

.shortcut-description {
  color: var(--color-text-secondary);
  font-size: 13px;
  flex: 1;
  text-align: right;
}

.tips-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.tip-item {
  color: var(--color-text-secondary);
  font-size: 13px;
  line-height: 1.6;
  padding: 12px;
  background: var(--color-primary-muted);
  border-left: 3px solid var(--color-primary);
  border-radius: 8px;
}

.tip-item strong {
  color: var(--color-text-primary);
  font-weight: 600;
}

.tip-item kbd {
  font-size: 11px;
  padding: 2px 6px;
  margin: 0 2px;
}

/* Scrollbar styling */
.modal-body::-webkit-scrollbar {
  width: 10px;
}

.modal-body::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 10px;
}

.modal-body::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.2);
  border-radius: 10px;
}

.modal-body::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.3);
}

@media (max-width: 768px) {
  .shortcuts-modal-content {
    width: 95%;
    max-height: 90vh;
  }

  .shortcuts-grid {
    grid-template-columns: 1fr;
  }

  .shortcut-item {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }

  .shortcut-description {
    text-align: left;
  }
}
</style>
