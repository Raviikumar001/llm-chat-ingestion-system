export function truncatePreview(text: string, maxLength: number = 500): string {
  const trimmed = text.trim();
  if (trimmed.length <= maxLength) {
    return trimmed;
  }
  return trimmed.slice(0, maxLength) + '...';
}

export function sanitizeForPreview(text: string): string {
  // Remove invalid UTF-8 surrogates and control characters
  return text
    .replace(/[\x00-\x08\x0b-\x0c\x0e-\x1f\x7f-\x9f]/g, '')
    .replace(/[\ud800-\udfff]/g, '');
}

export function buildRequestPreview(messages: Array<{ role: string; content: string }>): string {
  // Build a safe preview from the last user message or all messages
  const lastUserMessage = [...messages].reverse().find(m => m.role === 'user');
  const text = lastUserMessage?.content || messages[messages.length - 1]?.content || '';
  return truncatePreview(sanitizeForPreview(text));
}

export function buildResponsePreview(text: string): string {
  return truncatePreview(sanitizeForPreview(text));
}
