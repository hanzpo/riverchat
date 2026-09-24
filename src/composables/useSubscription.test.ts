import { describe, it, expect, vi, beforeEach } from 'vitest';

const isAnonymous = vi.fn(() => false);
const callCreateTopupCheckout = vi.fn(
  async (_amountCents: number) => 'https://checkout.example/session'
);

vi.mock('../services/auth', () => ({ AuthService: { isAnonymous: () => isAnonymous() } }));
vi.mock('../services/cloud-functions', () => ({
  callGetBalance: vi.fn(),
  callGetModels: vi.fn(),
  callCreateCheckout: vi.fn(),
  callCreateTopupCheckout: (amount: number) => callCreateTopupCheckout(amount),
  callCreatePortalSession: vi.fn(),
}));

import { useSubscription } from './useSubscription';

describe('useSubscription access rules (mirror resolveModelAccess on the server)', () => {
  const sub = useSubscription();

  beforeEach(() => {
    sub.tier.value = 'free';
    sub.prepaidCredits.value = 0;
    sub.premiumTrialRemaining.value = 0;
  });

  it('free users without trial or credits only get budget models', () => {
    expect(sub.canAccessCategory('budget')).toBe(true);
    for (const cat of ['standard', 'premium', 'frontier'] as const) {
      expect(sub.canAccessCategory(cat)).toBe(false);
    }
  });

  it('the free trial unlocks standard and premium but not frontier', () => {
    sub.premiumTrialRemaining.value = 2;
    expect(sub.canAccessCategory('standard')).toBe(true);
    expect(sub.canAccessCategory('premium')).toBe(true);
    expect(sub.isTrialCategory('premium')).toBe(true);
    expect(sub.canAccessCategory('frontier')).toBe(false);
    expect(sub.isTrialCategory('budget')).toBe(false);
  });

  it('any prepaid balance unlocks every category and is not a trial', () => {
    sub.prepaidCredits.value = 500;
    sub.premiumTrialRemaining.value = 3;
    for (const cat of ['standard', 'premium', 'frontier'] as const) {
      expect(sub.canAccessCategory(cat)).toBe(true);
      expect(sub.isTrialCategory(cat)).toBe(false);
    }
  });

  it('pro includes premium through the plan, not the trial', () => {
    sub.tier.value = 'pro';
    sub.premiumTrialRemaining.value = 3;
    expect(sub.isTrialCategory('premium')).toBe(false);
    expect(sub.canAccessCategory('frontier')).toBe(false);
  });
});

describe('buyCredits', () => {
  const sub = useSubscription();

  beforeEach(() => {
    callCreateTopupCheckout.mockClear();
    sub.authRequiredForPurchase.value = false;
    sub.pendingCreditPurchase.value = null;
  });

  it('asks anonymous users to sign up and remembers the purchase instead of starting checkout', async () => {
    isAnonymous.mockReturnValue(true);
    await sub.buyCredits(500);
    expect(callCreateTopupCheckout).not.toHaveBeenCalled();
    expect(sub.authRequiredForPurchase.value).toBe(true);
    expect(sub.pendingCreditPurchase.value).toBe(500);
  });

  it('starts checkout for signed-in users and clears any pending purchase', async () => {
    isAnonymous.mockReturnValue(false);
    sub.pendingCreditPurchase.value = 500;
    const assign = vi.fn();
    vi.stubGlobal('location', {
      set href(v: string) {
        assign(v);
      },
    });
    await sub.buyCredits(500);
    expect(callCreateTopupCheckout).toHaveBeenCalledWith(500);
    expect(assign).toHaveBeenCalledWith('https://checkout.example/session');
    expect(sub.pendingCreditPurchase.value).toBeNull();
    vi.unstubAllGlobals();
  });
});
