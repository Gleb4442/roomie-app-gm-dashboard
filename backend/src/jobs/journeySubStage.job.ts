import cron from 'node-cron';
import { journeyService } from '../modules/journey/journey.service';
import { logger } from '../shared/utils/logger';

/**
 * Runs every hour at minute 0.
 * Recomputes subStage for all active stays based on current date/time.
 *
 * Sub-stage transitions happen automatically:
 * - PRE_ARRIVAL: BOOKING_CONFIRMED → DAYS_7_BEFORE → DAYS_1_BEFORE
 * - IN_STAY: DAY_1 → MID_STAY → DAYS_1_BEFORE_OUT
 * - POST_STAY: DAYS_1_AFTER → DAYS_7_AFTER
 */
export function startJourneySubStageJob(): void {
  cron.schedule('0 * * * *', async () => {
    logger.info('[JourneySubStage] Job started');
    try {
      const count = await journeyService.refreshAllSubStages();
      logger.info({ updatedCount: count }, '[JourneySubStage] Job completed');
    } catch (err) {
      logger.error({ err }, '[JourneySubStage] Job failed');
    }
  });

  logger.info('[JourneySubStage] Scheduled hourly at :00');
}
