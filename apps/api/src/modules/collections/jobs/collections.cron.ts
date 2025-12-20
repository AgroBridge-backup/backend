/**
 * Collections Cron Job
 * Runs daily at 8 AM CST to process payment reminders
 * @module collections/jobs
 */

import cron from 'node-cron';
import { logger } from '../../../infrastructure/logging/logger.js';
import { collectionService } from '../services/collection.service.js';

// Timezone: America/Mexico_City (CST/CDT)
const TIMEZONE = 'America/Mexico_City';

// Schedule: 8:00 AM daily
const SCHEDULE = '0 8 * * *';

let isRunning = false;

/**
 * Initialize the collections cron job
 */
export function initCollectionsCron(): void {
  logger.info('[CollectionsCron] Initializing...', {
    schedule: SCHEDULE,
    timezone: TIMEZONE,
  });

  cron.schedule(
    SCHEDULE,
    async () => {
      if (isRunning) {
        logger.warn('[CollectionsCron] Previous run still in progress, skipping');
        return;
      }

      isRunning = true;
      const startTime = Date.now();

      try {
        logger.info('[CollectionsCron] Starting daily collection run');

        const summary = await collectionService.runDailyCollections();

        const duration = Date.now() - startTime;

        logger.info('[CollectionsCron] Completed', {
          duration,
          totalProcessed: summary.totalProcessed,
          errors: summary.errors.length,
          byStage: summary.byStage,
        });

        // Send summary to Slack/monitoring if configured
        await sendSummaryNotification(summary);

      } catch (error) {
        logger.error('[CollectionsCron] Failed:', error);

        // Alert on failure
        await sendErrorAlert(error as Error);

      } finally {
        isRunning = false;
      }
    },
    {
      timezone: TIMEZONE,
    }
  );

  logger.info('[CollectionsCron] Scheduled successfully');
}

/**
 * Run collections manually (for testing/admin)
 */
export async function runCollectionsManually(): Promise<{
  success: boolean;
  summary?: Awaited<ReturnType<typeof collectionService.runDailyCollections>>;
  error?: string;
}> {
  if (isRunning) {
    return {
      success: false,
      error: 'Collection run already in progress',
    };
  }

  isRunning = true;

  try {
    const summary = await collectionService.runDailyCollections();
    return { success: true, summary };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  } finally {
    isRunning = false;
  }
}

/**
 * Send summary notification (Slack, email, etc.)
 */
async function sendSummaryNotification(
  summary: Awaited<ReturnType<typeof collectionService.runDailyCollections>>
): Promise<void> {
  // Check if >10% delivery failures
  const totalAttempts = Object.values(summary.byStatus).reduce((a, b) => a + b, 0);
  const failures = summary.byStatus['FAILED'] || 0;
  const failureRate = totalAttempts > 0 ? (failures / totalAttempts) * 100 : 0;

  if (failureRate > 10) {
    logger.warn('[CollectionsCron] High failure rate detected', {
      failureRate: failureRate.toFixed(1) + '%',
      failures,
      total: totalAttempts,
    });

    // Would send Slack alert here
    // await slackService.sendAlert({
    //   channel: '#collections-alerts',
    //   text: `⚠️ High collection failure rate: ${failureRate.toFixed(1)}%`,
    // });
  }

  // Log summary for monitoring
  logger.info('[CollectionsCron] Summary', {
    date: summary.date.toISOString(),
    processed: summary.totalProcessed,
    stages: summary.byStage,
    channels: summary.byChannel,
    statuses: summary.byStatus,
    errorCount: summary.errors.length,
  });
}

/**
 * Send error alert
 */
async function sendErrorAlert(error: Error): Promise<void> {
  logger.error('[CollectionsCron] Critical error', {
    message: error.message,
    stack: error.stack,
  });

  // Would send Slack/PagerDuty alert here
  // await pagerDutyService.trigger({
  //   severity: 'error',
  //   summary: 'Collections cron job failed',
  //   details: error.message,
  // });
}

/**
 * Get cron status
 */
export function getCollectionsCronStatus(): {
  isRunning: boolean;
  schedule: string;
  timezone: string;
  nextRun: Date;
} {
  // Calculate next run time
  const now = new Date();
  const next = new Date(now);
  next.setHours(8, 0, 0, 0);
  if (next <= now) {
    next.setDate(next.getDate() + 1);
  }

  return {
    isRunning,
    schedule: SCHEDULE,
    timezone: TIMEZONE,
    nextRun: next,
  };
}
