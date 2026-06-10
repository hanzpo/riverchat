import {
  logEvent,
  setUserId,
  setUserProperties,
  setAnalyticsCollectionEnabled,
} from 'firebase/analytics';
import { analytics } from '../config/firebase';
import type { UserProfile } from '../services/auth';
import type { LLMModel } from '../types';

const isDev = import.meta.env.DEV;

// Analytics event names - following Google Analytics recommended events where applicable
export const AnalyticsEvents = {
  // Authentication events
  LOGIN: 'login',
  SIGN_UP: 'sign_up',
  LOGOUT: 'logout',

  // River/Conversation events
  RIVER_CREATED: 'river_created',
  RIVER_LOADED: 'river_loaded',
  RIVER_DELETED: 'river_deleted',
  RIVER_RENAMED: 'river_renamed',

  // Message events
  MESSAGE_SENT: 'message_sent',
  AI_RESPONSE_STARTED: 'ai_response_started',
  AI_RESPONSE_COMPLETED: 'ai_response_completed',
  AI_RESPONSE_ERROR: 'ai_response_error',
  MESSAGE_COPIED: 'message_copied',

  // Branch events
  BRANCH_CREATED: 'branch_created',
  BRANCH_DELETED: 'branch_deleted',

  // Node events
  NODE_SELECTED: 'node_selected',
  NODE_POSITION_UPDATED: 'node_position_updated',

  // Settings events
  API_KEYS_UPDATED: 'api_keys_updated',
  SETTINGS_UPDATED: 'settings_updated',
  MODEL_ENABLED: 'model_enabled',
  MODEL_DISABLED: 'model_disabled',
  MODELS_REFRESHED: 'models_refreshed',

  // UI events
  PAGE_VIEW: 'page_view',
  MODAL_OPENED: 'modal_opened',
  MODAL_CLOSED: 'modal_closed',
  KEYBOARD_SHORTCUT_USED: 'keyboard_shortcut_used',
  CHAT_PANEL_RESIZED: 'chat_panel_resized',
  THEME_CHANGED: 'theme_changed',

  // Feature usage
  WEB_SEARCH_ENABLED: 'web_search_enabled',
  MULTI_MODEL_RESPONSE: 'multi_model_response',
  TEXT_HIGHLIGHTED_FOR_BRANCH: 'text_highlighted_for_branch',

  // Error events
  ERROR_OCCURRED: 'error_occurred',
  API_ERROR: 'api_error',

  // Engagement events
  SESSION_START: 'session_start',
  FIRST_RIVER_CREATED: 'first_river_created',
  FIRST_MESSAGE_SENT: 'first_message_sent',
} as const;

export type AnalyticsEventName = (typeof AnalyticsEvents)[keyof typeof AnalyticsEvents];

// Helper to safely log events
function safeLogEvent(eventName: string, params?: Record<string, any>) {
  if (!analytics) {
    if (isDev) console.debug(`[Analytics] Skipped event (not initialized): ${eventName}`, params);
    return;
  }

  try {
    // Clean params - Firebase Analytics has restrictions on param values
    const cleanParams = params ? cleanEventParams(params) : undefined;
    logEvent(analytics, eventName, cleanParams);
    if (isDev) console.debug(`[Analytics] Event logged: ${eventName}`, cleanParams);
  } catch (error) {
    if (isDev) console.warn(`[Analytics] Failed to log event ${eventName}:`, error);
  }
}

// Clean event parameters to comply with Firebase Analytics requirements
function cleanEventParams(params: Record<string, any>): Record<string, any> {
  const cleaned: Record<string, any> = {};

  for (const [key, value] of Object.entries(params)) {
    // Skip null/undefined values
    if (value === null || value === undefined) continue;

    // Convert key to snake_case and limit to 40 chars
    const cleanKey = key.substring(0, 40);

    // Handle different value types
    if (typeof value === 'string') {
      // String values limited to 100 chars
      cleaned[cleanKey] = value.substring(0, 100);
    } else if (typeof value === 'number' || typeof value === 'boolean') {
      cleaned[cleanKey] = value;
    } else if (typeof value === 'object') {
      // Convert objects to JSON string (limited to 100 chars)
      cleaned[cleanKey] = JSON.stringify(value).substring(0, 100);
    }
  }

  return cleaned;
}

