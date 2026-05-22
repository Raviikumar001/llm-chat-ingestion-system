import { eq } from 'drizzle-orm';
import { db } from '../db';
import { inferenceLogs } from '../db/schema';
import { IngestionPayload, IngestionResponse } from '@ollive/shared';

export async function processIngestionPayload(payload: IngestionPayload): Promise<IngestionResponse> {
  try {
    // Check for duplicate event_id
    const existing = await db
      .select({ id: inferenceLogs.id })
      .from(inferenceLogs)
      .where(eq(inferenceLogs.eventId, payload.eventId))
      .limit(1);

    if (existing.length > 0) {
      return { accepted: true, eventId: payload.eventId };
    }

    // Map payload to database row
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
      requestPreview: payload.requestPreview,
      responsePreview: payload.responsePreview || null,
      errorCode: payload.error?.code || null,
      errorMessage: payload.error?.message || null,
      httpStatus: payload.httpStatus ?? null,
      rawMetadata: payload.metadata || {},
    };

    await db.insert(inferenceLogs).values(row);

    return { accepted: true, eventId: payload.eventId };
  } catch (err) {
    console.error('Ingestion processing error:', err);
    throw err;
  }
}
