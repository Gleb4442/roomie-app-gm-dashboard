import { HotelPMSConfig } from '@prisma/client';
import { BasePMSAdapter } from '../BasePMSAdapter';
import {
  PMSReservation,
  PMSRoomStatus,
  PMSGuestProfile,
  PMSFetchReservationsParams,
  PMSConnectionResult,
  PMSWebhookEvent,
} from '../types';
import { logger } from '../../../shared/utils/logger';

interface MockCredentials {
  scenario?: 'standard' | 'room_unavailable';
  reservations?: Array<{
    externalId: string;
    guestName: string;
    guestEmail?: string;
    guestPhone?: string;
    roomNumber?: string;
    roomType?: string;
    checkIn: string;
    checkOut: string;
    status: 'confirmed' | 'checked_in' | 'checked_out' | 'cancelled';
    adults?: number;
    children?: number;
    source?: string;
    totalAmount?: number;
    currency?: string;
  }>;
}

/**
 * MockPMSAdapter — a safe in-memory PMS adapter for local testing and E2E tests.
 * No real HTTP calls. Reads reservations from credentials JSON stored in HotelPMSConfig.
 *
 * Webhook payload format (send this to POST /api/webhooks/pms/:hotelId):
 * { "type": "reservation_created" | "guest_checked_in" | "guest_checked_out", "externalId": "MOCK-xxx" }
 */
export class MockPMSAdapter extends BasePMSAdapter {
  private creds: MockCredentials;

  constructor(config: HotelPMSConfig) {
    super(config);
    this.creds = (config.credentials as MockCredentials) || {};
  }

  private get reservations(): PMSReservation[] {
    return (this.creds.reservations || []).map(r => ({
      externalId: r.externalId,
      guestName: r.guestName,
      guestEmail: r.guestEmail,
      guestPhone: r.guestPhone,
      roomNumber: r.roomNumber,
      roomType: r.roomType,
      checkIn: new Date(r.checkIn),
      checkOut: new Date(r.checkOut),
      status: r.status,
      adults: r.adults ?? 1,
      children: r.children ?? 0,
      source: r.source,
      totalAmount: r.totalAmount,
      currency: r.currency,
    }));
  }

  async fetchReservations(params: PMSFetchReservationsParams): Promise<PMSReservation[]> {
    logger.debug({ from: params.from, to: params.to }, '[MockPMS] fetchReservations');
    return this.reservations.filter(r => r.checkOut >= params.from && r.checkIn <= params.to);
  }

  async getReservation(externalId: string): Promise<PMSReservation | null> {
    logger.debug({ externalId }, '[MockPMS] getReservation');
    return this.reservations.find(r => r.externalId === externalId) ?? null;
  }

  async getPreCheckinUrl(_externalId: string): Promise<string | null> {
    // Mock PMS does not provide a pre-check-in URL — uses native form
    return null;
  }

  async fetchRoomStatuses(): Promise<PMSRoomStatus[]> {
    logger.debug('[MockPMS] fetchRoomStatuses — returning empty list');
    return [];
  }

  async getGuestProfile(_externalId: string): Promise<PMSGuestProfile | null> {
    return null;
  }

  async testConnection(): Promise<PMSConnectionResult> {
    return { ok: true };
  }

  /**
   * Parse our test webhook payload format.
   * Expected body: { type: 'reservation_created' | 'guest_checked_in' | 'guest_checked_out', externalId: string }
   */
  parseWebhookPayload(
    payload: unknown,
    _headers: Record<string, string | string[] | undefined>,
  ): PMSWebhookEvent | null {
    const body = payload as Record<string, unknown>;
    const type = body?.type as string;
    const externalId = body?.externalId as string;

    if (!externalId || !type) {
      logger.warn({ payload }, '[MockPMS] Invalid webhook payload — missing type or externalId');
      return null;
    }

    const validTypes = ['reservation_created', 'reservation_updated', 'guest_checked_in', 'guest_checked_out'];
    if (!validTypes.includes(type)) {
      logger.warn({ type }, '[MockPMS] Unknown webhook event type');
      return null;
    }

    return {
      type: type as PMSWebhookEvent['type'],
      externalId,
      data: body,
    };
  }

  /**
   * Always verify — no secret in test mode.
   */
  verifyWebhookSignature(
    _payload: unknown,
    _headers: Record<string, string | string[] | undefined>,
    _secret: string,
  ): boolean {
    return true;
  }

  /**
   * Check if a room is available for a date range.
   * Returns false when scenario = 'room_unavailable', true otherwise.
   * (Optional method, not in BasePMSAdapter — used by stays service via duck-typing.)
   */
  async checkRoomAvailability(
    _roomNumber: string,
    _from: Date,
    _to: Date,
  ): Promise<boolean> {
    const available = this.creds.scenario !== 'room_unavailable';
    logger.debug({ scenario: this.creds.scenario, available }, '[MockPMS] checkRoomAvailability');
    return available;
  }
}
