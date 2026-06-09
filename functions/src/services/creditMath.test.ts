import { describe, expect, it } from 'vitest';
import { splitDeduction, computeReconciledBalances } from './creditMath.js';

describe('splitDeduction', () => {
  it('deducts from subscription credits first', () => {
    const result = splitDeduction(100, 50, 80, false);
    expect(result).toEqual({
      subDeduction: 80,
      prepaidDeduction: 0,
      subCredits: 20,
      prepaidCredits: 50,
      overage: 0,
    });
  });

  it('spills over into prepaid credits', () => {
    const result = splitDeduction(100, 50, 120, false);
    expect(result).toEqual({
      subDeduction: 100,
      prepaidDeduction: 20,
      subCredits: 0,
      prepaidCredits: 30,
      overage: 0,
    });
  });

  it('handles an exact full drain', () => {
    const result = splitDeduction(10, 5, 15, false);
    expect(result.subCredits).toBe(0);
    expect(result.prepaidCredits).toBe(0);
    expect(result.overage).toBe(0);
  });

  it('reports uncovered amount as overage when overage is not allowed', () => {
    const result = splitDeduction(10, 5, 20, false);
    expect(result.subDeduction).toBe(10);
    expect(result.prepaidDeduction).toBe(5);
    expect(result.prepaidCredits).toBe(0);
    expect(result.overage).toBe(5);
  });

  it('charges uncovered amount to prepaid (going negative) when overage is allowed', () => {
    const result = splitDeduction(10, 5, 20, true);
    expect(result.prepaidCredits).toBe(-5);
    expect(result.overage).toBe(0);
  });

  it('is a no-op for a zero amount', () => {
    const result = splitDeduction(100, 50, 0, false);
    expect(result.subCredits).toBe(100);
    expect(result.prepaidCredits).toBe(50);
    expect(result.subDeduction).toBe(0);
    expect(result.prepaidDeduction).toBe(0);
  });

  it('conserves credits: deductions equal the balance change', () => {
    const cases: Array<[number, number, number, boolean]> = [
      [100, 50, 80, false],
      [100, 50, 120, false],
      [10, 5, 20, true],
      [0, 0, 7, true],
    ];
    for (const [sub, prepaid, amount, allowOverage] of cases) {
      const r = splitDeduction(sub, prepaid, amount, allowOverage);
      const charged = amount - r.overage;
      expect(sub + prepaid - (r.subCredits + r.prepaidCredits)).toBe(charged);
    }
  });
});

describe('computeReconciledBalances', () => {
  it('leaves balances unchanged when actual equals reserved (diff 0)', () => {
    const result = computeReconciledBalances({
      subCredits: 100,
      prepaidCredits: 50,
      diff: 0,
      reservedFromPrepaid: 10,
      epochChanged: false,
    });
    expect(result).toEqual({
      subCredits: 100,
      prepaidCredits: 50,
      droppedSubscriptionRefund: 0,
    });
  });

  it('refunds prepaid first (reverse of deduction order), then subscription', () => {
    const result = computeReconciledBalances({
      subCredits: 100,
      prepaidCredits: 50,
      diff: -30,
      reservedFromPrepaid: 10,
      epochChanged: false,
    });
    expect(result).toEqual({
      subCredits: 120,
      prepaidCredits: 60,
      droppedSubscriptionRefund: 0,
    });
  });

  it('drops the subscription portion of a refund when the epoch changed', () => {
    const result = computeReconciledBalances({
      subCredits: 100,
      prepaidCredits: 50,
      diff: -30,
      reservedFromPrepaid: 10,
      epochChanged: true,
    });
    expect(result).toEqual({
      subCredits: 100,
      prepaidCredits: 60,
      droppedSubscriptionRefund: 20,
    });
  });

  it('caps the prepaid refund at what was reserved from prepaid', () => {
    const result = computeReconciledBalances({
      subCredits: 0,
      prepaidCredits: 0,
      diff: -50,
      reservedFromPrepaid: 50,
      epochChanged: false,
    });
    expect(result.prepaidCredits).toBe(50);
    expect(result.subCredits).toBe(0);
  });

  it('deducts overage from subscription first', () => {
    const result = computeReconciledBalances({
      subCredits: 100,
      prepaidCredits: 50,
      diff: 30,
      reservedFromPrepaid: 0,
      epochChanged: false,
    });
    expect(result).toEqual({
      subCredits: 70,
      prepaidCredits: 50,
      droppedSubscriptionRefund: 0,
    });
  });

  it('spills overage into prepaid when subscription is exhausted', () => {
    const result = computeReconciledBalances({
      subCredits: 20,
      prepaidCredits: 50,
      diff: 30,
      reservedFromPrepaid: 0,
      epochChanged: false,
    });
    expect(result.subCredits).toBe(0);
    expect(result.prepaidCredits).toBe(40);
  });

  it('skips subscription credits for overage when the epoch changed', () => {
    const result = computeReconciledBalances({
      subCredits: 100,
      prepaidCredits: 50,
      diff: 30,
      reservedFromPrepaid: 0,
      epochChanged: true,
    });
    expect(result.subCredits).toBe(100);
    expect(result.prepaidCredits).toBe(20);
  });

  it('allows prepaid to go negative on overage', () => {
    const result = computeReconciledBalances({
      subCredits: 0,
      prepaidCredits: 10,
      diff: 30,
      reservedFromPrepaid: 0,
      epochChanged: false,
    });
    expect(result.prepaidCredits).toBe(-20);
  });

  it('conserves credits on refunds: balance grows by |diff| minus dropped refund', () => {
    const inputs = [
      { subCredits: 100, prepaidCredits: 50, diff: -30, reservedFromPrepaid: 10, epochChanged: false },
      { subCredits: 100, prepaidCredits: 50, diff: -30, reservedFromPrepaid: 10, epochChanged: true },
      { subCredits: 0, prepaidCredits: 0, diff: -50, reservedFromPrepaid: 5, epochChanged: true },
    ];
    for (const input of inputs) {
      const r = computeReconciledBalances(input);
      const before = input.subCredits + input.prepaidCredits;
      const after = r.subCredits + r.prepaidCredits;
      expect(after - before).toBe(Math.abs(input.diff) - r.droppedSubscriptionRefund);
    }
  });
});
