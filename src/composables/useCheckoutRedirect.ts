import type { usePostHog } from './usePostHog';
import type { ShowToast } from './useToast';

export interface CheckoutRedirectDeps {
  analytics: ReturnType<typeof usePostHog>;
  showToast: ShowToast;
  refreshBalance: () => void;
  refreshModels: () => void;
}

/**
 * Stripe checkout/top-up redirect handling (extracted from App.vue):
 * reads the redirect query params on load, surfaces the outcome, refreshes
 * balance state, and cleans up the URL.
 */
export function useCheckoutRedirect(deps: CheckoutRedirectDeps) {
  function handleRedirectParams() {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('checkout') === 'success') {
      deps.analytics.capture('checkout_completed');
      deps.showToast('Subscription updated successfully!', 'success');
      // Refresh balance to reflect new tier
      deps.refreshBalance();
      deps.refreshModels();
      // Clean up URL
      window.history.replaceState({}, '', window.location.pathname);
    } else if (urlParams.get('checkout') === 'cancel') {
      deps.analytics.capture('checkout_cancelled');
      deps.showToast('Checkout cancelled', 'info');
      window.history.replaceState({}, '', window.location.pathname);
    } else if (urlParams.get('topup') === 'success') {
      deps.showToast('Credits added successfully!', 'success');
      deps.refreshBalance();
      window.history.replaceState({}, '', window.location.pathname);
    } else if (urlParams.get('topup') === 'cancel') {
      deps.showToast('Top-up cancelled', 'info');
      window.history.replaceState({}, '', window.location.pathname);
    }
  }

  return { handleRedirectParams };
}
