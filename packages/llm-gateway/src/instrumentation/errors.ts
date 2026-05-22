export type ProviderErrorCode =
  | 'timeout'
  | 'rate_limit'
  | 'provider_auth'
  | 'network'
  | 'unknown'
  | 'cancelled';

export interface NormalizedError {
  code: ProviderErrorCode;
  message: string;
  httpStatus?: number;
}

export function normalizeError(error: unknown): NormalizedError {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    // Network errors
    if (
      message.includes('fetch failed') ||
      message.includes('network') ||
      message.includes('econnrefused') ||
      message.includes('enotfound') ||
      message.includes('etimedout')
    ) {
      return {
        code: 'network',
        message: 'Network error connecting to the provider',
      };
    }

    // Timeout
    if (
      message.includes('timeout') ||
      message.includes('aborted') ||
      error.name === 'AbortError'
    ) {
      return {
        code: 'timeout',
        message: 'The model request timed out',
      };
    }

    // Rate limit
    if (message.includes('rate limit') || message.includes('too many requests')) {
      return {
        code: 'rate_limit',
        message: 'Rate limit exceeded. Please try again later',
      };
    }

    // Auth
    if (
      message.includes('auth') ||
      message.includes('unauthorized') ||
      message.includes('api key') ||
      message.includes('forbidden')
    ) {
      return {
        code: 'provider_auth',
        message: 'Authentication failed with the provider',
      };
    }
  }

  // Default
  const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
  return {
    code: 'unknown',
    message: errorMessage,
  };
}
