const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const OPENROUTER_GENERATION_URL = 'https://openrouter.ai/api/v1/generation';

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
    throw new Error(
      `OpenRouter API error ${response.status}: ${errorBody}`
    );
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
