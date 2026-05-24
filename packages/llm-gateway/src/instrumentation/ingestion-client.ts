import { IngestionPayload } from '../types';

interface IngestionClientConfig {
  endpoint?: string;
  headers?: Record<string, string>;
  timeoutMs?: number;
  maxRetries?: number;
}

export class IngestionClient {
  private config: Required<IngestionClientConfig> = {
    endpoint: '',
    headers: {},
    timeoutMs: 2_500,
    maxRetries: 1,
  };

  configure(config: IngestionClientConfig) {
    this.config = {
      endpoint: config.endpoint ?? '',
      headers: config.headers ?? {},
      timeoutMs: config.timeoutMs ?? 2_500,
      maxRetries: config.maxRetries ?? 1,
    };
  }

  async emit(payload: IngestionPayload): Promise<void> {
    if (!this.config.endpoint) {
      // Silently drop if no callback is set
      return;
    }

    let lastError: unknown = null;

    for (let attempt = 0; attempt <= this.config.maxRetries; attempt += 1) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.config.timeoutMs);

      try {
        const response = await fetch(this.config.endpoint, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            ...this.config.headers,
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          if (this.shouldRetryStatus(response.status) && attempt < this.config.maxRetries) {
            continue;
          }

          throw new Error(`Ingestion endpoint returned HTTP ${response.status}`);
        }

        return;
      } catch (err) {
        clearTimeout(timeoutId);
        lastError = err;

        if (attempt >= this.config.maxRetries || !this.shouldRetryError(err)) {
          break;
        }
      }
    }

    // Log emission failures should not crash the chat flow
    console.warn('Failed to emit ingestion payload:', lastError);
  }

  private shouldRetryStatus(status: number): boolean {
    return status === 408 || status === 429 || status >= 500;
  }

  private shouldRetryError(err: unknown): boolean {
    if (!(err instanceof Error)) {
      return false;
    }

    if (err.name === 'AbortError') {
      return true;
    }

    return true;
  }
}

export const ingestionClient = new IngestionClient();
