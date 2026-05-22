import { pgTable, uuid, text, timestamp, integer, jsonb, varchar, index, uniqueIndex, check, foreignKey } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// Conversations table
export const conversations = pgTable(
  'conversations',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    title: text('title'),
    status: text('status').notNull().default('active'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    lastMessageAt: timestamp('last_message_at', { withTimezone: true }),
  },
  (table) => [
    index('conversations_updated_at_idx').on(table.updatedAt),
    index('conversations_last_message_at_idx').on(table.lastMessageAt),
    index('conversations_status_idx').on(table.status),
    check('conversations_status_check', sql`${table.status} IN ('active', 'completed', 'errored', 'cancelled')`),
  ]
);

// Messages table
export const messages = pgTable(
  'messages',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    conversationId: uuid('conversation_id').notNull(),
    role: text('role').notNull(),
    content: text('content').notNull(),
    contentPreview: text('content_preview').notNull(),
    status: text('status').notNull().default('completed'),
    sequenceNumber: integer('sequence_number').notNull(),
    providerMessageId: text('provider_message_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    foreignKey({
      columns: [table.conversationId],
      foreignColumns: [conversations.id],
      name: 'messages_conversation_id_fk',
    }).onDelete('cascade'),
    index('messages_conversation_seq_idx').on(table.conversationId, table.sequenceNumber),
    index('messages_created_at_idx').on(table.createdAt),
    uniqueIndex('messages_conversation_seq_unique').on(table.conversationId, table.sequenceNumber),
    check('messages_role_check', sql`${table.role} IN ('system', 'user', 'assistant')`),
    check('messages_status_check', sql`${table.status} IN ('completed', 'partial', 'failed', 'cancelled')`),
  ]
);

// Inference logs table
export const inferenceLogs = pgTable(
  'inference_logs',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    eventId: uuid('event_id').notNull().unique(),
    requestId: uuid('request_id').notNull(),
    conversationId: uuid('conversation_id').notNull(),
    userMessageId: uuid('user_message_id').notNull(),
    assistantMessageId: uuid('assistant_message_id'),
    provider: text('provider').notNull(),
    model: text('model').notNull(),
    status: text('status').notNull(),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    latencyMs: integer('latency_ms'),
    timeToFirstTokenMs: integer('time_to_first_token_ms'),
    inputTokens: integer('input_tokens'),
    outputTokens: integer('output_tokens'),
    totalTokens: integer('total_tokens'),
    finishReason: text('finish_reason'),
    requestPreview: text('request_preview').notNull(),
    responsePreview: text('response_preview'),
    errorCode: text('error_code'),
    errorMessage: text('error_message'),
    httpStatus: integer('http_status'),
    rawMetadata: jsonb('raw_metadata').notNull().default('{}'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    foreignKey({
      columns: [table.conversationId],
      foreignColumns: [conversations.id],
      name: 'inference_logs_conversation_id_fk',
    }).onDelete('restrict'),
    foreignKey({
      columns: [table.userMessageId],
      foreignColumns: [messages.id],
      name: 'inference_logs_user_message_id_fk',
    }).onDelete('restrict'),
    foreignKey({
      columns: [table.assistantMessageId],
      foreignColumns: [messages.id],
      name: 'inference_logs_assistant_message_id_fk',
    }).onDelete('restrict'),
    index('inference_logs_conversation_id_idx').on(table.conversationId),
    index('inference_logs_request_id_idx').on(table.requestId),
    index('inference_logs_status_idx').on(table.status),
    index('inference_logs_provider_idx').on(table.provider),
    index('inference_logs_model_idx').on(table.model),
    index('inference_logs_started_at_idx').on(table.startedAt),
    check(
      'inference_logs_status_check',
      sql`${table.status} IN ('started', 'completed', 'failed', 'cancelled', 'timed_out')`
    ),
    check('inference_logs_latency_positive', sql`${table.latencyMs} IS NULL OR ${table.latencyMs} >= 0`),
    check('inference_logs_input_tokens_positive', sql`${table.inputTokens} IS NULL OR ${table.inputTokens} >= 0`),
    check('inference_logs_output_tokens_positive', sql`${table.outputTokens} IS NULL OR ${table.outputTokens} >= 0`),
    check('inference_logs_total_tokens_positive', sql`${table.totalTokens} IS NULL OR ${table.totalTokens} >= 0`),
  ]
);
