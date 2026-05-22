import { describe, it, expect } from 'vitest';
import { normalizeError } from '../../../../packages/llm-gateway/src/instrumentation/errors';

describe('normalizeError', () => {
  it('should map timeout errors', () => {
    const error = new Error('Request timeout');
    const result = normalizeError(error);
    expect(result.code).toBe('timeout');
  });

  it('should map rate limit errors', () => {
    const error = new Error('Rate limit exceeded');
    const result = normalizeError(error);
    expect(result.code).toBe('rate_limit');
  });

  it('should map auth errors', () => {
    const error = new Error('Unauthorized: invalid API key');
    const result = normalizeError(error);
    expect(result.code).toBe('provider_auth');
  });

  it('should map network errors', () => {
    const error = new Error('fetch failed: ECONNREFUSED');
    const result = normalizeError(error);
    expect(result.code).toBe('network');
  });

  it('should map unknown errors', () => {
    const error = new Error('Something weird happened');
    const result = normalizeError(error);
    expect(result.code).toBe('unknown');
  });
});
