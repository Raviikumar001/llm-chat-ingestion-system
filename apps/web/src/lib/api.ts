const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface ApiError {
  error: {
    code: string;
    message: string;
    requestId: string;
  };
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: { code: 'unknown', message: 'Unknown error', requestId: '' } }));
    throw new Error(error.error?.message || `HTTP ${response.status}`);
  }
  return response.json();
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
