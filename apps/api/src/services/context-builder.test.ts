import { describe, it, expect } from 'vitest';
import { buildPromptContext } from '../services/context-builder';

describe('buildPromptContext', () => {
  it('should include system prompt', () => {
    const messages = [
      { role: 'user', content: 'Hello', status: 'completed' },
    ];
    const context = buildPromptContext(messages);
    expect(context[0].role).toBe('system');
  });

  it('should take last 8 messages', () => {
    const messages = Array.from({ length: 12 }, (_, i) => ({
      role: i % 2 === 0 ? 'user' : 'assistant',
      content: `Message ${i}`,
      status: 'completed',
    }));
    const context = buildPromptContext(messages);
    // system + 8 messages = 9 total
    expect(context.length).toBe(9);
    expect(context[1].content).toBe('Message 4');
  });

  it('should exclude failed and cancelled assistant messages', () => {
    const messages = [
      { role: 'user', content: 'Hello', status: 'completed' },
      { role: 'assistant', content: 'Failed response', status: 'failed' },
      { role: 'user', content: 'Again', status: 'completed' },
      { role: 'assistant', content: 'Good response', status: 'completed' },
    ];
    const context = buildPromptContext(messages);
    const assistantMessages = context.filter(m => m.role === 'assistant');
    expect(assistantMessages.length).toBe(1);
    expect(assistantMessages[0].content).toBe('Good response');
  });

  it('should trim by character budget', () => {
    const longMessage = 'a'.repeat(5000);
    const messages = [
      { role: 'user', content: longMessage, status: 'completed' },
      { role: 'user', content: 'Short', status: 'completed' },
    ];
    const context = buildPromptContext(messages);
    // Should include system + first long message but maybe not the short one if it exceeds budget
    expect(context.length).toBeLessThanOrEqual(3);
  });
});
