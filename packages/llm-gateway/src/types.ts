import { SupportedProvider } from '@ollive/shared';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ProviderGenerateRequest {
  conversationId: string;
  userMessageId: string;
  model: string;
  messages: ChatMessage[];
  stream?: boolean;
}

export interface ProviderGenerateResult {
  text: string;
  finishReason?: string;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
  };
  providerMessageId?: string;
}

export interface ProviderStreamChunk {
  text: string;
  finishReason?: string;
}

export interface LlmProvider {
  name: SupportedProvider;
  generate(request: ProviderGenerateRequest): Promise<ProviderGenerateResult>;
  stream?(request: ProviderGenerateRequest): AsyncIterable<ProviderStreamChunk>;
}

export interface IngestionPayload {
  eventId: string;
  requestId: string;
  conversationId: string;
  userMessageId: string;
  assistantMessageId?: string | null;
  provider: SupportedProvider;
  model: string;
  status: 'started' | 'completed' | 'failed' | 'cancelled' | 'timed_out';
  startedAt: string;
  completedAt?: string | null;
  latencyMs?: number | null;
  timeToFirstTokenMs?: number | null;
  usage?: {
    inputTokens?: number | null;
    outputTokens?: number | null;
    totalTokens?: number | null;
  } | null;
  requestPreview: string;
  responsePreview?: string | null;
  error?: {
    code: string;
    message: string;
  } | null;
  metadata?: Record<string, unknown>;
}

export type IngestionCallback = (payload: IngestionPayload) => Promise<void> | void;
