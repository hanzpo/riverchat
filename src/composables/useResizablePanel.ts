import { ref } from 'vue';

const STORAGE_KEY = 'chatPanelWidth';
const MIN_WIDTH = 300;
const MAX_WIDTH = 800;
const DEFAULT_WIDTH = 400;

/**
 * Resizable chat panel width (extracted from App.vue).
 *
 * Drag writes the width straight to the DOM for instant response and mirrors
 * it into reactive state so dependent UI follows in real time; the final
 * width is persisted to sessionStorage.
 */
export function useResizablePanel() {
  const panelWidth = ref(DEFAULT_WIDTH);
  const panelEl = ref<HTMLElement | null>(null);

  function startResize(e: MouseEvent) {
    e.preventDefault();
    if (!panelEl.value) return;

    // The resize handle is hidden by CSS below 768px (see App.vue styles);
    // guard against synthetic events triggering the dead path.
    if (window.innerWidth <= 768) return;

    // Add styles to prevent text selection and improve performance during drag
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const panelElement = panelEl.value;

    const onMouseMove = (moveEvent: MouseEvent) => {
      // Calculate new width from right edge
      const newWidth = window.innerWidth - moveEvent.clientX;

      // Clamp between min and max widths
      const clampedWidth = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, newWidth));

      // Use direct DOM manipulation for instant response
      panelElement.style.width = `${clampedWidth}px`;

      // Also update reactive state so floating buttons move in real-time
      panelWidth.value = clampedWidth;
    };

    const stopResize = () => {
      // Restore body styles
      document.body.style.cursor = '';
      document.body.style.userSelect = '';

      // Now update the reactive state once at the end
      const finalWidth = parseInt(panelElement.style.width, 10);
      if (!isNaN(finalWidth)) {
        panelWidth.value = finalWidth;
        sessionStorage.setItem(STORAGE_KEY, finalWidth.toString());
      }

      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', stopResize);
      window.removeEventListener('blur', stopResize);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', stopResize);
    // Ensure cleanup runs even if the mouse button is released outside the
    // window (mouseup never fires) and the window loses focus.
    window.addEventListener('blur', stopResize);
  }

  /** Restore the last saved width from sessionStorage (call on mount). */
  function restoreSavedWidth() {
    const savedWidth = sessionStorage.getItem(STORAGE_KEY);
    if (savedWidth) {
      const parsed = parseInt(savedWidth, 10);
      if (!isNaN(parsed) && parsed >= MIN_WIDTH && parsed <= MAX_WIDTH) {
        panelWidth.value = parsed;
      }
    }
  }

  return { panelWidth, panelEl, startResize, restoreSavedWidth };
}
