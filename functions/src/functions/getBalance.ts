import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getBalance as getBalanceService } from '../services/credits.js';
import { PREMIUM_TRIAL_MESSAGES } from '../config/tiers.js';

export const getBalance = onCall(
  { region: 'us-central1' },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Must be signed in');
    }

    const balance = await getBalanceService(request.auth.uid);
    return {
      subscriptionCredits: balance.subscriptionCredits,
      prepaidCredits: balance.prepaidCredits,
      total: balance.total,
      tier: balance.tier,
      currentPeriodEnd: balance.currentPeriodEnd?.toMillis() ?? null,
      premiumTrialRemaining: Math.max(0, PREMIUM_TRIAL_MESSAGES - balance.premiumTrialUsed),
    };
  }
);
