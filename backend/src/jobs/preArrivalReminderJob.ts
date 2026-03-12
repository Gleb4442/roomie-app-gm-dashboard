import cron from 'node-cron';
import { prisma } from '../config/database';
import { logger } from '../shared/utils/logger';
import { smsService } from '../modules/sms/smsService';
import { TemplateContext } from '../modules/sms/types';

// Days before check-in to send reminder (configurable)
const REMINDER_DAYS = [2, 1];

/**
 * Runs daily at 10:00 AM UTC.
 * Finds all PRE_ARRIVAL stays with checkIn in REMINDER_DAYS days
 * and sends a pre_arrival_reminder SMS if not already sent.
 */
export function startPreArrivalReminderJob(): void {
  cron.schedule('0 10 * * *', async () => {
    logger.info('[PreArrivalReminder] Job started');
    try {
      await runPreArrivalReminders();
    } catch (err) {
      logger.error({ err }, '[PreArrivalReminder] Job failed');
    }
  });

  logger.info('[PreArrivalReminder] Scheduled daily at 10:00 UTC');
}

export async function runPreArrivalReminders(): Promise<void> {
  const now = new Date();

  for (const daysAhead of REMINDER_DAYS) {
    // Find stays where checkIn falls within [startOfDay, endOfDay] for the target date
    const targetDate = new Date(now);
    targetDate.setUTCDate(targetDate.getUTCDate() + daysAhead);

    const from = new Date(targetDate);
    from.setUTCHours(0, 0, 0, 0);

    const to = new Date(targetDate);
    to.setUTCHours(23, 59, 59, 999);

    const stays = await prisma.guestStay.findMany({
      where: {
        stage: 'PRE_ARRIVAL',
        checkIn: { gte: from, lte: to },
      },
      include: {
        guest: { select: { firstName: true, phone: true, preferences: true } },
        hotel: { select: { name: true } },
      },
    });

    logger.info(
      { daysAhead, count: stays.length, from, to },
      '[PreArrivalReminder] Stays found',
    );

    for (const stay of stays) {
      try {
        if (!stay.guest?.phone) {
          logger.debug({ stayId: stay.id }, '[PreArrivalReminder] No phone, skipping');
          continue;
        }

        const appLink = `roomie://open?source=sms_booking&hotel=${stay.hotelId}&stayId=${stay.id}`;
        const context: TemplateContext = {
          guestName: stay.guest.firstName,
          hotelName: stay.hotel?.name ?? '',
          checkIn: stay.checkIn ? formatDate(stay.checkIn) : undefined,
          checkOut: stay.checkOut ? formatDate(stay.checkOut) : undefined,
          appLink,
          preCheckinUrl: stay.preCheckinUrl ?? undefined,
        };

        const prefs = stay.guest.preferences as Record<string, string> | null;
        const language = prefs?.language || 'uk';

        await smsService.send({
          hotelId: stay.hotelId,
          guestId: stay.guestId,
          guestStayId: stay.id,
          phone: stay.guest.phone,
          template: 'pre_arrival_reminder',
          context,
          language,
        });

        logger.info(
          { stayId: stay.id, daysAhead },
          '[PreArrivalReminder] SMS queued',
        );
      } catch (err) {
        logger.error({ err, stayId: stay.id }, '[PreArrivalReminder] Failed to send SMS');
      }
    }
  }
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}
