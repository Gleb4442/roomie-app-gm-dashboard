import { HotelSMSConfig } from '@prisma/client';
import { BaseSMSAdapter } from '../BaseSMSAdapter';
import { SMSSendParams, SMSSendResult, SMSDeliveryStatus, SMSConnectionResult } from '../types';
import { logger } from '../../../shared/utils/logger';

/**
 * LogAdapter — a no-op SMS adapter for local development and E2E tests.
 * Logs all outgoing messages to the console instead of sending them.
 * Configure a hotel with provider='log' to use this adapter.
 */
export class LogAdapter extends BaseSMSAdapter {
  constructor(config: HotelSMSConfig) {
    super(config);
  }

  async send(params: SMSSendParams): Promise<SMSSendResult> {
    logger.info(
      { to: params.to, senderName: params.senderName, text: params.text },
      '[LogSMS] SMS not sent (log adapter) — message logged above',
    );
    return {
      externalId: `log_${Date.now()}`,
      status: 'sent',
    };
  }

  async getStatus(_externalId: string): Promise<SMSDeliveryStatus> {
    return 'delivered';
  }

  async testConnection(): Promise<SMSConnectionResult> {
    return { ok: true };
  }
}
