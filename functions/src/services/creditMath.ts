/**
 * Pure credit math helpers, kept free of Firestore/admin imports so they can
 * be unit tested directly. The transactional code in credits.ts delegates the
 * bucket arithmetic here.
 */

export interface DeductionSplit {
  /** Amount taken from subscription credits */
  subDeduction: number;
  /** Amount taken from prepaid credits */
  prepaidDeduction: number;
  /** Subscription balance after the deduction */
  subCredits: number;
  /** Prepaid balance after the deduction (may go negative if allowOverage) */
  prepaidCredits: number;
  /** Portion of the amount that could not be covered (0 unless allowOverage) */
  overage: number;
}

/**
 * Split a deduction across the two credit buckets: subscription credits
 * first, then prepaid. With `allowOverage`, any uncovered remainder is
 * charged to prepaid (which may go negative); otherwise it is reported in
 * `overage` and the balances only reflect what was actually covered.
 */
export function splitDeduction(
  subCredits: number,
  prepaidCredits: number,
  amountCents: number,
  allowOverage: boolean
): DeductionSplit {
  let remaining = amountCents;

  const subDeduction = Math.min(subCredits, remaining);
  remaining -= subDeduction;

  const prepaidDeduction = Math.min(prepaidCredits, remaining);
  remaining -= prepaidDeduction;

  let prepaidAfter = prepaidCredits - prepaidDeduction;
  if (remaining > 0 && allowOverage) {
    prepaidAfter -= remaining;
    remaining = 0;
  }

  return {
    subDeduction,
    prepaidDeduction,
    subCredits: subCredits - subDeduction,
    prepaidCredits: prepaidAfter,
    overage: remaining,
  };
}

export interface ReconcileInput {
  /** Current subscription credit balance */
  subCredits: number;
  /** Current prepaid credit balance */
  prepaidCredits: number;
  /** actualCents - reservedCents */
  diff: number;
  /** Portion of the original reservation taken from prepaid credits */
  reservedFromPrepaid: number;
  /** Whether the credit epoch changed since the reservation was made */
  epochChanged: boolean;
}

export interface ReconcileResult {
  subCredits: number;
  prepaidCredits: number;
  /**
   * Subscription refund that was intentionally dropped because the
   * subscription balance was reset (epoch changed) since the reservation.
   */
  droppedSubscriptionRefund: number;
}

/**
 * Compute the post-reconciliation balances for a reservation.
 * - diff < 0: refund the difference (prepaid first — the reverse of the
 *   deduction order — then subscription unless the epoch changed).
 * - diff > 0: deduct the extra (subscription first unless the epoch changed,
 *   then prepaid, allowing overage).
 */
export function computeReconciledBalances(
  input: ReconcileInput
): ReconcileResult {
  let { subCredits, prepaidCredits } = input;
  const { diff, reservedFromPrepaid, epochChanged } = input;

  let droppedSubscriptionRefund = 0;
  if (diff < 0) {
    let refundRemaining = Math.abs(diff);
    const prepaidRefund = Math.min(refundRemaining, reservedFromPrepaid);
    prepaidCredits += prepaidRefund;
    refundRemaining -= prepaidRefund;
    if (!epochChanged) {
      // Only refund to subscription credits if the subscription balance
      // hasn't been replaced since the reservation was made.
      subCredits += refundRemaining;
    } else {
      droppedSubscriptionRefund = refundRemaining;
    }
  } else if (diff > 0) {
    let remaining = diff;
    if (!epochChanged) {
      // Only deduct from subscription credits if the balance hasn't been
      // replaced since the reservation was made.
      const subDeduction = Math.min(subCredits, remaining);
      subCredits -= subDeduction;
      remaining -= subDeduction;
    }
    // Allow overage on prepaid (same as the original deduction behavior)
    prepaidCredits -= remaining;
  }

  return { subCredits, prepaidCredits, droppedSubscriptionRefund };
}
