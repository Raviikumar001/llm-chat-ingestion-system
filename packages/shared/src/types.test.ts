import { describe, it, expect } from 'vitest';
import { IngestionPayloadSchema } from '@ollive/shared';

describe('IngestionPayloadSchema', () => {
  it('should validate a complete payload', () => {
    const payload = {
      eventId: '550e8400-e29b-41d4-a716-446655440000',
      requestId: '550e8400-e29b-41d4-a716-446655440001',
      conversationId: '550e8400-e29b-41d4-a716-446655440002',
      userMessageId: '550e8400-e29b-41d4-a716-446655440003',
      provider: 'cerebras',
      model: 'gpt-oss-120b',
      status: 'completed',
      startedAt: '2024-01-01T00:00:00.000Z',
      completedAt: '2024-01-01T00:00:01.000Z',
      latencyMs: 1000,
      usage: {
        inputTokens: 10,
        outputTokens: 20,
        totalTokens: 30,
      },
      requestPreview: 'User asked about refunds',
      responsePreview: 'Your refund is being processed',
      metadata: { finishReason: 'stop' },
    };

    const result = IngestionPayloadSchema.safeParse(payload);
    expect(result.success).toBe(true);
  });

  it('should reject invalid provider', () => {
    const payload = {
      eventId: '550e8400-e29b-41d4-a716-446655440000',
      requestId: '550e8400-e29b-41d4-a716-446655440001',
      conversationId: '550e8400-e29b-41d4-a716-446655440002',
      userMessageId: '550e8400-e29b-41d4-a716-446655440003',
      provider: 'openai',
      model: 'gpt-4',
      status: 'completed',
      startedAt: '2024-01-01T00:00:00.000Z',
      requestPreview: 'Hello',
    };

    const result = IngestionPayloadSchema.safeParse(payload);
    expect(result.success).toBe(false);
  });

  it('should reject negative token counts', () => {
    const payload = {
      eventId: '550e8400-e29b-41d4-a716-446655440000',
      requestId: '550e8400-e29b-41d4-a716-446655440001',
      conversationId: '550e8400-e29b-41d4-a716-446655440002',
      userMessageId: '550e8400-e29b-41d4-a716-446655440003',
      provider: 'cerebras',
      model: 'gpt-oss-120b',
      status: 'completed',
      startedAt: '2024-01-01T00:00:00.000Z',
      requestPreview: 'Hello',
      usage: {
        inputTokens: -1,
      },
    };

    const result = IngestionPayloadSchema.safeParse(payload);
    expect(result.success).toBe(false);
  });
});
