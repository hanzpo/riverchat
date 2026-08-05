const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const OPENROUTER_GENERATION_URL = 'https://openrouter.ai/api/v1/generation';

const MAX_ERROR_DETAIL_CHARS = 300;

/**
 * Error from the OpenRouter API carrying the HTTP status and the most
 * specific human-readable detail available (provider error text when present,
 * OpenRouter's own message otherwise). `providerMessage` is safe to show to
 * end users — it never contains the raw response body of non-JSON errors.
 */
export class OpenRouterError extends Error {
  readonly status: number;
  readonly providerMessage: string;

  constructor(status: number, providerMessage: string) {
    super(`OpenRouter API error ${status}: ${providerMessage}`);
    this.name = 'OpenRouterError';
    this.status = status;
    this.providerMessage = providerMessage;
  }
}

/**
 * Pull the most specific message out of an OpenRouter error body.
 * Shape: { error: { message, code, metadata?: { raw?, provider_name? } } }
 * where metadata.raw is the upstream provider's own error text (e.g.
 * "This model is only available in the United States.").
 */
function extractErrorDetail(body: string): string {
  try {
    const parsed = JSON.parse(body) as {
      error?: { message?: unknown; metadata?: { raw?: unknown } };
    };
    const raw = parsed.error?.metadata?.raw;
    if (typeof raw === 'string' && raw.trim().length > 0) {
      return raw.trim().slice(0, MAX_ERROR_DETAIL_CHARS);
    }
    const message = parsed.error?.message;
    if (typeof message === 'string' && message.trim().length > 0) {
      return message.trim().slice(0, MAX_ERROR_DETAIL_CHARS);
    }
  } catch {
    // Non-JSON body (e.g. an HTML error page) — don't surface it to users.
  }
  return 'The provider did not return details.';
}

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface StreamOptions {
  model: string;
  messages: ChatMessage[];
  webSearch: boolean;
  /** Optional abort signal to cancel the upstream request (e.g. client disconnect) */
  signal?: AbortSignal;
}

interface GenerationInfo {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

/**
 * Stream a chat completion from OpenRouter.
 * Returns a ReadableStream of the raw SSE response.
 */
export async function streamFromOpenRouter(
  options: StreamOptions
): Promise<Response> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY not configured');
  }

  const requestBody: Record<string, unknown> = {
    model: options.model,
    messages: options.messages,
    stream: true,
  };

  if (options.webSearch) {
    requestBody.plugins = [{ id: 'web' }];
  }

  const response = await fetch(OPENROUTER_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      'HTTP-Referer': 'https://riverchat.app',
      'X-Title': 'RiverChat',
    },
    body: JSON.stringify(requestBody),
    signal: options.signal,
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new OpenRouterError(response.status, extractErrorDetail(errorBody));
  }

  return response;
}

/**
 * Get generation info (token counts) from OpenRouter after a stream completes.
 * Retries with a delay since OpenRouter's generation endpoint may not have
 * data ready immediately after the stream finishes.
 */
export async function getGenerationInfo(
  generationId: string,
  maxRetries = 3,
  delayMs = 1000
): Promise<GenerationInfo | null> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, delayMs));

    try {
      const response = await fetch(
        `${OPENROUTER_GENERATION_URL}?id=${generationId}`,
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
          },
        }
      );

      if (!response.ok) continue;

      const data = (await response.json()) as {
        data?: {
          tokens_prompt?: number;
          tokens_completion?: number;
        };
      };

      const promptTokens = data.data?.tokens_prompt ?? 0;
      const completionTokens = data.data?.tokens_completion ?? 0;

      // If both are 0, data may not be ready yet — retry
      if (promptTokens === 0 && completionTokens === 0) continue;

      return {
        promptTokens,
        completionTokens,
        totalTokens: promptTokens + completionTokens,
      };
    } catch {
      continue;
    }
  }

  return null;
}

/**
 * Rough token count estimation from text (fallback when generation API unavailable).
 * Approximately 1 token per 4 characters for English text.
 */
export function estimateTokenCount(text: string): number {
  return Math.ceil(text.length / 4);
}
