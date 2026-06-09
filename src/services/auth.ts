import {
  signOut,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithCredential,
  signInAnonymously,
  linkWithPopup,
  type User,
  type UserCredential,
  type OAuthCredential,
} from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp, Timestamp, type FieldValue } from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import { CacheService } from './cache';
import { usePostHog } from '../composables/usePostHog';
import type { SubscriptionTier } from '../types';

/**
 * Profile timestamp fields are:
 * - written as serverTimestamp() sentinels or Timestamp instances (FieldValue | Timestamp)
 * - read back from Firestore as Timestamp
 * - plain { seconds, nanoseconds } objects after a round-trip through the
 *   localStorage cache (JSON serialization strips the Timestamp prototype)
 */
export type ProfileTimestamp = Timestamp | FieldValue | { seconds: number; nanoseconds: number };

export interface UserProfile {
  uid: string;
  email: string;
  displayName?: string;
  createdAt: ProfileTimestamp;
  lastLoginAt: ProfileTimestamp;
  subscriptionTier: SubscriptionTier;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  subscriptionCredits: number; // cents
  prepaidCredits: number; // cents
  creditEpoch: number;
  currentPeriodStart: ProfileTimestamp;
  currentPeriodEnd: ProfileTimestamp;
}

export class AuthService {
  // Credential captured from a failed linkWithPopup, reused for force sign-in
  private static pendingCredential: OAuthCredential | null = null;

