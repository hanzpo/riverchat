import { onRequest, type Request } from 'firebase-functions/v2/https';
import type { Response } from 'express';
import { verifyAuth, AuthError } from '../middleware/auth.js';
import { getModelConfig, calculateCostCents } from '../config/models.js';
import { tierCanAccessCategory, TIER_CONFIGS } from '../config/tiers.js';
import {
  getBalance,
  reserveCredits,
  reconcileReservation,
  refundReservation,
  InsufficientBalanceError,
  type CreditReservation,
  type DeductionResult,
} from '../services/credits.js';
import { recordUsage } from '../services/usage.js';
import {
  streamFromOpenRouter,
  getGenerationInfo,
  estimateTokenCount,
} from '../services/openrouter.js';

// Same explicit origin whitelist as the checkout functions.
const ALLOWED_ORIGINS = ['https://riverchat.app', 'http://localhost:5173'];

// Request validation limits (generous — a full 200k-token context is ~800k
// chars, but no legitimate single chat request needs more than this).
const MAX_MESSAGE_COUNT = 200;
const MAX_TOTAL_CONTENT_CHARS = 400_000;

// Per-user concurrent stream cap.
// LIMITATION: this map is per function instance, so with N instances the
// effective global cap is N * MAX_CONCURRENT_STREAMS_PER_USER. We accept
// that: it still bounds abuse without the failure mode of a Firestore
// counter, which can leak permanently if an instance dies before the
// decrement in `finally` runs. In-memory state simply resets on recycle.
const MAX_CONCURRENT_STREAMS_PER_USER = 5;
const activeStreamsByUid = new Map<string, number>();

/** Final SSE usage event sent to the client after the stream completes. */
interface UsageEvent {
  type: 'usage';
  cost: number;
  promptTokens: number;
  completionTokens: number;
  balanceAfter?: DeductionResult;
}

/**
 * Structured, alertable log for credit refund/reconcile failures.
 * Keep the '[credit-reconcile-failure]' prefix stable — alerts match on it.
 */
function logCreditReconcileFailure(
  stage: 'refund' | 'partial-reconcile' | 'final-reconcile',
  context: {
    uid: string;
    modelId: string;
    reservation: CreditReservation;
    amountCents: number | null;
  },
  err: unknown
): void {
  console.error(
    '[credit-reconcile-failure]',
    JSON.stringify({
      stage,
      uid: context.uid,
      modelId: context.modelId,
      reservedCents: context.reservation.reservedCents,
      reservedFromSubscription: context.reservation.reservedFromSubscription,
      reservedFromPrepaid: context.reservation.reservedFromPrepaid,
      creditEpoch: context.reservation.creditEpoch,
      amountCents: context.amountCents,
    }),
    err
  );
}

export const streamChat = onRequest(
  {
    region: 'us-central1',
    timeoutSeconds: 300,
    memory: '256MiB',
    maxInstances: 100,
  },
  async (req, res) => {
    // CORS: explicit origin whitelist (mirrors the checkout functions).
    // Non-whitelisted origins get no Access-Control-Allow-Origin header,
    // so browsers will block cross-origin reads.
    const origin = req.headers.origin;
    if (origin && ALLOWED_ORIGINS.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
    }

    // CORS preflight
    if (req.method === 'OPTIONS') {
      res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      res.setHeader('Access-Control-Max-Age', '3600');
      res.status(204).send('');
      return;
    }
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }

    // 1. Authenticate
    let uid: string;
    try {
      const decoded = await verifyAuth(req);
      uid = decoded.uid;
    } catch (err) {
      const status = err instanceof AuthError ? 401 : 500;
      res.status(status).json({ error: (err as Error).message });
      return;
    }

    // 2. Enforce per-user concurrent stream cap (see limitation note above)
    const activeStreams = activeStreamsByUid.get(uid) ?? 0;
    if (activeStreams >= MAX_CONCURRENT_STREAMS_PER_USER) {
      res.status(429).json({
        error: 'Too many concurrent streams. Wait for an active response to finish.',
      });
      return;
    }
    activeStreamsByUid.set(uid, activeStreams + 1);
    try {
      await handleStreamRequest(req, res, uid);
    } finally {
      const count = activeStreamsByUid.get(uid) ?? 0;
      if (count <= 1) {
        activeStreamsByUid.delete(uid);
      } else {
        activeStreamsByUid.set(uid, count - 1);
      }
    }
  }
);

