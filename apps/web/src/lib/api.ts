const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export interface ChatOptionsResponse {
  defaultProvider: 'cerebras' | 'gemini';
  defaultModel: string;
  providers: Array<{
    provider: 'cerebras' | 'gemini';
    models: string[];
  }>;
  features: {
    streamingEnabled: boolean;
    cancellationEnabled: boolean;
  };
}

export interface MetricsOverviewResponse {
  generatedAt: string;
  windowHours: number;
  totals: {
    totalRequests: number;
    completedRequests: number;
    failedRequests: number;
    cancelledRequests: number;
    timedOutRequests: number;
    avgLatencyMs: number | null;
    p95LatencyMs: number | null;
    requestsLastHour: number;
    errorRate: number;
  };
  providers: Array<{
    provider: string;
    totalRequests: number;
    avgLatencyMs: number | null;
    errorRate: number;
  }>;
  recentErrors: Array<{
    requestId: string;
    provider: string;
    model: string;
    errorCode: string | null;
    errorMessage: string | null;
    createdAt: string;
  }>;
}

function processSseBuffer(
  rawBuffer: string,
  onChunk: (chunk: { text: string; finishReason?: string }) => void,
  onDone: (messageId: string) => void,
  onError: (error: string) => void,
  onCancelled: (messageId?: string) => void
) {
  const lines = rawBuffer.split(/\r?\n/);
  const remainder = rawBuffer.endsWith('\n') ? '' : (lines.pop() || '');

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('data: ')) continue;

    const data = trimmed.slice(6);
    if (!data) continue;

    let parsed: any;
    try {
      parsed = JSON.parse(data);
    } catch {
      continue;
    }

    if (parsed.done) {
      onDone(parsed.messageId);
      return { remainder: '', terminal: true as const };
    }

    if (parsed.cancelled) {
      onCancelled(parsed.messageId);
      return { remainder: '', terminal: true as const };
    }

    if (parsed.error) {
      onError(parsed.error);
      throw new Error(parsed.error);
    }

    if (parsed.text) {
      onChunk(parsed);
    }
  }

  return { remainder, terminal: false as const };
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const error = (await response.json().catch(
      () => ({ error: { code: 'unknown', message: 'Unknown error', requestId: '' } })
    )) as { error?: { message?: string } };
    throw new Error(error.error?.message || `HTTP ${response.status}`);
  }
  return (await response.json()) as T;
}

export async function createConversation(title?: string) {
  const response = await fetch(`${API_BASE}/api/v1/conversations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title }),
  });
  return handleResponse<{ id: string; title: string | null; status: string; createdAt: string }>(response);
}

export async function listConversations() {
  const response = await fetch(`${API_BASE}/api/v1/conversations`);
  const data = await handleResponse<{ conversations: Array<{
    id: string;
    title: string | null;
    status: string;
    lastMessagePreview: string | null;
    lastMessageAt: string | null;
    messageCount: number;
  }> }>(response);
  return data.conversations;
}

export async function getConversation(id: string) {
  const response = await fetch(`${API_BASE}/api/v1/conversations/${id}`);
  return handleResponse<{
    id: string;
    title: string | null;
    status: string;
    messages: Array<{
      id: string;
      role: string;
      content: string;
      status: string;
      sequenceNumber: number;
      createdAt: string;
    }>;
  }>(response);
}

export async function sendMessage(conversationId: string, message: string) {
  const response = await fetch(`${API_BASE}/api/v1/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ conversationId, message }),
  });
  return handleResponse<{
    requestId: string;
    message: {
      id: string;
      role: string;
      content: string;
      status: string;
      sequenceNumber: number;
    };
    metadata: {
      provider: string;
      model: string;
      finishReason?: string;
      usage?: {
        inputTokens?: number;
        outputTokens?: number;
        totalTokens?: number;
      };
    };
  }>(response);
}

export async function getChatOptions() {
  const response = await fetch(`${API_BASE}/api/v1/chat/options`);
  return handleResponse<ChatOptionsResponse>(response);
}

export async function getMetricsOverview() {
  const response = await fetch(`${API_BASE}/api/v1/metrics/overview`);
  return handleResponse<MetricsOverviewResponse>(response);
}

export async function sendMessageWithOptions(
  conversationId: string,
  message: string,
  provider: 'cerebras' | 'gemini',
  model: string
) {
  const response = await fetch(`${API_BASE}/api/v1/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ conversationId, message, provider, model }),
  });

  return handleResponse<{
    requestId: string;
    message: {
      id: string;
      role: string;
      content: string;
      status: string;
      sequenceNumber: number;
    };
    metadata: {
      provider: string;
      model: string;
      finishReason?: string;
      usage?: {
        inputTokens?: number;
        outputTokens?: number;
        totalTokens?: number;
      };
    };
  }>(response);
}

export async function streamMessage(
  conversationId: string,
  message: string,
  provider: 'cerebras' | 'gemini',
  model: string,
  onChunk: (chunk: { text: string; finishReason?: string }) => void,
  onDone: (messageId: string) => void,
  onError: (error: string) => void,
  onCancelled: (messageId?: string) => void
) {
  const response = await fetch(`${API_BASE}/api/v1/chat/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ conversationId, message, provider, model }),
  });

  if (!response.ok) {
    const error = (await response.json().catch(
      () => ({ error: { message: 'Unknown error' } })
    )) as { error?: { message?: string } };
    throw new Error(error.error?.message || `HTTP ${response.status}`);
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('No response body');
  }

  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (value) {
      buffer += decoder.decode(value, { stream: !done });
    }

    const result = processSseBuffer(buffer, onChunk, onDone, onError, onCancelled);
    buffer = result.remainder;
    if (result.terminal) {
      return;
    }

    if (done) break;
  }

  if (buffer.trim()) {
    const result = processSseBuffer(buffer, onChunk, onDone, onError, onCancelled);
    if (result.terminal) {
      return;
    }
  }
}

export async function cancelConversation(conversationId: string) {
  const response = await fetch(`${API_BASE}/api/v1/chat/${conversationId}/cancel`, {
    method: 'POST',
  });
  return handleResponse<{ status: string; conversationId: string }>(response);
}