  static async signInWithGoogle(forceSignIn: boolean = false): Promise<UserCredential> {
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });

      const currentUser = auth.currentUser;
      let userCredential: UserCredential;
      let wasAnonymous = false;

      if (forceSignIn && this.pendingCredential) {
        // Reuse the credential from the failed link attempt — no second popup
        userCredential = await signInWithCredential(auth, this.pendingCredential);
        this.pendingCredential = null;
        wasAnonymous = true;
      } else if (currentUser && currentUser.isAnonymous && !forceSignIn) {
        // Link anonymous account to Google — preserves UID and all data
        try {
          userCredential = await linkWithPopup(currentUser, provider);
          wasAnonymous = true;
        } catch (linkError: any) {
          if (linkError.code === 'auth/credential-already-in-use') {
            // Capture the credential so we can reuse it without another popup
            this.pendingCredential = GoogleAuthProvider.credentialFromError(linkError);
            const error = new Error(
              'This Google account is already registered. Signing in will switch to that account and your current conversations and credits will not be carried over.'
            );
            (error as any).code = 'auth/credential-already-in-use';
            throw error;
          } else {
            throw linkError;
          }
        }
      } else {
        userCredential = await signInWithPopup(auth, provider);
        if (forceSignIn) {
          wasAnonymous = true;
        }
      }

      const existingProfile = await this.getUserProfile(userCredential.user.uid);

      if (!existingProfile) {
        try {
          await this.createUserProfile(userCredential.user);
        } catch (profileError: any) {
          console.error('Error creating profile for Google user:', profileError);
        }
      } else if (wasAnonymous) {
        // Update profile with Google display info after linking
        await this.updateProfileWithGoogleInfo(userCredential.user);
      } else {
        await this.updateLastLogin(userCredential.user.uid);
      }

      CacheService.cacheAuthState(userCredential.user);

      const analytics = usePostHog();
      // If the profile was just created or just merged with Google info, the
      // cached copy (and `existingProfile`) is stale — bypass the cache.
      const profile = (!existingProfile || wasAnonymous)
        ? await this.getUserProfile(userCredential.user.uid, false)
        : existingProfile;
      if (profile) {
        analytics.identify(userCredential.user.uid, profile);
        analytics.capture('user_signed_in', {
          method: 'google',
          is_new_user: !existingProfile,
          was_anonymous: wasAnonymous,
        });
      }

      return userCredential;
    } catch (error: any) {
      console.error('Google sign-in error:', error);

      if (error.code === 'auth/popup-closed-by-user') {
        throw new Error('Sign-in cancelled. You closed the popup window.');
      }
      if (error.code === 'auth/popup-blocked') {
        throw new Error('Pop-up was blocked by your browser. Please enable pop-ups for this site and try again.');
      }
      if (error.code === 'auth/cancelled-popup-request') {
        throw new Error('Sign-in cancelled. Please try again.');
      }
      if (error.code === 'auth/credential-already-in-use') {
        throw error;
      }

      throw new Error(this.getAuthErrorMessage(error.code));
    }
  }

  static async signInAnonymouslyIfNeeded(): Promise<User | null> {
    if (auth.currentUser) return auth.currentUser;

    try {
      const credential = await signInAnonymously(auth);
      const user = credential.user;

      // Create profile with 200 cents ($2.00) of free credits
      const existingProfile = await this.getUserProfile(user.uid);
      if (!existingProfile) {
        await this.createUserProfile(user);
      }

      CacheService.cacheAuthState(user);

      const analytics = usePostHog();
      analytics.identify(user.uid);
      analytics.capture('anonymous_user_created');

      return user;
    } catch (error) {
      console.error('Anonymous sign-in error:', error);
      return null;
    }
  }

  static isAnonymous(): boolean {
    return auth.currentUser?.isAnonymous ?? false;
  }

  static async logout(): Promise<void> {
    try {
      const analytics = usePostHog();
      analytics.capture('user_signed_out');
      analytics.reset();
      CacheService.clearAll();
      await signOut(auth);
    } catch (error) {
      console.error('Logout error:', error);
      throw new Error('Failed to sign out. Please try again.');
    }
  }

  static getCurrentUser(): User | null {
    return auth.currentUser;
  }

  static async getCurrentUserAsync(): Promise<User | null> {
    await auth.authStateReady();
    return auth.currentUser;
  }

  static onAuthStateChanged(callback: (user: User | null) => void): () => void {
    return onAuthStateChanged(auth, async (user) => {
      if (user) {
        CacheService.cacheAuthState(user);
        const analytics = usePostHog();
        const profile = await this.getUserProfile(user.uid);
        if (profile) {
          analytics.identify(user.uid, profile);
        }
      } else {
        CacheService.clearAuthState();
      }
      callback(user);
    });
  }

  static getCachedAuthState() {
    return CacheService.getCachedAuthState();
  }

  static async getUserProfile(uid: string, useCache: boolean = true): Promise<UserProfile | null> {
    try {
      if (useCache) {
        const cached = CacheService.getCachedUserProfile();
        if (cached && cached.uid === uid) {
          return cached;
        }
      }

      const docRef = doc(db, 'users', uid);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const profile = docSnap.data() as UserProfile;
        CacheService.cacheUserProfile(profile);
        return profile;
      }
      return null;
    } catch (error) {
      console.error('[AuthService] Error fetching user profile:', error);
      if (useCache) {
        const cached = CacheService.getCachedUserProfile();
        if (cached && cached.uid === uid) {
          return cached;
        }
      }
      return null;
    }
  }

  private static async createUserProfile(user: User): Promise<void> {
    const periodEnd = new Date();
    periodEnd.setDate(periodEnd.getDate() + 30);

    const userProfile: UserProfile = {
      uid: user.uid,
      email: user.email || '',
      displayName: user.displayName || '',
      createdAt: serverTimestamp(),
      lastLoginAt: serverTimestamp(),
      subscriptionTier: 'free',
      stripeCustomerId: null,
      stripeSubscriptionId: null,
      subscriptionCredits: 200, // 200 cents = $2.00 free-tier credits (credits are stored in cents)
      prepaidCredits: 0,
      creditEpoch: 0,
      currentPeriodStart: serverTimestamp(),
      currentPeriodEnd: Timestamp.fromDate(periodEnd),
    };

    try {
      await setDoc(doc(db, 'users', user.uid), userProfile);
    } catch (error) {
      console.error('Error creating user profile:', error);
      throw error;
    }
  }

  private static async updateProfileWithGoogleInfo(user: User): Promise<void> {
    try {
      // After linkWithPopup the top-level user.displayName (and sometimes
      // email) may not be populated yet — fall back to the linked Google
      // provider data so the merged profile gets the Google account info.
      const googleInfo = user.providerData.find(p => p.providerId === 'google.com');
      const userRef = doc(db, 'users', user.uid);
      await setDoc(userRef, {
        email: user.email || googleInfo?.email || '',
        displayName: user.displayName || googleInfo?.displayName || '',
        lastLoginAt: serverTimestamp(),
      }, { merge: true });
      // Invalidate the cached profile so the merged info is read back fresh
      CacheService.clearUserProfile();
    } catch (error) {
      console.error('Error updating profile with Google info:', error);
    }
  }

  private static async updateLastLogin(uid: string): Promise<void> {
    try {
      const userRef = doc(db, 'users', uid);
      await setDoc(userRef, { lastLoginAt: serverTimestamp() }, { merge: true });
    } catch (error) {
      console.error('Error updating last login:', error);
    }
  }

  private static getAuthErrorMessage(errorCode: string): string {
    switch (errorCode) {
      case 'auth/invalid-email':
        return 'The email address is invalid. Please check it and try again.';
      case 'auth/operation-not-allowed':
        return 'This sign-in method is not enabled. Please contact support.';
      case 'auth/user-not-found':
        return 'No account found with these credentials. Please sign up first.';
      case 'auth/invalid-credential':
        return 'The sign-in credential is invalid or has expired. Please try again.';
      case 'auth/email-already-in-use':
        return 'An account with this email already exists. Please sign in instead.';
      case 'auth/web-storage-unsupported':
        return 'Your browser has storage disabled. Please enable cookies/site data and try again.';
      case 'auth/user-disabled':
        return 'This account has been disabled. Please contact support for assistance.';
      case 'auth/too-many-requests':
        return 'Too many failed attempts. Please try again in a few minutes.';
      case 'auth/network-request-failed':
        return 'Network error. Please check your internet connection and try again.';
      case 'auth/timeout':
        return 'Request timed out. Please check your connection and try again.';
      case 'auth/popup-closed-by-user':
        return 'Sign-in cancelled. You closed the popup window.';
      case 'auth/popup-blocked':
        return 'Pop-up was blocked by your browser. Please enable pop-ups for this site and try again.';
      case 'auth/cancelled-popup-request':
        return 'Sign-in cancelled. Please try again.';
      case 'auth/unauthorized-domain':
        return 'This domain is not authorized for OAuth operations. Please contact support.';
      case 'auth/account-exists-with-different-credential':
        return 'An account already exists with this email. Please sign in with Google.';
      case 'auth/credential-already-in-use':
        return 'This credential is already associated with a different account.';
      case 'auth/requires-recent-login':
        return 'This operation requires recent authentication. Please sign out and sign in again.';
      case 'auth/user-token-expired':
        return 'Your session has expired. Please sign in again.';
      case 'auth/invalid-user-token':
        return 'Your authentication token is invalid. Please sign in again.';
      case 'auth/internal-error':
        return 'An internal error occurred. Please try again later.';
      case 'auth/invalid-api-key':
        return 'Invalid API key. Please contact support.';
      case 'auth/app-deleted':
        return 'This app instance has been deleted. Please refresh the page.';
      default:
        return 'An unexpected error occurred. Please try again or contact support if the problem persists.';
    }
  }
}
