import { IngestionCallback, IngestionPayload } from '../types';

export class IngestionClient {
  private callback: IngestionCallback | null = null;

  setCallback(callback: IngestionCallback) {
    this.callback = callback;
  }

  async emit(payload: IngestionPayload): Promise<void> {
    if (!this.callback) {
      // Silently drop if no callback is set
      return;
    }

    try {
      await this.callback(payload);
    } catch (err) {
      // Log emission failures should not crash the chat flow
      console.warn('Failed to emit ingestion payload:', err);
    }
  }
}

export const ingestionClient = new IngestionClient();
