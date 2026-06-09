import { onSchedule } from 'firebase-functions/v2/scheduler';
import * as admin from 'firebase-admin';
import { TIER_CONFIGS } from '../config/tiers.js';

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

/**
 * Daily scheduled function to reset subscription credits for free-tier users.
 * Pro/Max resets are handled by the Stripe invoice.payment_succeeded webhook.
 */
export const resetMonthlyCredits = onSchedule(
  {
    schedule: 'every 24 hours',
    region: 'us-central1',
    timeoutSeconds: 300,
  },
  async () => {
    const now = admin.firestore.Timestamp.now();
    const BATCH_SIZE = 500;

    // Find free-tier users whose billing period has ended, paginated with a
    // cursor so the job scales beyond what a single unbounded query returns.
    // The inequality filter requires ordering by currentPeriodEnd first;
    // documentId is appended as a tiebreaker for a stable cursor.
    let lastDoc: FirebaseFirestore.QueryDocumentSnapshot | null = null;
    let totalReset = 0;

    while (true) {
      let query = db
        .collection('users')
        .where('subscriptionTier', '==', 'free')
        .where('currentPeriodEnd', '<=', now)
        .orderBy('currentPeriodEnd')
        .orderBy(admin.firestore.FieldPath.documentId())
        .limit(BATCH_SIZE);
      if (lastDoc) {
        query = query.startAfter(lastDoc);
      }

      const snapshot = await query.get();
      if (snapshot.empty) break;

      totalReset += snapshot.size;
      await resetBatch(snapshot.docs);

      if (snapshot.size < BATCH_SIZE) break;
      lastDoc = snapshot.docs[snapshot.docs.length - 1];
    }

    if (totalReset === 0) {
      console.log('No free-tier users need credit reset');
      return;
    }

    console.log(`Free-tier credit reset complete (${totalReset} users)`);
  }
);

async function resetBatch(
  docs: FirebaseFirestore.QueryDocumentSnapshot[]
): Promise<void> {
  const promises: Promise<void>[] = [];

  for (const doc of docs) {
    const uid = doc.id;
    const userRef = db.doc(`users/${uid}`);

    // Reset credits and update period in a single transaction
    promises.push(
      db.runTransaction(async (tx) => {
        const userDoc = await tx.get(userRef);
        if (!userDoc.exists) return;

        const data = userDoc.data()!;
        // Re-validate tier inside the transaction to avoid racing with upgrades
        if (data.subscriptionTier !== 'free') return;

        const newPeriodEnd = new Date();
        newPeriodEnd.setDate(newPeriodEnd.getDate() + 30);

        const currentEpoch: number = userDoc.data()!.creditEpoch ?? 0;
        tx.update(userRef, {
          subscriptionCredits: TIER_CONFIGS.free.monthlyCredits,
          creditEpoch: currentEpoch + 1,
          currentPeriodEnd:
            admin.firestore.Timestamp.fromDate(newPeriodEnd),
        });

        // Write credit transaction record
        const txRef = db.collection(`users/${uid}/creditTransactions`).doc();
        tx.set(txRef, {
          id: txRef.id,
          userId: uid,
          amount: TIER_CONFIGS.free.monthlyCredits,
          type: 'subscription_credit',
          description: 'Monthly free credits reset',
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
          balanceAfter: {
            subscription: TIER_CONFIGS.free.monthlyCredits,
            prepaid: userDoc.data()!.prepaidCredits ?? 0,
            total: TIER_CONFIGS.free.monthlyCredits + (userDoc.data()!.prepaidCredits ?? 0),
          },
        });
      })
    );
  }

  await Promise.all(promises);
}
