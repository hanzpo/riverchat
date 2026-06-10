import { createRouter, createWebHistory } from 'vue-router';
import type { RouteRecordRaw } from 'vue-router';
import { usePostHog } from '@/composables/usePostHog';

// RiverChat is a single-page app: App.vue renders everything directly and there
// is no <router-view>. The router exists for URL/history handling and PostHog
// pageview tracking (see afterEach below), so the home route needs a stub
// component that is never rendered. It must be a render function rather than a
// string `template` because the Vite build ships the runtime-only Vue bundle
// (no template compiler).
const EmptyRouteComponent = { render: () => null };

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'home',
    component: EmptyRouteComponent,
  },
];

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
});

// Track page views and route changes
router.afterEach((to) => {
  const { posthog } = usePostHog();
  if (posthog) {
    posthog.capture('$pageview', {
      $current_url: to.fullPath,
    });
  }
});

export default router;
