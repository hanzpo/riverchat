import posthog from 'posthog-js';
import type { UserProfile } from '../services/auth';

let isInitialized = false;

// Global error listeners are registered at most once per page load,
// even if initialization is somehow re-entered.
let errorListenersRegistered = false;
let onWindowError: ((event: ErrorEvent) => void) | null = null;
let onUnhandledRejection: ((event: PromiseRejectionEvent) => void) | null = null;

function registerErrorListeners() {
  if (errorListenersRegistered || typeof window === 'undefined') {
    return;
  }

  onWindowError = (event) => {
    captureException(event.error || new Error(event.message), {
      type: 'uncaught_error',
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
    });
  };

  onUnhandledRejection = (event) => {
    captureException(event.reason, {
      type: 'unhandled_rejection',
    });
  };

  window.addEventListener('error', onWindowError);
  window.addEventListener('unhandledrejection', onUnhandledRejection);
  errorListenersRegistered = true;
}

/** Remove the global error listeners registered by initPostHog (e.g. in tests). */
export function teardownPostHogErrorTracking() {
  if (!errorListenersRegistered || typeof window === 'undefined') {
    return;
  }
  if (onWindowError) {
    window.removeEventListener('error', onWindowError);
    onWindowError = null;
  }
  if (onUnhandledRejection) {
    window.removeEventListener('unhandledrejection', onUnhandledRejection);
    onUnhandledRejection = null;
  }
  errorListenersRegistered = false;
}

export function initPostHog() {
  if (isInitialized) {
    return;
  }

  const apiKey = import.meta.env.VITE_POSTHOG_KEY;
  const apiHost = import.meta.env.VITE_POSTHOG_HOST || 'https://us.i.posthog.com';

  if (!apiKey) {
    console.warn('PostHog API key not found. Analytics will not be initialized.');
    return;
  }

  posthog.init(apiKey, {
    api_host: apiHost,
    person_profiles: 'identified_only',
    capture_pageview: false, // We'll manually capture pageviews in the router
    session_recording: {
      recordCrossOriginIframes: false,
      maskAllInputs: true, // Mask sensitive input fields by default
      maskTextSelector: '[data-sensitive]', // Mask elements with data-sensitive attribute
    },
    autocapture: {
      dom_event_allowlist: ['click', 'change', 'submit'], // Only capture relevant events
      url_allowlist: [], // Allow all URLs by default
      element_allowlist: [], // Allow all elements by default
    },
    loaded: () => {
      // Setup global error tracking (idempotent)
      registerErrorListeners();

      console.log('PostHog initialized successfully');
    },
  });

  isInitialized = true;
}

export function usePostHog() {
  return {
    posthog: isInitialized ? posthog : null,

    // User identification
    identify: (userId: string, userProfile?: UserProfile) => {
      if (!isInitialized) return;

      const properties: Record<string, any> = {};

      if (userProfile) {
        properties.email = userProfile.email;
        properties.subscription_tier = userProfile.subscriptionTier;
        properties.created_at = userProfile.createdAt;
      }

      posthog.identify(userId, properties);
      console.log('[PostHog] User identified:', userId);
    },

    // Reset user on logout
    reset: () => {
      if (!isInitialized) return;
      posthog.reset();
      console.log('[PostHog] User session reset');
    },

    // Capture custom events
    capture: (eventName: string, properties?: Record<string, any>) => {
      if (!isInitialized) return;
      posthog.capture(eventName, properties);
    },

    // Set user properties
    setUserProperties: (properties: Record<string, any>) => {
      if (!isInitialized) return;
      posthog.setPersonProperties(properties);
    },

    // Set user properties once (only if not already set)
    setUserPropertiesOnce: (properties: Record<string, any>) => {
      if (!isInitialized) return;
      // Use $set_once in the identify call
      posthog.setPersonProperties(properties);
    },

    // Group analytics
    group: (groupType: string, groupKey: string, groupProperties?: Record<string, any>) => {
      if (!isInitialized) return;
      posthog.group(groupType, groupKey, groupProperties);
    },

    // Feature flags
    isFeatureEnabled: (flagKey: string): boolean => {
      if (!isInitialized) return false;
      return posthog.isFeatureEnabled(flagKey) || false;
    },

    getFeatureFlag: (flagKey: string): string | boolean | undefined => {
      if (!isInitialized) return undefined;
      return posthog.getFeatureFlag(flagKey);
    },

    getFeatureFlagPayload: (flagKey: string): any => {
      if (!isInitialized) return undefined;
      return posthog.getFeatureFlagPayload(flagKey);
    },

    onFeatureFlags: (callback: (flags: string[]) => void) => {
      if (!isInitialized) return;
      posthog.onFeatureFlags(callback);
    },

    reloadFeatureFlags: () => {
      if (!isInitialized) return;
      posthog.reloadFeatureFlags();
    },

    // Session replay
    startSessionRecording: () => {
      if (!isInitialized) return;
      posthog.startSessionRecording();
    },

    stopSessionRecording: () => {
      if (!isInitialized) return;
      posthog.stopSessionRecording();
    },

    getSessionReplayUrl: (options?: {
      withTimestamp?: boolean;
      timestampLookBack?: number;
    }): string | null => {
      if (!isInitialized) return null;
      return posthog.get_session_replay_url(options);
    },
  };
}

// Error tracking helper
export function captureException(error: Error | any, context?: Record<string, any>) {
  if (!isInitialized) return;

  const errorProperties: Record<string, any> = {
    $exception_message: error?.message || String(error),
    $exception_type: error?.name || 'Error',
    $exception_stack: error?.stack || '',
    ...context,
  };

  posthog.capture('$exception', errorProperties);
  console.error('[PostHog] Exception captured:', error);
}
