import { PrismaClient } from '@prisma/client';
import { logger } from '../../../infrastructure/logging/logger.js';
import { whatsAppService } from '../../whatsapp-bot/whatsapp.service.js';
import { getMessage } from '../../whatsapp-bot/templates/messages.js';
const prisma = new PrismaClient();
const COLLECTION_RULES = [
    {
        stage: 'FRIENDLY_REMINDER',
        daysFromDue: -3,
        channels: ['WHATSAPP', 'PUSH'],
        priority: 'NORMAL',
        templateKey: 'reminderFriendly',
        requiresAck: false,
        escalateAfterHours: 0,
        maxAttempts: 1,
    },
    {
        stage: 'FINAL_NOTICE',
        daysFromDue: 0,
        channels: ['WHATSAPP', 'SMS', 'EMAIL'],
        priority: 'HIGH',
        templateKey: 'reminderDueToday',
        requiresAck: false,
        escalateAfterHours: 0,
        maxAttempts: 2,
    },
    {
        stage: 'OVERDUE_1',
        daysFromDue: 1,
        channels: ['WHATSAPP', 'SMS'],
        priority: 'HIGH',
        templateKey: 'reminderOverdue',
        requiresAck: false,
        escalateAfterHours: 24,
        maxAttempts: 2,
    },
    {
        stage: 'OVERDUE_3',
        daysFromDue: 3,
        channels: ['WHATSAPP', 'SMS', 'EMAIL'],
        priority: 'HIGH',
        templateKey: 'reminderOverdue',
        requiresAck: true,
        escalateAfterHours: 48,
        maxAttempts: 2,
    },
    {
        stage: 'LATE_FEE_WARNING',
        daysFromDue: 7,
        channels: ['WHATSAPP', 'SMS', 'EMAIL', 'CALL'],
        priority: 'CRITICAL',
        templateKey: 'reminderOverdue',
        requiresAck: true,
        escalateAfterHours: 24,
        maxAttempts: 3,
    },
    {
        stage: 'ACCOUNT_REVIEW',
        daysFromDue: 14,
        channels: ['WHATSAPP', 'SMS', 'EMAIL', 'CALL'],
        priority: 'CRITICAL',
        templateKey: 'reminderOverdue',
        requiresAck: true,
        escalateAfterHours: 24,
        maxAttempts: 3,
    },
    {
        stage: 'COLLECTIONS_HANDOFF',
        daysFromDue: 30,
        channels: ['EMAIL', 'CALL'],
        priority: 'CRITICAL',
        templateKey: 'collectionsHandoff',
        requiresAck: true,
        escalateAfterHours: 0,
        maxAttempts: 1,
    },
];
const LATE_FEE_CONFIG = {
    percentagePerWeek: 5,
    maxPercentage: 20,
    gracePeriodDays: 0,
};
export class CollectionService {
    async runDailyCollections() {
        const startTime = Date.now();
        const summary = {
            date: new Date(),
            totalProcessed: 0,
            byStage: {},
            byStatus: {},
            byChannel: {},
            errors: [],
        };
        logger.info('[Collections] Starting daily collection run');
        try {
            const targets = await this.getCollectionTargets();
            logger.info('[Collections] Found targets', { count: targets.length });
            for (const target of targets) {
                try {
                    const result = await this.processTarget(target);
                    summary.totalProcessed++;
                    summary.byStage[result.stage] = (summary.byStage[result.stage] || 0) + 1;
                    summary.byStatus[result.status] = (summary.byStatus[result.status] || 0) + 1;
                    summary.byChannel[result.channel] = (summary.byChannel[result.channel] || 0) + 1;
                }
                catch (error) {
                    const msg = `Error processing ${target.contractNumber}: ${error.message}`;
                    summary.errors.push(msg);
                    logger.error('[Collections] Target error:', error);
                }
            }
            await this.applyLateFees();
            await this.updateAdvanceStatuses();
            const duration = Date.now() - startTime;
            logger.info('[Collections] Daily run completed', {
                duration,
                processed: summary.totalProcessed,
                errors: summary.errors.length,
            });
        }
        catch (error) {
            logger.error('[Collections] Fatal error:', error);
            summary.errors.push(error.message);
        }
        return summary;
    }
    async getCollectionTargets() {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const advances = await prisma.advanceContract.findMany({
            where: {
                status: {
                    in: [
                        'DISBURSED',
                        'ACTIVE',
                        'DELIVERY_CONFIRMED',
                        'PARTIALLY_REPAID',
                        'OVERDUE',
                        'DEFAULT_WARNING',
                    ],
                },
                dueDate: {
                    lte: new Date(today.getTime() + 4 * 24 * 60 * 60 * 1000),
                },
            },
            include: {
                farmer: {
                    include: {
                        user: {
                            include: {
                                notificationPreferences: true,
                            },
                        },
                    },
                },
            },
        });
        const targets = [];
        for (const advance of advances) {
            const prefs = advance.farmer.user.notificationPreferences;
            const optedOut = prefs?.whatsappEnabled === false && prefs?.smsEnabled === false;
            const dueDate = new Date(advance.dueDate);
            const daysFromDue = Math.floor((today.getTime() - dueDate.getTime()) / (24 * 60 * 60 * 1000));
            const stage = this.determineStage(daysFromDue);
            const attemptCount = await this.getAttemptCount(advance.id);
            targets.push({
                advanceId: advance.id,
                contractNumber: advance.contractNumber,
                farmerId: advance.farmerId,
                farmerName: advance.farmer.businessName,
                phoneNumber: prefs?.phoneNumber || '',
                email: advance.farmer.user.email,
                amount: advance.remainingBalance.toNumber(),
                dueDate: advance.dueDate,
                daysFromDue,
                currentStage: stage,
                previousAttempts: attemptCount,
                optedOut,
            });
        }
        return targets;
    }
    determineStage(daysFromDue) {
        if (daysFromDue <= -3)
            return 'FRIENDLY_REMINDER';
        if (daysFromDue <= 0)
            return 'FINAL_NOTICE';
        if (daysFromDue <= 1)
            return 'OVERDUE_1';
        if (daysFromDue <= 3)
            return 'OVERDUE_3';
        if (daysFromDue <= 7)
            return 'LATE_FEE_WARNING';
        if (daysFromDue <= 14)
            return 'ACCOUNT_REVIEW';
        if (daysFromDue <= 30)
            return 'COLLECTIONS_HANDOFF';
        return 'LEGAL_WARNING';
    }
    async processTarget(target) {
        const rule = COLLECTION_RULES.find((r) => r.stage === target.currentStage);
        if (!rule) {
            throw new Error(`No rule for stage: ${target.currentStage}`);
        }
        const alreadyAttempted = await this.hasAttemptedToday(target.advanceId, target.currentStage);
        if (alreadyAttempted) {
            return {
                id: '',
                advanceId: target.advanceId,
                stage: target.currentStage,
                channel: 'WHATSAPP',
                status: 'SKIPPED',
                sentAt: new Date(),
                attemptNumber: target.previousAttempts,
            };
        }
        if (target.optedOut) {
            logger.info('[Collections] Skipping opted-out user', {
                contract: target.contractNumber,
            });
            return {
                id: '',
                advanceId: target.advanceId,
                stage: target.currentStage,
                channel: 'WHATSAPP',
                status: 'SKIPPED',
                sentAt: new Date(),
                attemptNumber: target.previousAttempts,
            };
        }
        for (const channel of rule.channels) {
            try {
                const result = await this.sendReminder(target, channel, rule);
                if (result.status === 'SENT' || result.status === 'DELIVERED') {
                    return result;
                }
            }
            catch (error) {
                logger.warn('[Collections] Channel failed', {
                    channel,
                    error: error.message,
                });
            }
        }
        return {
            id: '',
            advanceId: target.advanceId,
            stage: target.currentStage,
            channel: rule.channels[0],
            status: 'FAILED',
            sentAt: new Date(),
            attemptNumber: target.previousAttempts + 1,
            error: 'All channels failed',
        };
    }
    async sendReminder(target, channel, rule) {
        const attempt = {
            id: `col_${Date.now()}_${Math.random().toString(36).slice(2)}`,
            advanceId: target.advanceId,
            stage: target.currentStage,
            channel,
            status: 'PENDING',
            sentAt: new Date(),
            attemptNumber: target.previousAttempts + 1,
        };
        let lateFee = '$0';
        if (target.daysFromDue > 0) {
            const fee = this.calculateLateFee({
                advanceId: target.advanceId,
                originalAmount: target.amount,
                daysOverdue: target.daysFromDue,
                feePercentage: 0,
                feeAmount: 0,
                totalDue: 0,
                cappedAt: LATE_FEE_CONFIG.maxPercentage,
            });
            lateFee = `$${fee.feeAmount.toLocaleString()} MXN`;
        }
        const formatDate = (d) => d.toLocaleDateString('es-MX');
        const formatMoney = (n) => `$${n.toLocaleString()} MXN`;
        switch (channel) {
            case 'WHATSAPP': {
                if (!target.phoneNumber) {
                    throw new Error('No phone number');
                }
                let message;
                if (target.daysFromDue < 0) {
                    message = getMessage('reminderFriendly', 'es', target.farmerName, formatMoney(target.amount), formatDate(target.dueDate), Math.abs(target.daysFromDue));
                }
                else if (target.daysFromDue === 0) {
                    message = getMessage('reminderDueToday', 'es', target.farmerName, formatMoney(target.amount));
                }
                else {
                    message = getMessage('reminderOverdue', 'es', target.farmerName, formatMoney(target.amount), target.daysFromDue, lateFee);
                }
                const messageId = await whatsAppService.sendText(target.phoneNumber, message);
                attempt.messageId = messageId || undefined;
                attempt.status = messageId ? 'SENT' : 'FAILED';
                break;
            }
            case 'SMS': {
                logger.info('[Collections] SMS would be sent', {
                    to: target.phoneNumber,
                    stage: target.currentStage,
                });
                attempt.status = 'SENT';
                break;
            }
            case 'EMAIL': {
                logger.info('[Collections] Email would be sent', {
                    to: target.email,
                    stage: target.currentStage,
                });
                attempt.status = 'SENT';
                break;
            }
            case 'PUSH': {
                logger.info('[Collections] Push would be sent', {
                    userId: target.farmerId,
                    stage: target.currentStage,
                });
                attempt.status = 'SENT';
                break;
            }
            case 'CALL': {
                logger.info('[Collections] Call scheduled', {
                    phone: target.phoneNumber,
                    stage: target.currentStage,
                });
                attempt.status = 'PENDING';
                break;
            }
        }
        await this.logAttempt(attempt);
        return attempt;
    }
    calculateLateFee(input) {
        const weeksOverdue = Math.ceil(input.daysOverdue / 7);
        const uncappedPercentage = weeksOverdue * LATE_FEE_CONFIG.percentagePerWeek;
        const feePercentage = Math.min(uncappedPercentage, LATE_FEE_CONFIG.maxPercentage);
        const feeAmount = input.originalAmount * (feePercentage / 100);
        const totalDue = input.originalAmount + feeAmount;
        return {
            advanceId: input.advanceId,
            originalAmount: input.originalAmount,
            daysOverdue: input.daysOverdue,
            feePercentage,
            feeAmount: Math.round(feeAmount * 100) / 100,
            totalDue: Math.round(totalDue * 100) / 100,
            cappedAt: LATE_FEE_CONFIG.maxPercentage,
        };
    }
    async applyLateFees() {
        const today = new Date();
        const overdueAdvances = await prisma.advanceContract.findMany({
            where: {
                status: { in: ['OVERDUE', 'DEFAULT_WARNING'] },
                dueDate: { lt: today },
            },
        });
        for (const advance of overdueAdvances) {
            const daysOverdue = Math.floor((today.getTime() - advance.dueDate.getTime()) / (24 * 60 * 60 * 1000));
            const fee = this.calculateLateFee({
                advanceId: advance.id,
                originalAmount: advance.remainingBalance.toNumber(),
                daysOverdue,
            });
            logger.debug('[Collections] Late fee calculated', {
                contract: advance.contractNumber,
                daysOverdue,
                feePercentage: fee.feePercentage,
                feeAmount: fee.feeAmount,
            });
        }
    }
    async updateAdvanceStatuses() {
        const today = new Date();
        await prisma.advanceContract.updateMany({
            where: {
                status: { in: ['DISBURSED', 'ACTIVE', 'DELIVERY_CONFIRMED', 'PARTIALLY_REPAID'] },
                dueDate: { lt: today },
            },
            data: {
                status: 'OVERDUE',
            },
        });
        const sevenDaysAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
        await prisma.advanceContract.updateMany({
            where: {
                status: 'OVERDUE',
                dueDate: { lt: sevenDaysAgo },
            },
            data: {
                status: 'DEFAULT_WARNING',
            },
        });
        const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
        await prisma.advanceContract.updateMany({
            where: {
                status: 'DEFAULT_WARNING',
                dueDate: { lt: thirtyDaysAgo },
            },
            data: {
                status: 'DEFAULTED',
            },
        });
        logger.info('[Collections] Advance statuses updated');
    }
    async getAttemptCount(advanceId) {
        return 0;
    }
    async hasAttemptedToday(advanceId, stage) {
        return false;
    }
    async logAttempt(attempt) {
        logger.info('[Collections] Attempt logged', {
            id: attempt.id,
            advance: attempt.advanceId,
            stage: attempt.stage,
            channel: attempt.channel,
            status: attempt.status,
        });
    }
}
export const collectionService = new CollectionService();
