/**
 * Static, crawlable marketing pages (pricing + model comparisons).
 *
 * The app itself is a client-rendered SPA, so search engines see almost no
 * text. These pages are rendered from the real model catalog and tier config
 * and committed to public/ so every fact on them (prices, context windows,
 * plan limits) stays true. src/seo/pages.test.ts fails if the committed files
 * drift from the catalog; regenerate with `npm run seo:generate`.
 */
import type { ModelConfig } from '../../functions/src/config/models.js';
import type {
  ModelCategory,
  TierConfig,
  SubscriptionTier,
} from '../../functions/src/config/tiers.js';

export const SITE = 'https://riverchat.app';

/** Flagship models that get pairwise comparison pages. */
export const COMPARISON_MODEL_IDS = [
  'anthropic/claude-opus-5',
  'anthropic/claude-sonnet-5',
  'openai/gpt-5.6-sol',
  'openai/gpt-5.6-terra',
  'google/gemini-3.1-pro-preview',
  'x-ai/grok-4.5',
  'deepseek/deepseek-v4-pro',
  'moonshotai/kimi-k3',
];

export interface SeoInput {
  catalog: ModelConfig[];
  tiers: Record<SubscriptionTier, TierConfig>;
  trialMessages: number;
  lastmod: string; // YYYY-MM-DD, fixed so output is deterministic
}

const CATEGORY_LABEL: Record<ModelCategory, string> = {
  budget: 'Budget',
  standard: 'Standard',
  premium: 'Premium',
  frontier: 'Frontier',
};

