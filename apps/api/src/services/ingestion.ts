import { eq } from 'drizzle-orm';
import { db } from '../db';
import { inferenceLogs } from '../db/schema';
import { IngestionPayload, IngestionResponse } from '@ollive/shared';

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
      // Update existing row - preserve earliest started_at, update completion status
      const existing = existingRequest[0];
      await db
        .update(inferenceLogs)
        .set({
          ...row,
          eventId: payload.eventId, // new event id for this update
          startedAt: existing.startedAt, // preserve earliest started_at
          createdAt: existing.createdAt, // preserve original creation time
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
