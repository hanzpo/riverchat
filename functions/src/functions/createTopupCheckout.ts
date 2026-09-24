import { onCall, HttpsError } from 'firebase-functions/v2/https';
import {
  getOrCreateCustomer,
  createTopupCheckout as createTopupSession,
} from '../services/stripe.js';

const MIN_TOPUP_CENTS = 500; // $5.00 minimum
const MAX_TOPUP_CENTS = 50000; // $500.00 maximum

export const createTopupCheckout = onCall(
  { region: 'us-central1' },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Must be signed in');
    }

    // Credits are pay-as-you-go for every plan, but must belong to a real
    // account: anonymous sessions can be lost with the browser's storage.
    if (request.auth.token.firebase?.sign_in_provider === 'anonymous') {
      throw new HttpsError(
        'failed-precondition',
        'Create a free account first so your credits are saved.'
      );
    }

    const { amount } = request.data as { amount: number };
    if (
      typeof amount !== 'number' ||
      !Number.isInteger(amount) ||
      amount < MIN_TOPUP_CENTS ||
      amount > MAX_TOPUP_CENTS
    ) {
      throw new HttpsError(
        'invalid-argument',
        `Amount must be between $${(MIN_TOPUP_CENTS / 100).toFixed(2)} and $${(MAX_TOPUP_CENTS / 100).toFixed(2)}`
      );
    }

    const customerId = await getOrCreateCustomer(
      request.auth.uid,
      request.auth.token.email || ''
    );

    const ALLOWED_ORIGINS = ['https://riverchat.app', 'http://localhost:5173'];
    const requestOrigin = request.rawRequest.headers.origin;
    const origin = (requestOrigin && ALLOWED_ORIGINS.includes(requestOrigin))
      ? requestOrigin
      : 'https://riverchat.app';
    const url = await createTopupSession(
      customerId,
      amount,
      request.auth.uid,
      `${origin}/?topup=success`,
      `${origin}/?topup=cancel`
    );

    return { url };
  }
);
