import { watch, nextTick, type Ref } from 'vue';

/**
 * Shared modal accessibility helper.
 *
 * - Moves focus into the modal when it opens. The container element should
 *   have `tabindex="-1"` so it can receive programmatic focus. If a
 *   component-specific autofocus already moved focus inside the modal
 *   (e.g. an input), it is left alone.
 * - Restores focus to the previously focused element when the modal closes.
 *
 * Escape-to-close for app-level modals is handled centrally by
 * useKeyboardShortcuts, which closes open overlays one at a time in
 * priority order, so it is intentionally not duplicated here.
 */
export function useModalA11y(isOpen: () => boolean, modalEl: Ref<HTMLElement | null>) {
  let previouslyFocused: HTMLElement | null = null;

  watch(
    isOpen,
    async (open, wasOpen) => {
      if (open && !wasOpen) {
        const active = document.activeElement;
        previouslyFocused = active instanceof HTMLElement ? active : null;
        await nextTick();
        if (modalEl.value && !modalEl.value.contains(document.activeElement)) {
          modalEl.value.focus();
        }
      } else if (!open && wasOpen) {
        if (previouslyFocused && document.contains(previouslyFocused)) {
          previouslyFocused.focus();
        }
        previouslyFocused = null;
      }
    },
    { immediate: true, flush: 'post' }
  );
}
