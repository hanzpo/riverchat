/**
 * Minimal `process` declaration so the catalog sync test
 * (src/config/models-sync.test.ts) can import backend config from
 * functions/src/ without pulling @types/node into the frontend program
 * (functions/src/config/tiers.ts reads process.env for Stripe price IDs).
 *
 * The frontend itself must NOT rely on `process` at runtime — use
 * import.meta.env instead.
 */
declare const process: { env: Record<string, string | undefined> };
