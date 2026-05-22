import type { SupportedProvider } from './types';

export const PROVIDER_MODEL_CATALOG: Record<SupportedProvider, string[]> = {
  cerebras: [
    'gpt-oss-120b',
    'llama3.1-8b',
    'qwen-3-235b-a22b-instruct-2507',
    'zai-glm-4.7',
  ],
  gemini: [
    'gemini-3.1-flash-lite',
    'gemini-3-flash-preview',
  ],
};

export function getDefaultModelForProvider(provider: SupportedProvider): string {
  return PROVIDER_MODEL_CATALOG[provider][0];
}

export function isSupportedModel(provider: SupportedProvider, model: string): boolean {
  return PROVIDER_MODEL_CATALOG[provider].includes(model);
}
