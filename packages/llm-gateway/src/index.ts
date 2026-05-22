import { CerebrasProvider } from './providers/cerebras';
import { GeminiProvider } from './providers/gemini';
import { LlmProvider, IngestionCallback } from './types';
import { ingestionClient } from './instrumentation/ingestion-client';

export function createProvider(providerName: string, apiKey: string): LlmProvider {
  switch (providerName) {
    case 'cerebras':
      return new CerebrasProvider(apiKey);
    case 'gemini':
      return new GeminiProvider(apiKey);
    default:
      throw new Error(`Unsupported provider: ${providerName}`);
  }
}

export function setIngestionCallback(callback: IngestionCallback) {
  ingestionClient.setCallback(callback);
}

export * from './types';
export { CerebrasProvider } from './providers/cerebras';
export { GeminiProvider } from './providers/gemini';
