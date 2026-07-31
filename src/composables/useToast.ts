import { ref } from 'vue';

export type ToastType = 'info' | 'success' | 'error';

export type ShowToast = (message: string, type?: ToastType) => void;

const TOAST_DURATION_MS = 3000;

/**
 * App-level toast notification state (extracted from App.vue).
 */
export function useToast() {
  const toast = ref({
    visible: false,
    message: '',
    type: 'info' as ToastType,
  });

  let toastTimeout: ReturnType<typeof setTimeout> | null = null;

  const showToast: ShowToast = (message, type = 'info') => {
    // Clear any existing toast timer to prevent it from hiding the new toast early
    if (toastTimeout) {
      clearTimeout(toastTimeout);
      toastTimeout = null;
    }
    toast.value = { visible: true, message, type };
    toastTimeout = setTimeout(() => {
      toast.value.visible = false;
      toastTimeout = null;
    }, TOAST_DURATION_MS);
  };

  return { toast, showToast };
}
