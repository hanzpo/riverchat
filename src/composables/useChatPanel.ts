import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue';
import type { MessageNode, LLMModel, Settings } from '../types';
import { resolveModelIds, DEFAULT_MODEL_ID } from '../types';
import { useSubscription } from './useSubscription';
import type { User as FirebaseUser } from 'firebase/auth';

/**
 * Minimal user shape the chat UI needs. A real Firebase `User` satisfies
 * this structurally; the optimistic cached-auth state in App.vue provides
 * only these fields (without `isAnonymous`).
 */
export type ChatPanelUser = Pick<FirebaseUser, 'uid' | 'email' | 'displayName'> &
  Partial<Pick<FirebaseUser, 'isAnonymous'>>;

interface ChatPanelProps {
  path: MessageNode[];
  selectedNodeId: string | null;
  isNewRootMode?: boolean;
  allNodes?: Record<string, MessageNode>;
  settings?: Settings;
  isSending?: boolean;
  currentUser?: ChatPanelUser | null;
}

interface ChatPanelEmits {
  send: (content: string, models: LLMModel[], webSearchEnabled: boolean) => void;
  'node-select': (nodeId: string) => void;
  'branch-from-text': (
    nodeId: string,
    highlightedText: string,
    elaborationPrompt: string,
    models: LLMModel[],
    webSearchEnabled: boolean
  ) => void;
  'chat-model-changed': (modelIds: string[]) => void;
  resend: (userNodeId: string, models: LLMModel[], webSearchEnabled: boolean) => void;
}

