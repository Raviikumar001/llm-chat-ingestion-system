import { LlmProvider, ProviderGenerateRequest, ProviderGenerateResult, IngestionPayload } from '../types';
import { startTimer, getTimestamp } from '../instrumentation/timing';
import { buildRequestPreview, buildResponsePreview } from '../instrumentation/preview';
import { normalizeError } from '../instrumentation/errors';
import { ingestionClient } from '../instrumentation/ingestion-client';
import { v4 as uuidv4 } from 'uuid';

const CEREBRAS_API_BASE = 'https://api.cerebras.ai/v1';

export class CerebrasProvider implements LlmProvider {
  name = 'cerebras' as const;
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async generate(request: ProviderGenerateRequest): Promise<ProviderGenerateResult> {
    const eventId = uuidv4();
    const requestId = uuidv4();
    const stopTimer = startTimer();

    const requestPreview = buildRequestPreview(request.messages);

    // Emit started event
    const startedPayload: IngestionPayload = {
      eventId: uuidv4(),
      requestId,
      conversationId: request.conversationId,
      userMessageId: request.userMessageId,
      provider: 'cerebras',
      model: request.model,
      status: 'started',
      startedAt: getTimestamp(),
      requestPreview,
    };

    await ingestionClient.emit(startedPayload);

    try {
      const response = await fetch(`${CEREBRAS_API_BASE}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: request.model,
          messages: request.messages,
          stream: false,
        }),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        const normalizedError = normalizeError(new Error(`HTTP ${response.status}: ${errorBody}`));
        normalizedError.httpStatus = response.status;

        const timing = stopTimer();
        const failedPayload: IngestionPayload = {
          eventId: uuidv4(),
          requestId,
          conversationId: request.conversationId,
          userMessageId: request.userMessageId,
          provider: 'cerebras',
          model: request.model,
          status: 'failed',
          startedAt: startedPayload.startedAt,
          completedAt: timing.completedAt.toISOString(),
          latencyMs: timing.latencyMs,
          requestPreview,
          error: {
            code: normalizedError.code,
            message: normalizedError.message,
          },
          httpStatus: response.status,
        };

        await ingestionClient.emit(failedPayload);

        throw new Error(`Cerebras API error: ${normalizedError.message} (status: ${response.status})`);
      }

      const data = await response.json() as {
        choices: Array<{
          message: { content: string };
          finish_reason: string;
        }>;
        usage?: {
          prompt_tokens: number;
          completion_tokens: number;
          total_tokens: number;
        };
        id: string;
      };

      const choice = data.choices?.[0];
      const text = choice?.message?.content || '';
      const finishReason = choice?.finish_reason;
      const providerMessageId = data.id;

      const timing = stopTimer();
      const responsePreview = buildResponsePreview(text);

      const completedPayload: IngestionPayload = {
        eventId: uuidv4(),
        requestId,
        conversationId: request.conversationId,
        userMessageId: request.userMessageId,
        provider: 'cerebras',
        model: request.model,
        status: 'completed',
        startedAt: startedPayload.startedAt,
        completedAt: timing.completedAt.toISOString(),
        latencyMs: timing.latencyMs,
        requestPreview,
        responsePreview,
        usage: data.usage
          ? {
              inputTokens: data.usage.prompt_tokens,
              outputTokens: data.usage.completion_tokens,
              totalTokens: data.usage.total_tokens,
            }
          : null,
        metadata: {
          finishReason,
        },
      };

      await ingestionClient.emit(completedPayload);

      return {
        text,
        finishReason,
        usage: data.usage
          ? {
              inputTokens: data.usage.prompt_tokens,
              outputTokens: data.usage.completion_tokens,
              totalTokens: data.usage.total_tokens,
            }
          : undefined,
        providerMessageId,
      };
    } catch (error) {
      // If it's already a thrown error from the fetch block, re-throw it
      if (error instanceof Error && error.message.startsWith('Cerebras API error')) {
        throw error;
      }

      // Otherwise normalize and emit failure
      const normalizedError = normalizeError(error);
      const timing = stopTimer();

      const failedPayload: IngestionPayload = {
        eventId: uuidv4(),
        requestId,
        conversationId: request.conversationId,
        userMessageId: request.userMessageId,
        provider: 'cerebras',
        model: request.model,
        status: normalizedError.code === 'timeout' ? 'timed_out' : 'failed',
        startedAt: startedPayload.startedAt,
        completedAt: timing.completedAt.toISOString(),
        latencyMs: timing.latencyMs,
        requestPreview,
        error: {
          code: normalizedError.code,
          message: normalizedError.message,
        },
        httpStatus: normalizedError.httpStatus,
      };

      await ingestionClient.emit(failedPayload);

      throw new Error(`Cerebras request failed: ${normalizedError.message}`);
    }
  }
}