export function useAnalytics() {
  return {
    // Check if analytics is available
    isEnabled: () => !!analytics,

    // Enable/disable analytics collection (for GDPR compliance)
    setCollectionEnabled: (enabled: boolean) => {
      if (analytics) {
        setAnalyticsCollectionEnabled(analytics, enabled);
        if (isDev) console.log(`[Analytics] Collection ${enabled ? 'enabled' : 'disabled'}`);
      }
    },

    // User identification
    identify: (userId: string, userProfile?: UserProfile) => {
      if (!analytics) return;

      try {
        setUserId(analytics, userId);

        if (userProfile) {
          setUserProperties(analytics, {
            subscription_tier: userProfile.subscriptionTier,
          });
        }

        if (isDev) console.log('[Analytics] User identified:', userId);
      } catch (error) {
        if (isDev) console.warn('[Analytics] Failed to identify user:', error);
      }
    },

    // Reset user on logout
    reset: () => {
      if (!analytics) return;

      try {
        setUserId(analytics, '');
        if (isDev) console.log('[Analytics] User session reset');
      } catch (error) {
        if (isDev) console.warn('[Analytics] Failed to reset session:', error);
      }
    },

    // Set user properties
    setUserProperties: (properties: Record<string, string>) => {
      if (!analytics) return;

      try {
        setUserProperties(analytics, properties);
      } catch (error) {
        if (isDev) console.warn('[Analytics] Failed to set user properties:', error);
      }
    },

    // Generic event logging
    logEvent: safeLogEvent,

    // === Authentication Events ===
    logLogin: (method: 'google' | 'email', isNewUser: boolean) => {
      safeLogEvent(isNewUser ? AnalyticsEvents.SIGN_UP : AnalyticsEvents.LOGIN, {
        method,
        is_new_user: isNewUser,
      });
    },

    logLogout: () => {
      safeLogEvent(AnalyticsEvents.LOGOUT);
    },

    // === River Events ===
    logRiverCreated: (riverId: string, riverName: string, isFirstRiver: boolean = false) => {
      safeLogEvent(AnalyticsEvents.RIVER_CREATED, {
        river_id: riverId,
        river_name: riverName,
      });

      if (isFirstRiver) {
        safeLogEvent(AnalyticsEvents.FIRST_RIVER_CREATED, {
          river_id: riverId,
        });
      }
    },

    logRiverLoaded: (riverId: string, nodeCount: number) => {
      safeLogEvent(AnalyticsEvents.RIVER_LOADED, {
        river_id: riverId,
        node_count: nodeCount,
      });
    },

    logRiverDeleted: (riverId: string, nodeCount: number) => {
      safeLogEvent(AnalyticsEvents.RIVER_DELETED, {
        river_id: riverId,
        node_count: nodeCount,
      });
    },

    logRiverRenamed: (riverId: string) => {
      safeLogEvent(AnalyticsEvents.RIVER_RENAMED, {
        river_id: riverId,
      });
    },

    // === Message Events ===
    logMessageSent: (
      riverId: string,
      model: LLMModel,
      messageLength: number,
      webSearchEnabled: boolean,
      isFirstMessage: boolean = false
    ) => {
      safeLogEvent(AnalyticsEvents.MESSAGE_SENT, {
        river_id: riverId,
        model_id: model.id,
        model_name: model.name,
        message_length: messageLength,
        web_search_enabled: webSearchEnabled,
      });

      if (isFirstMessage) {
        safeLogEvent(AnalyticsEvents.FIRST_MESSAGE_SENT, {
          model_id: model.id,
        });
      }
    },

    logAIResponseStarted: (riverId: string, model: LLMModel, webSearchEnabled: boolean) => {
      safeLogEvent(AnalyticsEvents.AI_RESPONSE_STARTED, {
        river_id: riverId,
        model_id: model.id,
        model_name: model.name,
        web_search_enabled: webSearchEnabled,
      });
    },

    logAIResponseCompleted: (
      riverId: string,
      model: LLMModel,
      durationMs: number,
      responseLength: number,
      webSearchEnabled: boolean
    ) => {
      safeLogEvent(AnalyticsEvents.AI_RESPONSE_COMPLETED, {
        river_id: riverId,
        model_id: model.id,
        model_name: model.name,
        duration_ms: durationMs,
        response_length: responseLength,
        web_search_enabled: webSearchEnabled,
      });
    },

    logAIResponseError: (
      riverId: string,
      model: LLMModel,
      errorMessage: string,
      webSearchEnabled: boolean
    ) => {
      safeLogEvent(AnalyticsEvents.AI_RESPONSE_ERROR, {
        river_id: riverId,
        model_id: model.id,
        model_name: model.name,
        error_message: errorMessage,
        web_search_enabled: webSearchEnabled,
      });
    },

    logMessageCopied: (nodeType: 'user' | 'ai') => {
      safeLogEvent(AnalyticsEvents.MESSAGE_COPIED, {
        node_type: nodeType,
      });
    },

    // === Branch Events ===
    logBranchCreated: (
      riverId: string,
      sourceNodeId: string,
      highlightedTextLength: number,
      promptLength: number,
      model: LLMModel
    ) => {
      safeLogEvent(AnalyticsEvents.BRANCH_CREATED, {
        river_id: riverId,
        source_node_id: sourceNodeId,
        highlighted_text_length: highlightedTextLength,
        prompt_length: promptLength,
        model_id: model.id,
      });

      safeLogEvent(AnalyticsEvents.TEXT_HIGHLIGHTED_FOR_BRANCH, {
        text_length: highlightedTextLength,
      });
    },

    logBranchDeleted: (riverId: string, nodeCount: number) => {
      safeLogEvent(AnalyticsEvents.BRANCH_DELETED, {
        river_id: riverId,
        nodes_deleted: nodeCount,
      });
    },

    // === Settings Events ===
    logAPIKeysUpdated: (hasOpenRouter: boolean) => {
      safeLogEvent(AnalyticsEvents.API_KEYS_UPDATED, {
        has_openrouter: hasOpenRouter,
      });
    },

    logSettingsUpdated: (settingName: string) => {
      safeLogEvent(AnalyticsEvents.SETTINGS_UPDATED, {
        setting_name: settingName,
      });
    },

    logModelToggled: (modelId: string, enabled: boolean) => {
      safeLogEvent(enabled ? AnalyticsEvents.MODEL_ENABLED : AnalyticsEvents.MODEL_DISABLED, {
        model_id: modelId,
      });
    },

    logModelsRefreshed: (modelCount: number) => {
      safeLogEvent(AnalyticsEvents.MODELS_REFRESHED, {
        model_count: modelCount,
      });
    },

    // === UI Events ===
    logPageView: (pageName: string, pageLocation?: string) => {
      safeLogEvent(AnalyticsEvents.PAGE_VIEW, {
        page_title: pageName,
        page_location: pageLocation || window.location.href,
      });
    },

    logModalOpened: (modalName: string) => {
      safeLogEvent(AnalyticsEvents.MODAL_OPENED, {
        modal_name: modalName,
      });
    },

    logModalClosed: (modalName: string) => {
      safeLogEvent(AnalyticsEvents.MODAL_CLOSED, {
        modal_name: modalName,
      });
    },

    logKeyboardShortcutUsed: (shortcut: string, action: string) => {
      safeLogEvent(AnalyticsEvents.KEYBOARD_SHORTCUT_USED, {
        shortcut,
        action,
      });
    },

    logChatPanelResized: (width: number) => {
      safeLogEvent(AnalyticsEvents.CHAT_PANEL_RESIZED, {
        width,
      });
    },

    // === Feature Usage ===
    logMultiModelResponse: (modelCount: number, modelIds: string[]) => {
      safeLogEvent(AnalyticsEvents.MULTI_MODEL_RESPONSE, {
        model_count: modelCount,
        model_ids: modelIds.join(','),
      });
    },

    logWebSearchUsed: (modelId: string) => {
      safeLogEvent(AnalyticsEvents.WEB_SEARCH_ENABLED, {
        model_id: modelId,
      });
    },

    // === Error Events ===
    logError: (errorType: string, errorMessage: string, context?: Record<string, any>) => {
      safeLogEvent(AnalyticsEvents.ERROR_OCCURRED, {
        error_type: errorType,
        error_message: errorMessage,
        ...context,
      });
    },

    logAPIError: (
      apiName: string,
      statusCode: number,
      errorMessage: string,
      context?: Record<string, any>
    ) => {
      safeLogEvent(AnalyticsEvents.API_ERROR, {
        api_name: apiName,
        status_code: statusCode,
        error_message: errorMessage,
        ...context,
      });
    },

    // === Session Events ===
    logSessionStart: () => {
      safeLogEvent(AnalyticsEvents.SESSION_START, {
        timestamp: Date.now(),
      });
    },
  };
}

// Export a singleton instance for convenience
export const analytics$ = useAnalytics();
