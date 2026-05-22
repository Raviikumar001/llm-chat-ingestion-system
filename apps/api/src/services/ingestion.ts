import { eq } from 'drizzle-orm';
import { db } from '../db';
import { inferenceLogs } from '../db/schema';
import { IngestionPayload, IngestionResponse, type InferenceStatus } from '@ollive/shared';

const TERMINAL_STATUSES = new Set<InferenceStatus>(['completed', 'failed', 'cancelled', 'timed_out']);

function isTerminalStatus(status: InferenceStatus): boolean {
  return TERMINAL_STATUSES.has(status);
}

function coalesceValue<T>(incoming: T | null | undefined, existing: T | null | undefined): T | null | undefined {
  return (incoming ?? existing) as T;
}

export async function processIngestionPayload(payload: IngestionPayload): Promise<IngestionResponse> {
  try {
    // Check for duplicate event_id first
    const existingEvent = await db
      .select({ id: inferenceLogs.id })
      .from(inferenceLogs)
      .where(eq(inferenceLogs.eventId, payload.eventId))
      .limit(1);

    if (existingEvent.length > 0) {
      return { accepted: true, eventId: payload.eventId };
    }

    // Check if there's an existing log for this request_id (lifecycle update)
    const existingRequest = await db
      .select()
      .from(inferenceLogs)
      .where(eq(inferenceLogs.requestId, payload.requestId))
      .limit(1);

    const row = {
      eventId: payload.eventId,
      requestId: payload.requestId,
      conversationId: payload.conversationId,
      userMessageId: payload.userMessageId,
      assistantMessageId: payload.assistantMessageId || null,
      provider: payload.provider,
      model: payload.model,
      status: payload.status,
      startedAt: new Date(payload.startedAt),
      completedAt: payload.completedAt ? new Date(payload.completedAt) : null,
      latencyMs: payload.latencyMs ?? null,
      timeToFirstTokenMs: payload.timeToFirstTokenMs ?? null,
      inputTokens: payload.usage?.inputTokens ?? null,
      outputTokens: payload.usage?.outputTokens ?? null,
      totalTokens: payload.usage?.totalTokens ?? null,
      finishReason: (payload.metadata?.finishReason as string) || null,
      requestPreview: payload.requestPreview.slice(0, 1000),
      responsePreview: payload.responsePreview ? payload.responsePreview.slice(0, 1000) : null,
      errorCode: payload.error?.code || null,
      errorMessage: payload.error?.message || null,
      httpStatus: payload.httpStatus ?? null,
      rawMetadata: payload.metadata || {},
    };

    if (existingRequest.length > 0) {
      // Preserve the original lifecycle start row and merge in richer terminal metadata over time.
      const existing = existingRequest[0];
      const incomingStatus = payload.status;
      const existingStatus = existing.status as InferenceStatus;
      const shouldIgnoreLifecycleRegression =
        isTerminalStatus(existingStatus) && !isTerminalStatus(incomingStatus);

      if (shouldIgnoreLifecycleRegression) {
        return { accepted: true, eventId: payload.eventId };
      }

      await db
        .update(inferenceLogs)
        .set({
          eventId: existing.eventId,
          requestId: existing.requestId,
          conversationId: existing.conversationId,
          userMessageId: existing.userMessageId,
          assistantMessageId: coalesceValue(row.assistantMessageId, existing.assistantMessageId),
          provider: existing.provider,
          model: existing.model,
          status: isTerminalStatus(existingStatus) ? existingStatus : incomingStatus,
          startedAt: existing.startedAt,
          completedAt: coalesceValue(row.completedAt, existing.completedAt),
          latencyMs: coalesceValue(row.latencyMs, existing.latencyMs),
          timeToFirstTokenMs: coalesceValue(row.timeToFirstTokenMs, existing.timeToFirstTokenMs),
          inputTokens: coalesceValue(row.inputTokens, existing.inputTokens),
          outputTokens: coalesceValue(row.outputTokens, existing.outputTokens),
          totalTokens: coalesceValue(row.totalTokens, existing.totalTokens),
          finishReason: coalesceValue(row.finishReason, existing.finishReason),
          requestPreview: existing.requestPreview,
          responsePreview: coalesceValue(row.responsePreview, existing.responsePreview),
          errorCode: coalesceValue(row.errorCode, existing.errorCode),
          errorMessage: coalesceValue(row.errorMessage, existing.errorMessage),
          httpStatus: coalesceValue(row.httpStatus, existing.httpStatus),
          rawMetadata: {
            ...(existing.rawMetadata as Record<string, unknown>),
            ...(row.rawMetadata as Record<string, unknown>),
          },
          createdAt: existing.createdAt,
          updatedAt: new Date(),
        })
        .where(eq(inferenceLogs.requestId, payload.requestId));
    } else {
      // Insert new row
      await db.insert(inferenceLogs).values(row);
    }

    return { accepted: true, eventId: payload.eventId };
  } catch (err) {
    console.error('Ingestion processing error:', err);
    throw err;
  }
}

export async function linkAssistantMessageToInferenceLog(requestId: string, assistantMessageId: string) {
  await db
    .update(inferenceLogs)
    .set({
      assistantMessageId,
      updatedAt: new Date(),
    })
    .where(eq(inferenceLogs.requestId, requestId));
}
