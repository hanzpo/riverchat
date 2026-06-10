import { functions, httpsCallable } from '../config/firebase';
import type { LLMModel, UserBalance } from '../types';

/**
 * Typed wrappers for Firebase Cloud Functions callable endpoints.
 */

/** Get available models with tier access flags */
export async function callGetModels(): Promise<LLMModel[]> {
  const fn = httpsCallable<void, LLMModel[]>(functions, 'getModels');
  const result = await fn();
  return result.data;
}

/** Get current balance and tier info */
export async function callGetBalance(): Promise<UserBalance> {
  const fn = httpsCallable<void, UserBalance>(functions, 'getBalance');
  const result = await fn();
  return result.data;
}

/** Create a Stripe Checkout session for subscription upgrade */
export async function callCreateCheckout(tier: 'pro' | 'max'): Promise<string> {
  const fn = httpsCallable<{ tier: string }, { url: string }>(functions, 'createCheckout');
  const result = await fn({ tier });
  return result.data.url;
}

/** Create a Stripe Checkout session for credit top-up */
export async function callCreateTopupCheckout(amountCents: number): Promise<string> {
  const fn = httpsCallable<{ amount: number }, { url: string }>(functions, 'createTopupCheckout');
  const result = await fn({ amount: amountCents });
  return result.data.url;
}

/** Create a Stripe Customer Portal session */
export async function callCreatePortalSession(): Promise<string> {
  const fn = httpsCallable<void, { url: string }>(functions, 'createPortalSession');
  const result = await fn();
  return result.data.url;
}
