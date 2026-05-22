import type { ChatMessage } from '@ollive/shared';

const SYSTEM_PROMPT = 'You are a helpful assistant.';
const MAX_CONTEXT_MESSAGES = 8;
const MAX_CONTEXT_CHARS = 7000;

export function buildPromptContext(
  messages: Array<{ role: string; content: string; status: string }>
): ChatMessage[] {
  // Filter out failed or cancelled assistant messages
  const validMessages = messages.filter((msg) => {
    if (msg.role === 'assistant') {
      return msg.status !== 'failed' && msg.status !== 'cancelled';
    }
    return true;
  });

  // Take the last N messages
  const recentMessages = validMessages.slice(-MAX_CONTEXT_MESSAGES);

  // Build context with system prompt
  const context: ChatMessage[] = [
    { role: 'system', content: SYSTEM_PROMPT },
  ];

  // Add messages, trimming if needed
  let currentChars = SYSTEM_PROMPT.length;

  for (const msg of recentMessages) {
    const msgChars = msg.content.length;

    // If adding this message would exceed the char budget, stop
    if (currentChars + msgChars > MAX_CONTEXT_CHARS && context.length > 1) {
      break;
    }

    context.push({
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
    });

    currentChars += msgChars;
  }

  return context;
}