async function handleStreamRequest(
  req: Request,
  res: Response,
  uid: string
): Promise<void> {
  // 3. Parse and validate request
  const { model: modelId, messages: rawMessages, webSearch } = req.body ?? {};
  if (typeof modelId !== 'string' || modelId.length === 0) {
    res.status(400).json({ error: 'model must be a non-empty string' });
    return;
  }
  if (!Array.isArray(rawMessages) || rawMessages.length === 0) {
    res.status(400).json({ error: 'messages must be a non-empty array' });
    return;
  }
  if (rawMessages.length > MAX_MESSAGE_COUNT) {
    res.status(400).json({
      error: `Too many messages (max ${MAX_MESSAGE_COUNT})`,
    });
    return;
  }

  // Validate and sanitize each message to prevent token estimation bypass
  // and arbitrary field injection into OpenRouter
  const VALID_ROLES = ['system', 'user', 'assistant'] as const;
  type ValidRole = (typeof VALID_ROLES)[number];
  const validRoleSet = new Set<string>(VALID_ROLES);
  const messages: Array<{ role: ValidRole; content: string }> = [];
  let totalContentChars = 0;
  for (const msg of rawMessages) {
    if (!msg || typeof msg !== 'object') {
      res.status(400).json({ error: 'Each message must be an object' });
      return;
    }
    if (typeof msg.content !== 'string') {
      res.status(400).json({ error: 'Each message content must be a string' });
      return;
    }
    if (!validRoleSet.has(msg.role)) {
      res.status(400).json({ error: `Invalid message role: ${msg.role}` });
      return;
    }
    totalContentChars += msg.content.length;
    if (totalContentChars > MAX_TOTAL_CONTENT_CHARS) {
      res.status(400).json({
        error: `Total message content exceeds ${MAX_TOTAL_CONTENT_CHARS} characters`,
      });
      return;
    }
    messages.push({ role: msg.role as ValidRole, content: msg.content });
  }

  // 4. Validate model exists in the catalog
  const modelConfig = getModelConfig(modelId);
  if (!modelConfig) {
    res.status(400).json({ error: `Unknown model: ${modelId}` });
    return;
  }

  // 5. Check tier access
  let balance;
  try {
    balance = await getBalance(uid);
  } catch {
    res.status(500).json({ error: 'Failed to load user profile' });
    return;
  }

  if (!tierCanAccessCategory(balance.tier, modelConfig.category)) {
    const tierConfig = TIER_CONFIGS[balance.tier];
    res.status(403).json({
      error: `Your ${balance.tier} plan does not include ${modelConfig.category} models. Upgrade to access ${modelConfig.displayName}.`,
      requiredAccess: modelConfig.category,
      currentTier: balance.tier,
      allowedCategories: tierConfig.modelAccess,
    });
    return;
  }

  // 6. Check web search access
  if (webSearch && !TIER_CONFIGS[balance.tier].webSearchEnabled) {
    res.status(403).json({
      error: 'Web search is not available on your plan. Upgrade to Pro or Max.',
    });
    return;
  }

  // 7. Reserve credits atomically (prevents concurrent request abuse)
  const inputText = messages.map((m: { content: string }) => m.content).join(' ');
  const estimatedInputTokens = estimateTokenCount(inputText);
  const estimatedOutputTokens = 2000; // generous estimate to reduce under-reservation
  const { userCostCents: estimatedCost } = calculateCostCents(
    modelId,
    estimatedInputTokens,
    estimatedOutputTokens
  );

  let reservation: CreditReservation;
  try {
    reservation = await reserveCredits(uid, Math.max(estimatedCost, 1));
  } catch (err) {
    if (err instanceof InsufficientBalanceError) {
      res.status(402).json({
        error: 'Insufficient credits. Please top up or upgrade your plan.',
        balance: err.balance,
        estimatedCost,
      });
      return;
    }
    throw err;
  }

  // 8. Set SSE headers and begin streaming
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  let generationId: string | null = null;
  let completionContent = '';

  // Cancel the upstream OpenRouter stream when the client disconnects so we
  // stop paying for tokens nobody receives. Cancelling the reader resolves
  // the pending read, so the loop exits and credit reconciliation below
  // still runs with whatever usage was received up to that point.
  const upstreamAbort = new AbortController();
  let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  let clientDisconnected = false;
  res.on('close', () => {
    if (res.writableEnded) return; // normal completion
    clientDisconnected = true;
    upstreamAbort.abort();
    reader?.cancel().catch(() => {
      // Reader may already be closed — nothing to do.
    });
  });

  // Write to the client only if the socket is still open; a write on a
  // closed socket must never bypass the refund/reconcile paths below.
  const safeWrite = (data: string): void => {
    if (clientDisconnected || res.writableEnded) return;
    try {
      res.write(data);
    } catch (writeErr) {
      clientDisconnected = true;
      console.error('Failed to write to client:', writeErr);
    }
  };

  try {
    const openRouterResponse = await streamFromOpenRouter({
      model: modelId,
      messages,
      webSearch: !!webSearch,
      signal: upstreamAbort.signal,
    });

    reader = openRouterResponse.body?.getReader() ?? null;
    if (!reader) {
      await refundReservation(reservation).catch((refundErr) =>
        logCreditReconcileFailure(
          'refund',
          { uid, modelId, reservation, amountCents: null },
          refundErr
        )
      );
      safeWrite(`data: ${JSON.stringify({ error: 'No response body from OpenRouter' })}\n\n`);
      res.end();
      return;
    }

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      buffer += chunk;

      // Forward the raw chunk to the client
      safeWrite(chunk);

      // Parse for generation ID and content tracking
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ') && line.slice(6) !== '[DONE]') {
          try {
            const parsed = JSON.parse(line.slice(6));
            // Track generation ID
            if (parsed.id && !generationId) {
              generationId = parsed.id;
            }
            // Track completion content for token estimation fallback
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) {
              completionContent += delta;
            }
          } catch {
            // Ignore parse errors
          }
        }
      }
    }
  } catch (err) {
    if (completionContent.length > 0) {
      // Partial stream: charge for tokens already delivered to the client
      const partialPromptTokens = estimateTokenCount(inputText);
      const partialCompletionTokens = estimateTokenCount(completionContent);
      const { userCostCents: partialCost } = calculateCostCents(
        modelId,
        partialPromptTokens,
        partialCompletionTokens
      );
      await reconcileReservation(reservation, partialCost, {
        modelId,
        promptTokens: partialPromptTokens,
        completionTokens: partialCompletionTokens,
      }).catch((reconcileErr) =>
        logCreditReconcileFailure(
          'partial-reconcile',
          { uid, modelId, reservation, amountCents: partialCost },
          reconcileErr
        )
      );
    } else {
      // No tokens delivered: full refund is appropriate
      await refundReservation(reservation).catch((refundErr) =>
        logCreditReconcileFailure(
          'refund',
          { uid, modelId, reservation, amountCents: null },
          refundErr
        )
      );
    }
    console.error('Stream error:', err);
    safeWrite(
      `data: ${JSON.stringify({ error: 'An error occurred while processing your request.' })}\n\n`
    );
    if (!res.writableEnded) res.end();
    return;
  }

  // 9. Calculate actual cost
  let promptTokens: number;
  let completionTokens: number;

  if (generationId) {
    // Try to get exact token counts from OpenRouter
    const genInfo = await getGenerationInfo(generationId);
    if (genInfo) {
      promptTokens = genInfo.promptTokens;
      completionTokens = genInfo.completionTokens;
    } else {
      // Fallback to estimation
      promptTokens = estimateTokenCount(inputText);
      completionTokens = estimateTokenCount(completionContent);
    }
  } else {
    promptTokens = estimateTokenCount(inputText);
    completionTokens = estimateTokenCount(completionContent);
  }

  const { userCostCents } = calculateCostCents(
    modelId,
    promptTokens,
    completionTokens
  );

  // 10. Reconcile reservation with actual cost
  let deductionResult;
  try {
    deductionResult = await reconcileReservation(reservation, userCostCents, {
      modelId,
      promptTokens,
      completionTokens,
    });
  } catch (err) {
    logCreditReconcileFailure(
      'final-reconcile',
      { uid, modelId, reservation, amountCents: userCostCents },
      err
    );
    // Don't fail the response — the user already got their answer.
    // Log for manual reconciliation. Leave deductionResult undefined so
    // the client knows to refresh balance from the server.
    deductionResult = null;
  }

  // 11. Record usage
  try {
    await recordUsage(uid, modelId, promptTokens, completionTokens, userCostCents);
  } catch (err) {
    console.error(
      `Usage recording failed for uid=${uid} model=${modelId}:`,
      err
    );
  }

  // 12. Send final usage event (strip undefined fields before serializing)
  const usageEvent: UsageEvent = {
    type: 'usage',
    cost: userCostCents,
    promptTokens,
    completionTokens,
    ...(deductionResult ? { balanceAfter: deductionResult } : {}),
  };
  safeWrite(`data: ${JSON.stringify(usageEvent)}\n\n`);

  if (!res.writableEnded) res.end();
}
