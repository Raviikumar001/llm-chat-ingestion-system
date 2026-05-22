import { z } from 'zod';

// Enums / Literal Unions
export const MessageRole = z.enum(['system', 'user', 'assistant']);
export type MessageRole = z.infer<typeof MessageRole>;

export const MessageStatus = z.enum(['completed', 'partial', 'failed', 'cancelled']);
export type MessageStatus = z.infer<typeof MessageStatus>;

export const ConversationStatus = z.enum(['active', 'completed', 'errored', 'cancelled']);
export type ConversationStatus = z.infer<typeof ConversationStatus>;

export const InferenceStatus = z.enum(['started', 'completed', 'failed', 'cancelled', 'timed_out']);
export type InferenceStatus = z.infer<typeof InferenceStatus>;

export const SupportedProvider = z.enum(['cerebras', 'gemini']);
export type SupportedProvider = z.infer<typeof SupportedProvider>;

// UUID schema helper
export const UuidSchema = z.string().uuid();
export const ConversationIdParamsSchema = z.object({
  id: UuidSchema,
});

// API Request Schemas
export const CreateConversationRequestSchema = z.object({
  title: z.string().max(200).optional(),
});

export const SendChatRequestSchema = z.object({
  conversationId: UuidSchema,
  message: z.string().min(1, 'Message cannot be empty').max(8000, 'Message too long'),
  provider: SupportedProvider.optional(),
  model: z.string().min(1).optional(),
});

export const StreamChatRequestSchema = SendChatRequestSchema;

export const CancelConversationRequestSchema = z.object({
  conversationId: UuidSchema,
});

// Ingestion Payload Schema
export const IngestionPayloadSchema = z.object({
  eventId: UuidSchema,
  requestId: UuidSchema,
  conversationId: UuidSchema,
  userMessageId: UuidSchema,
  assistantMessageId: UuidSchema.optional().nullable(),
  provider: SupportedProvider,
  model: z.string().min(1),
  status: InferenceStatus,
  startedAt: z.string().datetime({ offset: true }),
  completedAt: z.string().datetime({ offset: true }).optional().nullable(),
  latencyMs: z.number().int().min(0).optional().nullable(),
  timeToFirstTokenMs: z.number().int().min(0).optional().nullable(),
  usage: z.object({
    inputTokens: z.number().int().min(0).optional().nullable(),
    outputTokens: z.number().int().min(0).optional().nullable(),
    totalTokens: z.number().int().min(0).optional().nullable(),
  }).optional().nullable(),
  requestPreview: z.string().min(1).max(1000),
  responsePreview: z.string().max(1000).optional().nullable(),
  error: z.object({
    code: z.string(),
    message: z.string(),
  }).optional().nullable(),
  httpStatus: z.number().int().min(100).max(599).optional().nullable(),
  metadata: z.record(z.unknown()).optional().default({}),
});

export type CreateConversationRequest = z.infer<typeof CreateConversationRequestSchema>;
export type SendChatRequest = z.infer<typeof SendChatRequestSchema>;
export type ConversationIdParams = z.infer<typeof ConversationIdParamsSchema>;
export type IngestionPayload = z.infer<typeof IngestionPayloadSchema>;

// API Response Types
export interface Conversation {
  id: string;
  title: string | null;
  status: ConversationStatus;
  createdAt: Date;
  updatedAt: Date;
  lastMessageAt: Date | null;
}

export interface Message {
  id: string;
  conversationId: string;
  role: MessageRole;
  content: string;
  contentPreview: string;
  status: MessageStatus;
  sequenceNumber: number;
  providerMessageId: string | null;
  createdAt: Date;
}

export interface InferenceLog {
  id: string;
  eventId: string;
  requestId: string;
  conversationId: string;
  userMessageId: string;
  assistantMessageId: string | null;
  provider: SupportedProvider;
  model: string;
  status: InferenceStatus;
  startedAt: Date;
  completedAt: Date | null;
  latencyMs: number | null;
  timeToFirstTokenMs: number | null;
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
  finishReason: string | null;
  requestPreview: string;
  responsePreview: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  httpStatus: number | null;
  rawMetadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

// Common error shape
export interface ApiError {
  error: {
    code: string;
    message: string;
    requestId: string;
  };
}

// Context window types
export interface ChatMessage {
  role: MessageRole;
  content: string;
}

// Ingestion response
export interface IngestionResponse {
  accepted: boolean;
  eventId: string;
}
