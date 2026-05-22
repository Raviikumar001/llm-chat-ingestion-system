import { LlmProvider, ProviderGenerateRequest, ProviderGenerateResult, ProviderStreamChunk, IngestionPayload } from '../types';
import { startTimer, getTimestamp } from '../instrumentation/timing';
import { buildRequestPreview, buildResponsePreview } from '../instrumentation/preview';
import { normalizeError } from '../instrumentation/errors';
import { ingestionClient } from '../instrumentation/ingestion-client';
import { v4 as uuidv4 } from 'uuid';

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';

function mapMessagesToGemini(messages: Array<{ role: string; content: string }>) {
  const systemMessage = messages.find(m => m.role === 'system');
  const otherMessages = messages.filter(m => m.role !== 'system');

  const contents = otherMessages.map(msg => ({
    role: msg.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: msg.content }],
  }));

  return {
    systemInstruction: systemMessage ? { parts: [{ text: systemMessage.content }] } : undefined,
    contents,
  };
}

export class GeminiProvider implements LlmProvider {
  name = 'gemini' as const;
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async generate(request: ProviderGenerateRequest): Promise<ProviderGenerateResult> {
    const requestId = uuidv4();
    const stopTimer = startTimer();
    const requestPreview = buildRequestPreview(request.messages);

    // Emit started event
    const startedAt = getTimestamp();
    const startedPayload: IngestionPayload = {
      eventId: uuidv4(),
      requestId,
      conversationId: request.conversationId,
      userMessageId: request.userMessageId,
      provider: 'gemini',
      model: request.model,
      status: 'started',
      startedAt,
      requestPreview,
    };

    await ingestionClient.emit(startedPayload);

    try {
      const { systemInstruction, contents } = mapMessagesToGemini(request.messages);

      const body: any = { contents };
      if (systemInstruction) {
        body.systemInstruction = systemInstruction;
      }

      const response = await fetch(
        `${GEMINI_API_BASE}/models/${request.model}:generateContent?key=${this.apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }
      );

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
          provider: 'gemini',
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
        throw new Error(`Gemini API error: ${normalizedError.message} (status: ${response.status})`);
      }

      const data = await response.json() as {
        candidates: Array<{
          content: {
            parts: Array<{ text: string }>;
          };
          finishReason: string;
        }>;
        usageMetadata?: {
          promptTokenCount: number;
          candidatesTokenCount: number;
          totalTokenCount: number;
        };
      };

      const candidate = data.candidates?.[0];
      const text = candidate?.content?.parts?.map(p => p.text).join('') || '';
      const finishReason = candidate?.finishReason;

      const timing = stopTimer();
      const completedPayload: IngestionPayload = {
        eventId: uuidv4(),
        requestId,
        conversationId: request.conversationId,
        userMessageId: request.userMessageId,
        provider: 'gemini',
        model: request.model,
        status: 'completed',
        startedAt,
        completedAt: timing.completedAt.toISOString(),
        latencyMs: timing.latencyMs,
        requestPreview,
        responsePreview: buildResponsePreview(text),
        usage: data.usageMetadata
          ? {
              inputTokens: data.usageMetadata.promptTokenCount,
              outputTokens: data.usageMetadata.candidatesTokenCount,
              totalTokens: data.usageMetadata.totalTokenCount,
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
        usage: data.usageMetadata
          ? {
              inputTokens: data.usageMetadata.promptTokenCount,
              outputTokens: data.usageMetadata.candidatesTokenCount,
              totalTokens: data.usageMetadata.totalTokenCount,
            }
          : undefined,
      };
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('Gemini API error')) {
        throw error;
      }

      const normalizedError = normalizeError(error);
      const timing = stopTimer();

      const failedPayload: IngestionPayload = {
        eventId: uuidv4(),
        requestId,
        conversationId: request.conversationId,
        userMessageId: request.userMessageId,
        provider: 'gemini',
        model: request.model,
        status: normalizedError.code === 'timeout' ? 'timed_out' : 'failed',
        startedAt,
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
      throw new Error(`Gemini request failed: ${normalizedError.message}`);
    }
  }

  async* stream(request: ProviderGenerateRequest): AsyncIterable<ProviderStreamChunk> {
    const requestId = uuidv4();
    const stopTimer = startTimer();
    const requestPreview = buildRequestPreview(request.messages);
    let firstTokenTime: number | null = null;
    let fullText = '';
    let finishReason: string | undefined;

    const startedAt = getTimestamp();
    const startedPayload: IngestionPayload = {
      eventId: uuidv4(),
      requestId,
      conversationId: request.conversationId,
      userMessageId: request.userMessageId,
      provider: 'gemini',
      model: request.model,
      status: 'started',
      startedAt,
      requestPreview,
    };

    await ingestionClient.emit(startedPayload);

    try {
      const { systemInstruction, contents } = mapMessagesToGemini(request.messages);

      const body: any = { contents };
      if (systemInstruction) {
        body.systemInstruction = systemInstruction;
      }

      const response = await fetch(
        `${GEMINI_API_BASE}/models/${request.model}:streamGenerateContent?key=${this.apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }
      );

      if (!response.ok) {
        const errorBody = await response.text();
        const normalizedError = normalizeError(new Error(`HTTP ${response.status}: ${errorBody}`));
        const timing = stopTimer();

        const failedPayload: IngestionPayload = {
          eventId: uuidv4(),
          requestId,
          conversationId: request.conversationId,
          userMessageId: request.userMessageId,
          provider: 'gemini',
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
        throw new Error(`Gemini API error: ${normalizedError.message} (status: ${response.status})`);
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
          if (!trimmed) continue;

          try {
            const parsed = JSON.parse(trimmed) as {
              candidates: Array<{
                content: {
                  parts: Array<{ text: string }>;
                };
                finishReason: string;
              }>;
            };

            const candidate = parsed.candidates?.[0];
            const parts = candidate?.content?.parts || [];
            const chunkText = parts.map(p => p.text).join('');
            const chunkFinishReason = candidate?.finishReason;

            if (chunkText) {
              if (firstTokenTime === null) {
                firstTokenTime = Date.now() - new Date(startedAt).getTime();
              }
              fullText += chunkText;
              yield { text: chunkText, finishReason: chunkFinishReason || undefined };
            }

            if (chunkFinishReason) {
              finishReason = chunkFinishReason;
            }
          } catch {
            // Skip malformed JSON
          }
        }
      }

      const timing = stopTimer();
      const completedPayload: IngestionPayload = {
        eventId: uuidv4(),
        requestId,
        conversationId: request.conversationId,
        userMessageId: request.userMessageId,
        provider: 'gemini',
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
      if (error instanceof Error && error.message.startsWith('Gemini API error')) {
        throw error;
      }

      const normalizedError = normalizeError(error);
      const timing = stopTimer();

      const failedPayload: IngestionPayload = {
        eventId: uuidv4(),
        requestId,
        conversationId: request.conversationId,
        userMessageId: request.userMessageId,
        provider: 'gemini',
        model: request.model,
        status: normalizedError.code === 'timeout' ? 'timed_out' : 'failed',
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
      throw new Error(`Gemini stream failed: ${normalizedError.message}`);
    }
  }
}
