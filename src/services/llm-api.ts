import type { LLMModel, MessageNode, UsageMetadata } from '../types';
import { auth } from '../config/firebase';
import { captureException } from '../composables/usePostHog';

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

const STREAM_CHAT_URL = import.meta.env.VITE_STREAM_CHAT_URL || '';

// Resilience settings for the streaming request
const MAX_FETCH_ATTEMPTS = 3; // initial attempt + up to 2 retries
const RETRY_BASE_DELAY_MS = 500; // exponential backoff: 500ms, 1000ms
const REQUEST_TIMEOUT_MS = 120_000; // overall deadline for the full streamed response

export class LLMAPIService {
  private static buildContext(
    targetNode: MessageNode,
    allNodes: Record<string, MessageNode>
  ): ChatMessage[] {
    const messages: ChatMessage[] = [];
    const path: MessageNode[] = [];

    // Traverse upwards from target to root
    let currentNode: MessageNode | null | undefined = targetNode;
    while (currentNode) {
      path.unshift(currentNode);
      currentNode = currentNode.parentId ? allNodes[currentNode.parentId] : null;
    }

    // Convert to ChatMessage format
    for (const node of path) {
      let content = node.content;

      // If this node has branch metadata, add the highlighted text as context
      if (node.branchMetadata) {
        content = `[Selected text from previous message]\n"${node.branchMetadata.highlightedText}"\n\n${node.content}`;
      }

      messages.push({
        role: node.type === 'user' ? 'user' : 'assistant',
        content: content,
      });
    }

    return messages;
  }

  static async streamResponse(
    model: LLMModel,
    parentNode: MessageNode,
    allNodes: Record<string, MessageNode>,
    webSearchEnabled: boolean,
    onToken: (token: string) => void,
    onComplete: (usage?: UsageMetadata) => void,
    onError: (error: string) => void,
    signal?: AbortSignal
  ): Promise<void> {
    const context = this.buildContext(parentNode, allNodes);

    try {
      await this.streamViaProxy(
        model,
        context,
        webSearchEnabled,
        onToken,
        onComplete,
        onError,
        signal
      );
    } catch (error) {
      // Silently ignore aborted requests — the caller cancelled intentionally
      if (error instanceof DOMException && error.name === 'AbortError') return;
      onError(error instanceof Error ? error.message : 'Unknown error');
    }
  }

  private static delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Fetch with retry + exponential backoff for transient failures (network
   * errors and 5xx responses). This only covers the initial request — once
   * streaming has begun there are no retries. Aborts are never retried.
   */
  private static async fetchWithRetry(
    url: string,
    init: RequestInit,
    signal: AbortSignal
  ): Promise<Response> {
    let lastError: unknown;

    for (let attempt = 1; attempt <= MAX_FETCH_ATTEMPTS; attempt++) {
      try {
        const response = await fetch(url, { ...init, signal });
        if (response.status >= 500 && attempt < MAX_FETCH_ATTEMPTS) {
          console.warn(
            `[LLM] Got ${response.status}, retrying (attempt ${attempt}/${MAX_FETCH_ATTEMPTS})`
          );
          await this.delay(RETRY_BASE_DELAY_MS * 2 ** (attempt - 1));
          continue;
        }
        return response;
      } catch (error) {
        // Never retry aborts (user cancel or timeout)
        if (error instanceof DOMException && error.name === 'AbortError') throw error;
        lastError = error;
        if (attempt < MAX_FETCH_ATTEMPTS) {
          console.warn(
            `[LLM] Network error, retrying (attempt ${attempt}/${MAX_FETCH_ATTEMPTS}):`,
            error
          );
          await this.delay(RETRY_BASE_DELAY_MS * 2 ** (attempt - 1));
        }
      }
    }

    throw lastError;
  }

