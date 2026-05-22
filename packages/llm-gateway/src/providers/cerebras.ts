import { LlmProvider, ProviderGenerateRequest, ProviderGenerateResult, ProviderStreamChunk, IngestionPayload } from '../types';
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
    const requestId = request.requestId ?? uuidv4();
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
        signal: request.signal,
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
      const status =
        normalizedError.code === 'cancelled'
          ? 'cancelled'
          : normalizedError.code === 'timeout'
            ? 'timed_out'
            : 'failed';

      const failedPayload: IngestionPayload = {
        eventId: uuidv4(),
        requestId,
        conversationId: request.conversationId,
        userMessageId: request.userMessageId,
        provider: 'cerebras',
        model: request.model,
        status,
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

      throw new Error(
        normalizedError.code === 'cancelled'
          ? 'Cerebras request cancelled'
          : `Cerebras request failed: ${normalizedError.message}`
      );
    }
  }

  async* stream(request: ProviderGenerateRequest): AsyncIterable<ProviderStreamChunk> {
    const requestId = request.requestId ?? uuidv4();
    const stopTimer = startTimer();
    const requestPreview = buildRequestPreview(request.messages);
    let firstTokenTime: number | null = null;
    let fullText = '';
    let finishReason: string | undefined;

    // Emit started event
    const startedAt = getTimestamp();
    const startedPayload: IngestionPayload = {
      eventId: uuidv4(),
      requestId,
      conversationId: request.conversationId,
      userMessageId: request.userMessageId,
      provider: 'cerebras',
      model: request.model,
      status: 'started',
      startedAt,
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
        signal: request.signal,
        body: JSON.stringify({
          model: request.model,
          messages: request.messages,
          stream: true,
        }),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        const normalizedError = normalizeError(new Error(`HTTP ${response.status}: ${errorBody}`));
        const timing = stopTimer();

        const failedPayload: IngestionPayload = {
          eventId: uuidv4(),
          requestId,
          conversationId: request.conversationId,
          userMessageId: request.userMessageId,
          provider: 'cerebras',
          model: request.model,
          status: 'failed',
          startedAt,
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

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body available for streaming');
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data: ')) continue;

          const data = trimmed.slice(6);
          if (data === '[DONE]') continue;

          try {
            const parsed = JSON.parse(data) as {
              choices: Array<{
                delta: { content?: string };
                finish_reason: string | null;
              }>;
            };

            const choice = parsed.choices?.[0];
            const delta = choice?.delta?.content || '';
            const chunkFinishReason = choice?.finish_reason;

            if (delta) {
              if (firstTokenTime === null) {
                firstTokenTime = Date.now() - new Date(startedAt).getTime();
              }
              fullText += delta;
              yield { text: delta, finishReason: chunkFinishReason || undefined };
            }

            if (chunkFinishReason) {
              finishReason = chunkFinishReason;
            }
          } catch {
            // Skip malformed JSON in stream
          }
        }
      }

      // Emit completed event
      const timing = stopTimer();
      const completedPayload: IngestionPayload = {
        eventId: uuidv4(),
        requestId,
        conversationId: request.conversationId,
        userMessageId: request.userMessageId,
        provider: 'cerebras',
        model: request.model,
        status: 'completed',
        startedAt,
        completedAt: timing.completedAt.toISOString(),
        latencyMs: timing.latencyMs,
        timeToFirstTokenMs: firstTokenTime,
        requestPreview,
        responsePreview: buildResponsePreview(fullText),
        metadata: {
          finishReason,
        },
      };

      await ingestionClient.emit(completedPayload);
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('Cerebras API error')) {
        throw error;
      }

      const normalizedError = normalizeError(error);
      const timing = stopTimer();
      const status =
        normalizedError.code === 'cancelled'
          ? 'cancelled'
          : normalizedError.code === 'timeout'
            ? 'timed_out'
            : 'failed';

      const failedPayload: IngestionPayload = {
        eventId: uuidv4(),
        requestId,
        conversationId: request.conversationId,
        userMessageId: request.userMessageId,
        provider: 'cerebras',
        model: request.model,
        status,
        startedAt,
        completedAt: timing.completedAt.toISOString(),
        latencyMs: timing.latencyMs,
        timeToFirstTokenMs: firstTokenTime,
        requestPreview,
        error: {
          code: normalizedError.code,
          message: normalizedError.message,
        },
      };

      await ingestionClient.emit(failedPayload);
      throw new Error(
        normalizedError.code === 'cancelled'
          ? 'Cerebras stream cancelled'
          : `Cerebras stream failed: ${normalizedError.message}`
      );
    }
  }
}
