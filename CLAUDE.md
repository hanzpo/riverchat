# RiverChat — Contributor / AI Context

RiverChat is a branching AI chat app: conversations are a graph ("river") where any message can fork into parallel threads, each potentially answered by a different LLM. Vue 3 + TypeScript + Vite frontend, Firebase (Auth, Firestore, Cloud Functions) backend. LLM calls go through OpenRouter, proxied server-side by a Cloud Function — the client never talks to OpenRouter directly.

## Architecture

```
src/                      Frontend (Vue 3 + TS)
  components/             UI (GraphCanvas, ChatModal, ModelDropdown, Settings, ...)
  composables/            State/logic (useRiverChat, useChatPanel, useSubscription, ...)
  services/               IO layer: auth, firestore-storage, cloud-functions (callable
                          wrappers), llm-api / openrouter (chat streaming via backend)
  config/                 firebase.ts (app init), models.ts (model catalog — see invariants)
  router/, types/, utils/
functions/                Firebase Cloud Functions (separate npm package, Node 22, tsc build)
  src/functions/          streamChat, getModels, getBalance, createCheckout,
                          createTopupCheckout, createPortalSession, stripeWebhook,
                          resetMonthlyCredits
  src/services/           openrouter (server-side proxy, holds the API key), credits,
                          stripe, usage
  src/config/             models.ts + tiers.ts (authoritative catalog + MARKUP_MULTIPLIER)
  src/middleware/         auth (callable auth checks)
e2e/                      Playwright suite (bug-hunt.spec.ts)
public/                   Static assets (sitemap, robots, og images, _headers)
```

## Key invariants

- **Duplicated model catalog**: the model list exists in BOTH `src/config/models.ts` (client) and `functions/src/config/models.ts` (server, authoritative for pricing). They MUST stay in sync — a sync test in `src/config/` guards this. If you add/remove/rename a model, change both files.
- **Credits are integer cents.** All balance/cost fields (`subscriptionCredits`, `prepaidCredits`, `total`, usage `cost`) are cents, never dollars or floats of dollars.
- **Pricing markup is 1.5x** OpenRouter cost (`MARKUP_MULTIPLIER` in `functions/src/config/tiers.ts`). User-facing per-token prices are computed from `orPrice * 1.5`.
- **Never expose API keys client-side.** The OpenRouter key lives only in Cloud Functions. Do not add `VITE_`-prefixed env vars for LLM provider keys — anything `VITE_*` is bundled into the client.

## Commands

Root (frontend):

```bash
npm run dev            # Vite dev server
npm test               # vitest run (unit tests)
npm run test:coverage  # vitest with v8 coverage -> coverage/
npm run typecheck      # vue-tsc -b
npm run build          # typecheck + vite production build
npm run lint           # ESLint (flat config; errors gate, warnings are legacy debt)
npm run format         # Prettier over src/
npm run deploy         # builds functions then `firebase deploy`
```

Functions (run inside `functions/`):

```bash
npm ci && npm run build   # tsc
npm test                  # if/when a test script exists (CI uses --if-present)
npm run serve             # build + firebase emulators (functions only)
```

## CI

- `ci.yml` (pull_request): root install, typecheck, unit tests, frontend build; functions install/build (+ tests if present).
- `deploy-firebase.yml` (push to main): same checks job, then deploy (needs checks; `concurrency: deploy-firebase` prevents racing deploys).
- Lint is NOT a CI gate yet — the codebase hasn't been formatted/cleaned, so most style/`any` findings are warnings. Don't add new errors; tighten rules over time.

## E2E tests (local only — not in CI)

The Playwright suite needs a real Firebase project config and therefore does not run in CI (no secrets are provisioned for it):

1. Copy `.env.example` to `.env` and fill in the `VITE_FIREBASE_*` values.
2. `npx playwright install chromium` (first time).
3. `npx playwright test` — the config auto-starts a Vite dev server on port 5199.

## Conventions

- Do not edit generated output (`dist/`, `functions/lib/`, `coverage/`).
- Firestore access goes through `src/services/firestore-storage.ts`; callable functions through `src/services/cloud-functions.ts` — don't scatter raw Firebase calls in components.
- ESLint flat config lives in `eslint.config.js`; Prettier in `.prettierrc`.
