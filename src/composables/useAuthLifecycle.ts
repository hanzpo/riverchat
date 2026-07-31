import { ref } from 'vue';
import { AuthService } from '../services/auth';
import { auth } from '../config/firebase';
import type { ChatPanelUser } from './useChatPanel';
import type { ShowToast } from './useToast';

export interface AuthLifecycleDeps {
  /** Reload app data; `forceRefresh` bypasses caches (used on real login). */
  initialize: (forceRefresh?: boolean) => Promise<void>;
  /** Clear chat model selection before re-initializing to avoid stale models. */
  clearSelectedModels: () => void;
  /** Clear all river/selection state (used on logout). */
  clearState: () => void;
  showToast: ShowToast;
}

/**
 * Authentication lifecycle for the app shell (extracted from App.vue):
 * optimistic cached-auth restore, session bootstrap, auth-change
 * re-initialization, and logout.
 */
export function useAuthLifecycle(deps: AuthLifecycleDeps) {
  // `ChatPanelUser` is the minimal user shape the UI needs; a real Firebase
  // `User` satisfies it, and so does the optimistic cached-auth state
  // restored before Firebase Auth is ready.
  const currentUser = ref<ChatPanelUser | null>(null);
  const isAuthenticating = ref(false);

  /** Restore cached auth state for optimistic rendering before Firebase Auth is ready. */
  function restoreCachedUser() {
    const cachedAuth = AuthService.getCachedAuthState();
    if (cachedAuth) {
      console.log('[App] Found cached auth state, using optimistically');
      // Set optimistic user state (will be confirmed by Firebase Auth)
      currentUser.value = {
        uid: cachedAuth.uid,
        email: cachedAuth.email,
        displayName: cachedAuth.displayName,
      };
    }
  }

  /**
   * Wait for Firebase Auth to restore any persisted session, then auto-sign
   * in anonymously if there is no user — this gives them a real Firebase
   * session so cloud functions (streamChat, getBalance, etc.) work
   * immediately. Without the authStateReady() wait, returning users who
   * signed in before the subscription system would see 0 credits because
   * refreshBalance() fires before the auth session is restored.
   */
  async function ensureSession() {
    await auth.authStateReady();
    if (!auth.currentUser) {
      await AuthService.signInAnonymouslyIfNeeded();
    }
  }

  /**
   * Subscribe to auth state changes and re-initialize app data when the
   * user state meaningfully changes (login, anonymous-to-real account link,
   * logout). Call once after the initial `initialize()`.
   */
  function listenForAuthChanges() {
    let isFirstAuthCheck = true;
    AuthService.onAuthStateChanged(async (user) => {
      const wasLoggedIn = !!currentUser.value;
      const wasAnonymous = currentUser.value?.isAnonymous ?? false;
      currentUser.value = user;

      if (user) {
        console.log('User authenticated:', user.email || '(anonymous)');

        // Reinitialize if user state meaningfully changed:
        // - First real login (not first auth check)
        // - Anonymous user just linked their Google account
        if (!isFirstAuthCheck && (!wasLoggedIn || (wasAnonymous && !user.isAnonymous))) {
          // Clear chat selection on login to avoid stale models
          deps.clearSelectedModels();

          // User just logged in or linked account - reload data from Firestore with force refresh
          await deps.initialize(true);
        } else {
          console.log('[App] User already initialized, skipping re-initialization');
        }
      } else {
        console.log('User signed out - using localStorage');
        // User is signed out - will use localStorage fallback
        if (wasLoggedIn) {
          // User just logged out, reinitialize with local data
          await deps.initialize();
        }
      }

      isFirstAuthCheck = false;
    });
  }

  async function logout() {
    try {
      isAuthenticating.value = true;
      await AuthService.logout();

      // Clear local state
      deps.clearState();

      deps.showToast('Signed out successfully', 'success');

      // Reload app to use localStorage fallback
      setTimeout(() => {
        window.location.reload();
      }, 500);
    } catch (_error) {
      console.error('Logout error:', _error);
      deps.showToast('Failed to sign out', 'error');
    } finally {
      isAuthenticating.value = false;
    }
  }

  return {
    currentUser,
    isAuthenticating,
    restoreCachedUser,
    ensureSession,
    listenForAuthChanges,
    logout,
  };
}
