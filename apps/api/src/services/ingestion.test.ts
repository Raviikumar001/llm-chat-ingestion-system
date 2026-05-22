import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { IngestionPayload } from '@ollive/shared';

const selectQueues: Array<unknown[]> = [];
const insertValuesMock = vi.fn();
const updateWhereMock = vi.fn();
const updateSetMock = vi.fn(() => ({ where: updateWhereMock }));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((field: unknown, value: unknown) => ({ field, value })),
}));

vi.mock('../db/schema', () => ({
  inferenceLogs: {
    id: 'id',
    eventId: 'eventId',
    requestId: 'requestId',
    assistantMessageId: 'assistantMessageId',
  },
}));

vi.mock('../db', () => ({
  db: {
    select: vi.fn(() => ({
      from: () => ({
        where: () => ({
          limit: vi.fn(async () => selectQueues.shift() ?? []),
        }),
      }),
    })),
    insert: vi.fn(() => ({
      values: insertValuesMock,
    })),
    update: vi.fn(() => ({
      set: updateSetMock,
    })),
  },
}));

import { linkAssistantMessageToInferenceLog, processIngestionPayload } from './ingestion';

function buildPayload(overrides: Partial<IngestionPayload> = {}): IngestionPayload {
  return {
    eventId: '11111111-1111-4111-8111-111111111111',
    requestId: '22222222-2222-4222-8222-222222222222',
    conversationId: '33333333-3333-4333-8333-333333333333',
    userMessageId: '44444444-4444-4444-8444-444444444444',
    provider: 'cerebras',
    model: 'gpt-oss-120b',
    status: 'started',
    startedAt: '2026-05-23T00:00:00.000Z',
    requestPreview: 'hello',
    metadata: {},
    ...overrides,
  };
}

describe('processIngestionPayload', () => {
  beforeEach(() => {
    selectQueues.length = 0;
    insertValuesMock.mockReset();
    insertValuesMock.mockResolvedValue(undefined);
    updateWhereMock.mockReset();
    updateWhereMock.mockResolvedValue(undefined);
    updateSetMock.mockClear();
  });

  it('returns early for duplicate event ids', async () => {
    selectQueues.push([{ id: 'existing-log' }]);

    const result = await processIngestionPayload(buildPayload());

    expect(result).toEqual({
      accepted: true,
      eventId: '11111111-1111-4111-8111-111111111111',
    });
    expect(insertValuesMock).not.toHaveBeenCalled();
    expect(updateSetMock).not.toHaveBeenCalled();
  });

  it('ignores stale started retries after a terminal lifecycle update', async () => {
    selectQueues.push([], [{
      eventId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      requestId: '22222222-2222-4222-8222-222222222222',
      conversationId: '33333333-3333-4333-8333-333333333333',
      userMessageId: '44444444-4444-4444-8444-444444444444',
      assistantMessageId: '55555555-5555-4555-8555-555555555555',
      provider: 'cerebras',
      model: 'gpt-oss-120b',
      status: 'completed',
      startedAt: new Date('2026-05-23T00:00:00.000Z'),
      completedAt: new Date('2026-05-23T00:00:01.000Z'),
      latencyMs: 1000,
      timeToFirstTokenMs: 100,
      inputTokens: 10,
      outputTokens: 20,
      totalTokens: 30,
      finishReason: 'stop',
      requestPreview: 'hello',
      responsePreview: 'hi there',
      errorCode: null,
      errorMessage: null,
      httpStatus: 200,
      rawMetadata: { finishReason: 'stop' },
      createdAt: new Date('2026-05-23T00:00:00.000Z'),
      updatedAt: new Date('2026-05-23T00:00:01.000Z'),
    }]);

    const result = await processIngestionPayload(buildPayload({
      status: 'started',
      eventId: '66666666-6666-4666-8666-666666666666',
    }));

    expect(result.accepted).toBe(true);
    expect(insertValuesMock).not.toHaveBeenCalled();
    expect(updateSetMock).not.toHaveBeenCalled();
  });

  it('merges terminal lifecycle updates without replacing the original event id', async () => {
    selectQueues.push([], [{
      eventId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      requestId: '22222222-2222-4222-8222-222222222222',
      conversationId: '33333333-3333-4333-8333-333333333333',
      userMessageId: '44444444-4444-4444-8444-444444444444',
      assistantMessageId: null,
      provider: 'cerebras',
      model: 'gpt-oss-120b',
      status: 'started',
      startedAt: new Date('2026-05-23T00:00:00.000Z'),
      completedAt: null,
      latencyMs: null,
      timeToFirstTokenMs: null,
      inputTokens: null,
      outputTokens: null,
      totalTokens: null,
      finishReason: null,
      requestPreview: 'hello',
      responsePreview: null,
      errorCode: null,
      errorMessage: null,
      httpStatus: null,
      rawMetadata: { source: 'started' },
      createdAt: new Date('2026-05-23T00:00:00.000Z'),
      updatedAt: new Date('2026-05-23T00:00:00.000Z'),
    }]);

    await processIngestionPayload(buildPayload({
      eventId: '77777777-7777-4777-8777-777777777777',
      status: 'completed',
      assistantMessageId: '55555555-5555-4555-8555-555555555555',
      completedAt: '2026-05-23T00:00:01.000Z',
      latencyMs: 1000,
      usage: {
        inputTokens: 10,
        outputTokens: 20,
        totalTokens: 30,
      },
      responsePreview: 'hi there',
      metadata: {
        source: 'completed',
        finishReason: 'stop',
      },
    }));

    expect(updateSetMock).toHaveBeenCalledWith(expect.objectContaining({
      eventId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      status: 'completed',
      assistantMessageId: '55555555-5555-4555-8555-555555555555',
      finishReason: 'stop',
      responsePreview: 'hi there',
      rawMetadata: {
        source: 'completed',
        finishReason: 'stop',
      },
    }));
  });
});

describe('linkAssistantMessageToInferenceLog', () => {
  beforeEach(() => {
    updateWhereMock.mockReset();
    updateWhereMock.mockResolvedValue(undefined);
    updateSetMock.mockClear();
  });

  it('updates the assistant message id for an inference log row', async () => {
    await linkAssistantMessageToInferenceLog(
      '22222222-2222-4222-8222-222222222222',
      '55555555-5555-4555-8555-555555555555'
    );

    expect(updateSetMock).toHaveBeenCalledWith(expect.objectContaining({
      assistantMessageId: '55555555-5555-4555-8555-555555555555',
    }));
    expect(updateWhereMock).toHaveBeenCalled();
  });
});