  /** Validate the proxy's usage payload and return a well-typed object (or undefined). */
  private static parseUsagePayload(parsed: any): UsageMetadata | undefined {
    if (
      typeof parsed.cost !== 'number' ||
      !Number.isFinite(parsed.cost) ||
      typeof parsed.promptTokens !== 'number' ||
      !Number.isFinite(parsed.promptTokens) ||
      typeof parsed.completionTokens !== 'number' ||
      !Number.isFinite(parsed.completionTokens)
    ) {
      console.warn('[LLM] Ignoring malformed usage payload:', parsed);
      return undefined;
    }

    const b = parsed.balanceAfter;
    const balanceAfter =
      b &&
      typeof b.subscriptionCredits === 'number' &&
      typeof b.prepaidCredits === 'number' &&
      typeof b.total === 'number'
        ? {
            subscriptionCredits: b.subscriptionCredits,
            prepaidCredits: b.prepaidCredits,
            total: b.total,
          }
        : undefined;

    return {
      cost: parsed.cost,
      promptTokens: parsed.promptTokens,
      completionTokens: parsed.completionTokens,
      balanceAfter,
    };
  }

  private static async streamViaProxy(
    model: LLMModel,
    messages: ChatMessage[],
    webSearchEnabled: boolean,
    onToken: (token: string) => void,
    onComplete: (usage?: UsageMetadata) => void,
    onError: (error: string) => void,
    signal?: AbortSignal
  ): Promise<void> {
    // Combine the caller's abort signal with an overall request timeout
    const controller = new AbortController();
    const abortUpstream = () => controller.abort();
    if (signal) {
      if (signal.aborted) controller.abort();
      else signal.addEventListener('abort', abortUpstream, { once: true });
    }
    let timedOut = false;
    const timeoutId = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, REQUEST_TIMEOUT_MS);

    try {
      // Get Firebase Auth ID token
      const user = auth.currentUser;
      if (!user) {
        onError('Not authenticated. Please sign in.');
        return;
      }
      const idToken = await user.getIdToken();

      if (!STREAM_CHAT_URL) {
        onError('Chat service URL not configured');
        return;
      }

      console.log(
        `[LLM] Streaming via proxy: ${model.id}${webSearchEnabled ? ' with web search' : ''}`
      );

      const response = await this.fetchWithRetry(
        STREAM_CHAT_URL,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify({
            model: model.id,
            messages,
            webSearch: webSearchEnabled,
          }),
        },
        controller.signal
      );

      if (!response.ok) {
        let errorMessage = `API error: ${response.status}`;
        try {
          const text = await response.text();
          try {
            const error = JSON.parse(text);
            errorMessage = error.error || errorMessage;
          } catch {
            // Response body is not JSON (e.g. HTML error page)
            if (text && text.length < 200) {
              errorMessage = text;
            }
          }
        } catch {
          // Ignore - use default error message
        }

        if (response.status === 429) {
          errorMessage = 'Too many requests right now. Please wait a moment and try again.';
        }

        captureException(new Error(errorMessage), {
          context: 'proxy_api',
          model: model.id,
          status: response.status,
          web_search_enabled: webSearchEnabled,
        });

        onError(errorMessage);
        return;
      }

      const reader = response.body?.getReader();
      if (!reader) {
        onError('No response body');
        return;
      }

      const decoder = new TextDecoder();
      let buffer = '';
      let usageData: UsageMetadata | undefined;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') {
              continue;
            }

            try {
              const parsed = JSON.parse(data);

              // Check for usage metadata (sent by our proxy after stream)
              if (parsed.type === 'usage') {
                usageData = this.parseUsagePayload(parsed);
                continue;
              }

              // Check for error
              if (parsed.error) {
                onError(parsed.error);
                return;
              }

              // Standard OpenRouter SSE token
              const token = parsed.choices?.[0]?.delta?.content;
              if (token) {
                onToken(token);
              }
            } catch {
              // Ignore parse errors for partial JSON
            }
          }
        }
      }

      onComplete(usageData);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        // Distinguish our timeout from an intentional caller cancellation
        if (timedOut) {
          captureException(new Error('Request timed out'), {
            context: 'proxy_streaming',
            model: model.id,
            timeout_ms: REQUEST_TIMEOUT_MS,
            web_search_enabled: webSearchEnabled,
          });
          onError('The request timed out. Please try again.');
        }
        // Silently ignore aborted requests — the caller cancelled intentionally
        return;
      }

      const errorMessage = error instanceof Error ? error.message : 'Streaming error';

      captureException(error instanceof Error ? error : new Error(errorMessage), {
        context: 'proxy_streaming',
        model: model.id,
        web_search_enabled: webSearchEnabled,
      });

      onError(errorMessage);
    } finally {
      clearTimeout(timeoutId);
      signal?.removeEventListener('abort', abortUpstream);
    }
  }
}
