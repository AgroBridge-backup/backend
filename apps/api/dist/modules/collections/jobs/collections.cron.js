import cron from 'node-cron';
import { logger } from '../../../infrastructure/logging/logger.js';
import { collectionService } from '../services/collection.service.js';
const TIMEZONE = 'America/Mexico_City';
const SCHEDULE = '0 8 * * *';
let isRunning = false;
export function initCollectionsCron() {
    logger.info('[CollectionsCron] Initializing...', {
        schedule: SCHEDULE,
        timezone: TIMEZONE,
    });
    cron.schedule(SCHEDULE, async () => {
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
            await sendSummaryNotification(summary);
        }
        catch (error) {
            logger.error('[CollectionsCron] Failed:', error);
            await sendErrorAlert(error);
        }
        finally {
            isRunning = false;
        }
    }, {
        timezone: TIMEZONE,
    });
    logger.info('[CollectionsCron] Scheduled successfully');
}
export async function runCollectionsManually() {
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
    }
    catch (error) {
        return { success: false, error: error.message };
    }
    finally {
        isRunning = false;
    }
}
async function sendSummaryNotification(summary) {
    const totalAttempts = Object.values(summary.byStatus).reduce((a, b) => a + b, 0);
    const failures = summary.byStatus['FAILED'] || 0;
    const failureRate = totalAttempts > 0 ? (failures / totalAttempts) * 100 : 0;
    if (failureRate > 10) {
        logger.warn('[CollectionsCron] High failure rate detected', {
            failureRate: failureRate.toFixed(1) + '%',
            failures,
            total: totalAttempts,
        });
    }
    logger.info('[CollectionsCron] Summary', {
        date: summary.date.toISOString(),
        processed: summary.totalProcessed,
        stages: summary.byStage,
        channels: summary.byChannel,
        statuses: summary.byStatus,
        errorCount: summary.errors.length,
    });
}
async function sendErrorAlert(error) {
    logger.error('[CollectionsCron] Critical error', {
        message: error.message,
        stack: error.stack,
    });
}
export function getCollectionsCronStatus() {
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
