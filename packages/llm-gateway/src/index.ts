import type { SupportedProvider } from '@ollive/shared';
import { CerebrasProvider } from './providers/cerebras';
import { GeminiProvider } from './providers/gemini';
import { LlmProvider } from './types';
import { ingestionClient } from './instrumentation/ingestion-client';

export function createProvider(providerName: SupportedProvider, apiKey: string): LlmProvider {
  switch (providerName) {
    case 'cerebras':
      return new CerebrasProvider(apiKey);
    case 'gemini':
      return new GeminiProvider(apiKey);
    default:
      throw new Error(`Unsupported provider: ${providerName}`);
  }
}

export function configureIngestionClient(config: {
  endpoint: string;
  headers?: Record<string, string>;
  timeoutMs?: number;
  maxRetries?: number;
}) {
  ingestionClient.configure(config);
}

export * from './types';
export { CerebrasProvider } from './providers/cerebras';
export { GeminiProvider } from './providers/gemini';