export function useChatPanel(
  getProps: () => ChatPanelProps,
  emitFn: {
    send: ChatPanelEmits['send'];
    'branch-from-text': ChatPanelEmits['branch-from-text'];
    'chat-model-changed': ChatPanelEmits['chat-model-changed'];
    resend: ChatPanelEmits['resend'];
  },
  options?: {
    textareaMinHeight?: string;
  }
) {
  const minHeight = options?.textareaMinHeight ?? '40px';

  const inputText = ref('');
  const selectedModelIds = ref<string[]>([]);
  const messagesContainer = ref<HTMLElement | null>(null);
  const textareaRef = ref<HTMLTextAreaElement | null>(null);
  const webSearchEnabled = ref(false);

  // Web search upgrade popover state
  const webSearchUpgrade = ref({
    visible: false,
    position: { top: 0, left: 0 },
  });

  const subscription = useSubscription();

  const canEnableWebSearch = computed(() => {
    return !!getProps().currentUser && subscription.webSearchEnabled.value;
  });

  // Text selection and highlight popover state
  const highlightPopover = ref({
    visible: false,
    position: { x: 0, y: 0 },
    selectedText: '',
    sourceNodeId: '',
  });

  // Branch context state
  const branchContext = ref({
    text: '',
    sourceNodeId: '',
  });

  let isSelecting = false;
  let isInitializing = true;
  let isSyncingFromParent = false;
  let mountListenerTimeout: ReturnType<typeof setTimeout> | null = null;

  // Initialize from settings
  watch(
    () => getProps().settings?.selectedModelIds,
    (ids) => {
      isSyncingFromParent = true;
      if (ids && ids.length > 0) {
        selectedModelIds.value = [...ids];
      } else if (
        selectedModelIds.value.length === 0 &&
        subscription.availableModels.value.length > 0
      ) {
        const defaultModel = subscription.availableModels.value.find(
          (m) => m.id === DEFAULT_MODEL_ID
        );
        selectedModelIds.value = [defaultModel?.id ?? subscription.availableModels.value[0]!.id];
      }
      nextTick(() => {
        isInitializing = false;
        isSyncingFromParent = false;
      });
    },
    { immediate: true }
  );

  // Set default model when available models load
  watch(
    () => subscription.availableModels.value,
    (models) => {
      if (models.length > 0 && selectedModelIds.value.length === 0) {
        isSyncingFromParent = true;
        const defaultModel = models.find((m) => m.id === DEFAULT_MODEL_ID);
        selectedModelIds.value = [defaultModel?.id ?? models[0]!.id];
        nextTick(() => {
          isSyncingFromParent = false;
        });
      }
    }
  );

  // Sync model changes back to parent
  watch(
    selectedModelIds,
    (ids) => {
      if (!isInitializing && !isSyncingFromParent && ids.length > 0) {
        emitFn['chat-model-changed'](ids);
      }
    },
    { deep: true }
  );

  // Disable web search if conditions no longer met
  watch(canEnableWebSearch, (canEnable) => {
    if (!canEnable && webSearchEnabled.value) {
      webSearchEnabled.value = false;
    }
  });

  function handleWebSearchClick(event: MouseEvent) {
    if (canEnableWebSearch.value) {
      webSearchEnabled.value = !webSearchEnabled.value;
    } else {
      const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
      webSearchUpgrade.value = {
        visible: true,
        position: { top: rect.bottom + 4, left: rect.left },
      };
    }
  }

  function handleModelSelect(index: number, modelId: string) {
    if (selectedModelIds.value.some((id, i) => id === modelId && i !== index)) return;
    const newIds = [...selectedModelIds.value];
    newIds[index] = modelId;
    selectedModelIds.value = newIds;
  }

  function addModelSlot() {
    if (selectedModelIds.value.length < subscription.maxModelsPerPrompt.value) {
      const usedIds = new Set(selectedModelIds.value);
      const nextModel = subscription.availableModels.value.find(
        (m) => !usedIds.has(m.id) && subscription.canAccessModel(m)
      );
      if (nextModel) {
        selectedModelIds.value = [...selectedModelIds.value, nextModel.id];
      }
    }
  }

  function removeModelSlot(index: number) {
    if (selectedModelIds.value.length > 1) {
      selectedModelIds.value = selectedModelIds.value.filter((_, i) => i !== index);
    }
  }

  const canSend = computed(() => {
    const props = getProps();
    return (
      props.isNewRootMode ||
      props.path.length === 0 ||
      props.path[props.path.length - 1]?.type === 'ai'
    );
  });

  const selectedUserMessage = computed(() => {
    const props = getProps();
    if (!props.selectedNodeId || props.path.length === 0) return null;
    return props.path.find((msg) => msg.id === props.selectedNodeId && msg.type === 'user') || null;
  });

  // Clear branch context when switching nodes
  watch(
    () => getProps().selectedNodeId,
    () => {
      clearBranchContext();
      highlightPopover.value.visible = false;
    }
  );

  // Scroll to bottom when path changes
  watch(
    () => getProps().path,
    async () => {
      await nextTick();
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (messagesContainer.value) {
            messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight;
          }
        });
      });
    },
    { immediate: true, deep: true, flush: 'post' }
  );

  function autoResizeTextarea() {
    const textarea = textareaRef.value;
    if (textarea) {
      textarea.style.height = minHeight;
      textarea.style.height = Math.min(textarea.scrollHeight, 200) + 'px';
    }
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      if (event.shiftKey) return;
      event.preventDefault();
      handleSend();
    }
  }

  function handleSend() {
    const props = getProps();
    if (
      inputText.value.trim() &&
      selectedModelIds.value.length > 0 &&
      canSend.value &&
      !props.isSending
    ) {
      const models = resolveModelIds(selectedModelIds.value, subscription.availableModels.value);
      if (models.length === 0) return;

      if (branchContext.value.text && branchContext.value.sourceNodeId) {
        emitFn['branch-from-text'](
          branchContext.value.sourceNodeId,
          branchContext.value.text,
          inputText.value.trim(),
          models,
          webSearchEnabled.value
        );
        clearBranchContext();
      } else {
        emitFn.send(inputText.value.trim(), models, webSearchEnabled.value);
      }

      inputText.value = '';
      nextTick(() => {
        if (textareaRef.value) {
          textareaRef.value.style.height = minHeight;
        }
      });
    }
  }

  function handleResend() {
    const props = getProps();
    if (selectedUserMessage.value && selectedModelIds.value.length > 0 && !props.isSending) {
      const models = resolveModelIds(selectedModelIds.value, subscription.availableModels.value);
      if (models.length === 0) return;
      emitFn.resend(selectedUserMessage.value.id, models, webSearchEnabled.value);
    }
  }

  function handleTextSelection(event: MouseEvent, nodeId: string) {
    event.stopPropagation();
    setTimeout(() => {
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) {
        if (!isSelecting) {
          highlightPopover.value.visible = false;
        }
        return;
      }
      const selectedText = selection.toString().trim();
      if (selectedText && selectedText.length > 0) {
        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        if (rect && rect.width > 0 && rect.height > 0) {
          isSelecting = true;
          highlightPopover.value = {
            visible: true,
            position: { x: rect.left, y: rect.top },
            selectedText,
            sourceNodeId: nodeId,
          };
          setTimeout(() => {
            isSelecting = false;
          }, 150);
        }
      } else {
        if (!isSelecting) {
          highlightPopover.value.visible = false;
        }
      }
    }, 50);
  }

  function handleSetBranchContext() {
    if (highlightPopover.value.selectedText && highlightPopover.value.sourceNodeId) {
      branchContext.value = {
        text: highlightPopover.value.selectedText,
        sourceNodeId: highlightPopover.value.sourceNodeId,
      };
      highlightPopover.value.visible = false;
      window.getSelection()?.removeAllRanges();
      nextTick(() => {
        textareaRef.value?.focus();
      });
    }
  }

  function clearBranchContext() {
    branchContext.value = { text: '', sourceNodeId: '' };
  }

  function handleDocumentClick(event: MouseEvent) {
    if (isSelecting) return;
    const target = event.target as HTMLElement;
    if (!target.closest('.text-highlight-popover') && !target.closest('.popover-button')) {
      highlightPopover.value.visible = false;
    }
  }

  function handleGlobalSend() {
    handleSend();
  }

  onMounted(() => {
    mountListenerTimeout = setTimeout(() => {
      mountListenerTimeout = null;
      document.addEventListener('mousedown', handleDocumentClick);
    }, 0);
    window.addEventListener('riverchat:send-message', handleGlobalSend);
  });

  onUnmounted(() => {
    if (mountListenerTimeout) {
      clearTimeout(mountListenerTimeout);
      mountListenerTimeout = null;
    }
    document.removeEventListener('mousedown', handleDocumentClick);
    window.removeEventListener('riverchat:send-message', handleGlobalSend);
  });

  return {
    // State
    inputText,
    selectedModelIds,
    messagesContainer,
    textareaRef,
    webSearchEnabled,
    webSearchUpgrade,
    highlightPopover,
    branchContext,
    subscription,

    // Computed
    canEnableWebSearch,
    canSend,
    selectedUserMessage,

    // Methods
    handleWebSearchClick,
    handleModelSelect,
    addModelSlot,
    removeModelSlot,
    autoResizeTextarea,
    handleKeydown,
    handleSend,
    handleResend,
    handleTextSelection,
    handleSetBranchContext,
    clearBranchContext,
  };
}
