import {
  PROVIDER_MODEL_CATALOG,
  getDefaultModelForProvider,
  type SupportedProvider,
} from '@ollive/shared';

export function buildChatOptions(defaultProvider: SupportedProvider, defaultModel: string) {
  return {
    defaultProvider,
    defaultModel,
    providers: Object.entries(PROVIDER_MODEL_CATALOG).map(([provider, models]) => ({
      provider: provider as SupportedProvider,
      models,
    })),
    features: {
      streamingEnabled: false,
      cancellationEnabled: false,
    },
  };
}

export function getSafeDefaultModel(provider: SupportedProvider, requestedDefaultModel?: string) {
  if (requestedDefaultModel && PROVIDER_MODEL_CATALOG[provider].includes(requestedDefaultModel)) {
    return requestedDefaultModel;
  }

  return getDefaultModelForProvider(provider);
}
