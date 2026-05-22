import { eq, and, desc } from 'drizzle-orm';
import { db } from '../db';
import { messages } from '../db/schema';

export async function createMessage(
  conversationId: string,
  role: string,
  content: string,
  sequenceNumber: number,
  status: string = 'completed',
  providerMessageId?: string | null
) {
  const contentPreview = content.length > 200 ? content.slice(0, 200) + '...' : content;

  const result = await db.insert(messages).values({
    conversationId,
    role,
    content,
    contentPreview,
    sequenceNumber,
    status,
    providerMessageId: providerMessageId || null,
  }).returning();

  return result[0];
}

export async function getMessagesByConversationId(conversationId: string, limit = 100) {
  return db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(messages.sequenceNumber)
    .limit(limit);
}

export async function getRecentMessagesByConversationId(conversationId: string, limit = 8) {
  // Get the most recent messages in reverse order, then reverse them back
  const result = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(desc(messages.sequenceNumber))
    .limit(limit);

  // Reverse to get chronological order
  return result.reverse();
}

export async function getNextSequenceNumber(conversationId: string): Promise<number> {
  const result = await db
    .select({ maxSeq: messages.sequenceNumber })
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(desc(messages.sequenceNumber))
    .limit(1);

  return (result[0]?.maxSeq || 0) + 1;
}

export async function updateMessageStatus(messageId: string, status: string) {
  await db
    .update(messages)
    .set({ status })
    .where(eq(messages.id, messageId));
}

export async function updateMessageContent(messageId: string, content: string) {
  const contentPreview = content.length > 200 ? content.slice(0, 200) + '...' : content;

  await db
    .update(messages)
    .set({ content, contentPreview })
    .where(eq(messages.id, messageId));
}

export async function getMessageById(messageId: string) {
  const result = await db
    .select()
    .from(messages)
    .where(eq(messages.id, messageId))
    .limit(1);

  return result[0] || null;
}