export function slugFor(model: ModelConfig): string {
  return model.displayName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function comparisonPath(a: ModelConfig, b: ModelConfig): string {
  return `/compare/${slugFor(a)}-vs-${slugFor(b)}/`;
}

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

function money(dollars: number): string {
  if (dollars === 0) return '$0';
  return dollars < 1 ? `$${dollars.toFixed(3).replace(/0$/, '')}` : `$${dollars.toFixed(2)}`;
}

function contextLabel(tokens: number): string {
  return tokens >= 1_000_000
    ? `${+(tokens / 1_000_000).toFixed(2)}M tokens`
    : `${Math.round(tokens / 1000)}K tokens`;
}

function access(model: ModelConfig, input: SeoInput): string {
  const cat = model.category;
  const plans = (['free', 'pro', 'max'] as SubscriptionTier[])
    .filter((t) => input.tiers[t].modelAccess.includes(cat))
    .map((t) => t.charAt(0).toUpperCase() + t.slice(1));
  const parts = [`${plans.join(', ')} plan${plans.length > 1 ? 's' : ''}`, 'pay-as-you-go credits'];
  if (cat === 'standard' || cat === 'premium') {
    parts.push(`${input.trialMessages} free tries on the Free plan`);
  }
  return parts.join(' · ');
}

const CSS = `
:root{--bg:#0f1115;--bg2:#171a21;--line:#2a2f3a;--text:#e8eaf0;--muted:#9aa3b5;--accent:#0d99ff}
@media (prefers-color-scheme: light){:root{--bg:#fafbfc;--bg2:#ffffff;--line:#e3e6eb;--text:#12151b;--muted:#5b6475}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--text);font:16px/1.65 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif}
a{color:var(--accent)}
.wrap{max-width:880px;margin:0 auto;padding:0 16px}
header{display:flex;justify-content:space-between;align-items:center;padding:20px 0;border-bottom:1px solid var(--line)}
header a{text-decoration:none;color:var(--text);font-weight:600}
nav a{margin-left:18px;color:var(--muted);font-weight:500}
h1{font-size:clamp(28px,5vw,40px);line-height:1.15;margin:40px 0 12px}
h2{font-size:22px;margin:40px 0 12px}
.lede{color:var(--muted);font-size:18px}
table{width:100%;border-collapse:collapse;font-size:15px;display:block;overflow-x:auto}
th,td{text-align:left;padding:10px 12px;border-bottom:1px solid var(--line);vertical-align:top}
th{color:var(--muted);font-weight:600}
.cards{display:grid;gap:16px;grid-template-columns:repeat(auto-fit,minmax(190px,1fr))}
.card{background:var(--bg2);border:1px solid var(--line);border-radius:12px;padding:18px}
.card b{font-size:22px;display:block}
.cta{display:inline-block;background:var(--accent);color:#fff;text-decoration:none;font-weight:600;padding:12px 20px;border-radius:10px;margin:8px 0}
ul.links{columns:2;padding-left:18px} @media(max-width:560px){ul.links{columns:1}}
footer{margin:56px 0 40px;padding-top:20px;border-top:1px solid var(--line);color:var(--muted);font-size:14px}
`;

function page(title: string, description: string, path: string, body: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${SITE}${path}">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${SITE}${path}">
<meta property="og:image" content="${SITE}/og-image.png">
<style>${CSS}</style>
</head>
<body>
<div class="wrap">
<header><a href="/">🌊 RiverChat</a><nav><a href="/pricing/">Pricing</a><a href="/compare/">Compare models</a></nav></header>
${body}
<footer>RiverChat lets you send one prompt to several AI models at once and branch conversations as a visual tree. Prices shown are per million tokens and come from RiverChat's live model catalog.</footer>
</div>
</body>
</html>
`;
}

function renderPricing(input: SeoInput): string {
  const { tiers } = input;
  const d = (cents: number) => `$${(cents / 100).toFixed(0)}`;
  const cats = (t: SubscriptionTier) =>
    tiers[t].modelAccess.map((c) => CATEGORY_LABEL[c]).join(', ');
  const limit = (t: SubscriptionTier) =>
    tiers[t].maxModelsPerPrompt === -1 ? 'Unlimited' : String(tiers[t].maxModelsPerPrompt);
  const rows = [...input.catalog]
    .sort((a, b) => a.pricing.prompt - b.pricing.prompt)
    .map(
      (m) =>
        `<tr><td>${esc(m.displayName)}</td><td>${esc(m.provider)}</td><td>${CATEGORY_LABEL[m.category]}</td><td>${money(m.pricing.prompt)}</td><td>${money(m.pricing.completion)}</td><td>${contextLabel(m.contextLength)}</td></tr>`
    )
    .join('\n');
  const body = `
<h1>RiverChat pricing</h1>
<p class="lede">Start free, pay as you go from $5, or subscribe for monthly credits. Every plan lets you compare models side by side.</p>
<div class="cards">
  <div class="card"><h3>Free</h3><b>$0</b><p>${d(tiers.free.monthlyCredits)} of credits every month · ${cats('free')} models · up to ${limit('free')} models per prompt · ${input.trialMessages} free tries of Standard and Premium models</p></div>
  <div class="card"><h3>Pay as you go</h3><b>from $5</b><p>Credits never expire and unlock every model, including Frontier. You only pay for the tokens you use.</p></div>
  <div class="card"><h3>Pro</h3><b>${d(tiers.pro.price)}/mo</b><p>${d(tiers.pro.monthlyCredits)} of credits every month · ${cats('pro')} models · up to ${limit('pro')} models per prompt · web search</p></div>
  <div class="card"><h3>Max</h3><b>${d(tiers.max.price)}/mo</b><p>${d(tiers.max.monthlyCredits)} of credits every month · ${cats('max')} models · ${limit('max')} models per prompt · web search</p></div>
</div>
<p><a class="cta" href="/">Try RiverChat free →</a></p>
<h2>Model prices</h2>
<p>Usage is billed per token from your credits. Prices are per million tokens.</p>
<table>
<tr><th>Model</th><th>Provider</th><th>Tier</th><th>Input</th><th>Output</th><th>Context</th></tr>
${rows}
</table>
<h2>Questions</h2>
<p><strong>Do I need an account?</strong> No. You can start chatting immediately. Create a free account to keep your conversations and to buy credits.</p>
<p><strong>What happens when my monthly credits run out?</strong> Prepaid credits are used next. Without either, you can keep using RiverChat once your monthly credits reset.</p>
<p><strong>Can I cancel a subscription?</strong> Yes, any time from Settings → Manage Billing.</p>
`;
  return page(
    'RiverChat Pricing: Free, Pay-as-you-go, Pro and Max',
    'RiverChat pricing: free monthly credits, pay-as-you-go credits from $5 that unlock every model, and Pro and Max plans. Per-token prices for every model.',
    '/pricing/',
    body
  );
}

function renderComparison(a: ModelConfig, b: ModelConfig, input: SeoInput, others: string): string {
  const row = (label: string, fa: (m: ModelConfig) => string) =>
    `<tr><th>${label}</th><td>${fa(a)}</td><td>${fa(b)}</td></tr>`;
  const cheaper =
    a.pricing.completion === b.pricing.completion
      ? `${esc(a.displayName)} and ${esc(b.displayName)} cost the same per output token on RiverChat.`
      : `${esc((a.pricing.completion < b.pricing.completion ? a : b).displayName)} is cheaper per output token on RiverChat.`;
  const body = `
<h1>${esc(a.displayName)} vs ${esc(b.displayName)}</h1>
<p class="lede">Send the same prompt to ${esc(a.displayName)} and ${esc(b.displayName)} at once and read the answers side by side, then branch the conversation from whichever answer is better.</p>
<p><a class="cta" href="/">Compare them in RiverChat →</a></p>
<h2>At a glance</h2>
<table>
<tr><th></th><th>${esc(a.displayName)}</th><th>${esc(b.displayName)}</th></tr>
${row('Provider', (m) => esc(m.provider))}
${row('Context window', (m) => contextLabel(m.contextLength))}
${row('Input price (per 1M tokens)', (m) => money(m.pricing.prompt))}
${row('Output price (per 1M tokens)', (m) => money(m.pricing.completion))}
${row('RiverChat tier', (m) => CATEGORY_LABEL[m.category])}
${row('Available with', (m) => access(m, input))}
</table>
<p>${cheaper}</p>
<h2>How to compare them yourself</h2>
<ol>
<li>Open RiverChat and pick ${esc(a.displayName)} as your model.</li>
<li>Click <strong>+</strong> next to the model picker and add ${esc(b.displayName)}.</li>
<li>Send one prompt. Both answers appear next to each other in the conversation tree.</li>
<li>Continue from the better answer, or branch from both to see where they diverge.</li>
</ol>
<p>Benchmarks rarely match your own work, so test prompts from your real tasks: a bug you fixed last week, an email you need to write, or a document you want summarized.</p>
<h2>Other comparisons</h2>
<ul class="links">${others}</ul>
`;
  return page(
    `${a.displayName} vs ${b.displayName}: Compare Side by Side | RiverChat`,
    `Compare ${a.displayName} (${a.provider}) and ${b.displayName} (${b.provider}): context window, price per million tokens, and a side-by-side test with the same prompt.`,
    comparisonPath(a, b),
    body
  );
}

export function comparisonPairs(catalog: ModelConfig[]): [ModelConfig, ModelConfig][] {
  const models = COMPARISON_MODEL_IDS.map((id) => {
    const m = catalog.find((x) => x.id === id);
    if (!m) throw new Error(`Comparison model missing from catalog: ${id}`);
    return m;
  });
  const pairs: [ModelConfig, ModelConfig][] = [];
  models.forEach((a, i) => {
    for (const b of models.slice(i + 1)) pairs.push([a, b]);
  });
  return pairs;
}

/** Render every static page. Keys are file paths relative to public/. */
export function renderSeoPages(input: SeoInput): Record<string, string> {
  const files: Record<string, string> = {};
  files['pricing/index.html'] = renderPricing(input);

  const pairs = comparisonPairs(input.catalog);
  const link = ([a, b]: [ModelConfig, ModelConfig]) =>
    `<li><a href="${comparisonPath(a, b)}">${esc(a.displayName)} vs ${esc(b.displayName)}</a></li>`;
  for (const pair of pairs) {
    const [a, b] = pair;
    const others = pairs
      .filter((p) => p !== pair && (p.includes(a) || p.includes(b)))
      .map(link)
      .join('');
    files[`${comparisonPath(a, b).slice(1)}index.html`] = renderComparison(a, b, input, others);
  }

  files['compare/index.html'] = page(
    'Compare AI Models Side by Side | RiverChat',
    'Side-by-side comparisons of Claude, GPT, Gemini, Grok, DeepSeek and Kimi models: context windows, prices, and how to test them with the same prompt.',
    '/compare/',
    `<h1>Compare AI models side by side</h1>
<p class="lede">RiverChat sends one prompt to several models at once, so you can judge them on your own work instead of on benchmarks.</p>
<p><a class="cta" href="/">Start comparing free →</a></p>
<ul class="links">${pairs.map(link).join('')}</ul>`
  );

  const urls = ['/', '/pricing/', '/compare/', ...pairs.map(([a, b]) => comparisonPath(a, b))];
  files['sitemap.xml'] =
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    urls
      .map(
        (u) =>
          `  <url>\n    <loc>${SITE}${u}</loc>\n    <lastmod>${input.lastmod}</lastmod>\n  </url>\n`
      )
      .join('') +
    `</urlset>\n`;
  return files;
}
