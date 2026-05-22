import { describe, it, expect } from 'vitest';
import { truncatePreview, buildRequestPreview, buildResponsePreview } from '../../../packages/llm-gateway/src/instrumentation/preview';

describe('preview helpers', () => {
  describe('truncatePreview', () => {
    it('should return short text unchanged', () => {
      const text = 'Hello world';
      expect(truncatePreview(text)).toBe('Hello world');
    });

    it('should truncate long text', () => {
      const text = 'a'.repeat(600);
      const result = truncatePreview(text, 500);
      expect(result.length).toBe(503); // 500 + '...'
      expect(result.endsWith('...')).toBe(true);
    });

    it('should trim whitespace', () => {
      const text = '  hello  ';
      expect(truncatePreview(text)).toBe('hello');
    });
  });

  describe('buildRequestPreview', () => {
    it('should use last user message', () => {
      const messages = [
        { role: 'system', content: 'You are helpful' },
        { role: 'user', content: 'First question' },
        { role: 'assistant', content: 'First answer' },
        { role: 'user', content: 'Second question' },
      ];
      expect(buildRequestPreview(messages)).toBe('Second question');
    });

    it('should fallback to last message', () => {
      const messages = [
        { role: 'system', content: 'You are helpful' },
        { role: 'assistant', content: 'Hello there' },
      ];
      expect(buildRequestPreview(messages)).toBe('Hello there');
    });
  });

  describe('buildResponsePreview', () => {
    it('should build response preview', () => {
      const text = 'This is the assistant response';
      expect(buildResponsePreview(text)).toBe('This is the assistant response');
    });
  });
});
