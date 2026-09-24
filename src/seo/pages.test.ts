/// <reference types="node" />
/**
 * Keeps the committed static pages in public/ in sync with the catalog.
 * Regenerate with: npm run seo:generate
 */
import { describe, it, expect } from 'vitest';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { MODEL_CATALOG } from '../../functions/src/config/models.js';
import { TIER_CONFIGS, PREMIUM_TRIAL_MESSAGES } from '../../functions/src/config/tiers.js';
import { renderSeoPages, comparisonPairs } from './render';

// Vitest runs from the project root.
const PUBLIC_DIR = resolve(process.cwd(), 'public');
const LASTMOD = '2026-09-24';
const files = renderSeoPages({
  catalog: MODEL_CATALOG,
  tiers: TIER_CONFIGS,
  trialMessages: PREMIUM_TRIAL_MESSAGES,
  lastmod: LASTMOD,
});

if (process.env.UPDATE_SEO) {
  for (const [rel, content] of Object.entries(files)) {
    const out = resolve(PUBLIC_DIR, rel);
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, content);
  }
}

describe('static SEO pages', () => {
  it('renders pricing, the compare index, every pair, and the sitemap', () => {
    const pairs = comparisonPairs(MODEL_CATALOG).length;
    expect(pairs).toBe(28);
    expect(Object.keys(files)).toHaveLength(pairs + 3);
  });

  it('never prints broken numbers', () => {
    for (const [rel, html] of Object.entries(files)) {
      expect(html, rel).not.toMatch(/NaN|undefined|Infinity|\$-/);
    }
  });

  it('only links to pages that exist', () => {
    const paths = new Set([
      '/',
      ...Object.keys(files).map((f) => '/' + f.replace(/index\.html$/, '')),
    ]);
    for (const [rel, html] of Object.entries(files)) {
      for (const [, href = ''] of html.matchAll(/href="(\/[^"]*)"/g)) {
        if (href.startsWith('/favicon')) continue;
        expect(paths.has(href), `${rel} links to missing ${href}`).toBe(true);
      }
    }
  });

  it('matches the committed files in public/ (run `npm run seo:generate` after catalog changes)', () => {
    for (const [rel, content] of Object.entries(files)) {
      const p = resolve(PUBLIC_DIR, rel);
      expect(existsSync(p), `missing ${rel}`).toBe(true);
      expect(readFileSync(p, 'utf8'), `${rel} is stale`).toBe(content);
    }
  });
});
