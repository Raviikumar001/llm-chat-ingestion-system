import { eq, desc, count } from 'drizzle-orm';
import { db } from '../db';
import { conversations, messages } from '../db/schema';

export interface ConversationWithMeta {
  id: string;
  title: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  lastMessageAt: Date | null;
  lastMessagePreview: string | null;
  messageCount: number;
}

export async function createConversation(title?: string) {
  const result = await db.insert(conversations).values({
    title: title || null,
    status: 'active',
  }).returning();

  return result[0];
}

export async function listConversations(limit = 50, offset = 0): Promise<ConversationWithMeta[]> {
  // Get conversations sorted by most recent activity
  const conversationList = await db
    .select()
    .from(conversations)
    .orderBy(desc(conversations.updatedAt))
    .limit(limit)
    .offset(offset);

  // Get metadata for each conversation
  const result: ConversationWithMeta[] = [];
  for (const conv of conversationList) {
    // Get message count
    const msgCountResult = await db
      .select({ count: count() })
      .from(messages)
      .where(eq(messages.conversationId, conv.id));

    const messageCount = msgCountResult[0]?.count || 0;

    // Get last message preview
    const lastMessageResult = await db
      .select({
        contentPreview: messages.contentPreview,
        createdAt: messages.createdAt,
      })
      .from(messages)
      .where(eq(messages.conversationId, conv.id))
      .orderBy(desc(messages.sequenceNumber))
      .limit(1);

    const lastMessage = lastMessageResult[0];

    result.push({
      id: conv.id,
      title: conv.title,
      status: conv.status,
      createdAt: conv.createdAt,
      updatedAt: conv.updatedAt,
      lastMessageAt: lastMessage?.createdAt || conv.lastMessageAt,
      lastMessagePreview: lastMessage?.contentPreview || null,
      messageCount,
    });
  }

  return result;
}

export async function getConversationById(id: string) {
  const result = await db
    .select()
    .from(conversations)
    .where(eq(conversations.id, id))
    .limit(1);

  return result[0] || null;
}

export async function getConversationWithMessages(id: string) {
  const conversation = await getConversationById(id);
  if (!conversation) return null;

  const conversationMessages = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, id))
    .orderBy(messages.sequenceNumber);

  return {
    ...conversation,
    messages: conversationMessages,
  };
}

export async function updateConversationActivity(id: string, lastMessageAt?: Date) {
  const updates: Partial<typeof conversations.$inferInsert> = {
    updatedAt: new Date(),
  };

  if (lastMessageAt) {
    updates.lastMessageAt = lastMessageAt;
  }

  await db
    .update(conversations)
    .set(updates)
    .where(eq(conversations.id, id));
}

export async function updateConversationStatus(id: string, status: string) {
  await db
    .update(conversations)
    .set({ status, updatedAt: new Date() })
    .where(eq(conversations.id, id));
}

export async function updateConversationTitle(id: string, title: string) {
  const result = await db
    .update(conversations)
    .set({ title, updatedAt: new Date() })
    .where(eq(conversations.id, id))
    .returning();

  return result[0] || null;
}
