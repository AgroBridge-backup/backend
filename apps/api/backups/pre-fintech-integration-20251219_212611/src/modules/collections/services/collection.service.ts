/**
 * Collection Service
 * Automated payment reminder and collections system
 * @module collections/services
 */

import { PrismaClient, AdvanceStatus } from '@prisma/client';
import { logger } from '../../../infrastructure/logging/logger';
import { whatsAppService } from '../../whatsapp-bot/whatsapp.service';
import { getMessage } from '../../whatsapp-bot/templates/messages';
import {
  CollectionRule,
  CollectionStage,
  CollectionTarget,
  CollectionAttempt,
  CollectionSummary,
  LateFeeCalculation,
  CollectionChannel,
} from '../types';

const prisma = new PrismaClient();

// ============================================================================
// COLLECTION RULES CONFIGURATION
// ============================================================================

const COLLECTION_RULES: CollectionRule[] = [
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

// Late fee configuration
const LATE_FEE_CONFIG = {
  percentagePerWeek: 5,      // 5% per week
  maxPercentage: 20,         // Cap at 20%
  gracePeriodDays: 0,        // No grace period
};

// ============================================================================
// MAIN SERVICE CLASS
// ============================================================================

export class CollectionService {
  /**
   * Main entry point - run daily collection cycle
   */
  async runDailyCollections(): Promise<CollectionSummary> {
    const startTime = Date.now();
    const summary: CollectionSummary = {
      date: new Date(),
      totalProcessed: 0,
      byStage: {} as Record<CollectionStage, number>,
      byStatus: {} as Record<string, number>,
      byChannel: {} as Record<CollectionChannel, number>,
      errors: [],
    };

    logger.info('[Collections] Starting daily collection run');

    try {
      // 1. Get all advances that need attention
      const targets = await this.getCollectionTargets();

      logger.info('[Collections] Found targets', { count: targets.length });

      // 2. Process each target
      for (const target of targets) {
        try {
          const result = await this.processTarget(target);
          summary.totalProcessed++;

          // Update summary counters
          summary.byStage[result.stage] = (summary.byStage[result.stage] || 0) + 1;
          summary.byStatus[result.status] = (summary.byStatus[result.status] || 0) + 1;
          summary.byChannel[result.channel] = (summary.byChannel[result.channel] || 0) + 1;

        } catch (error) {
          const msg = `Error processing ${target.contractNumber}: ${(error as Error).message}`;
          summary.errors.push(msg);
          logger.error('[Collections] Target error:', error);
        }
      }

      // 3. Calculate and apply late fees
      await this.applyLateFees();

      // 4. Update advance statuses
      await this.updateAdvanceStatuses();

      const duration = Date.now() - startTime;
      logger.info('[Collections] Daily run completed', {
        duration,
        processed: summary.totalProcessed,
        errors: summary.errors.length,
      });

    } catch (error) {
      logger.error('[Collections] Fatal error:', error);
      summary.errors.push((error as Error).message);
    }

    return summary;
  }

  /**
   * Get all advances that need collection attention
   */
  async getCollectionTargets(): Promise<CollectionTarget[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get advances that are active, overdue, or approaching due date
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
          lte: new Date(today.getTime() + 4 * 24 * 60 * 60 * 1000), // Within 4 days
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

    const targets: CollectionTarget[] = [];

    for (const advance of advances) {
      // Check opt-out
      const prefs = advance.farmer.user.notificationPreferences;
      const optedOut = prefs?.whatsappEnabled === false && prefs?.smsEnabled === false;

      // Calculate days from due
      const dueDate = new Date(advance.dueDate);
      const daysFromDue = Math.floor((today.getTime() - dueDate.getTime()) / (24 * 60 * 60 * 1000));

      // Determine current stage
      const stage = this.determineStage(daysFromDue);

      // Get previous attempts for this advance
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

  /**
   * Determine collection stage based on days from due
   */
  private determineStage(daysFromDue: number): CollectionStage {
    if (daysFromDue <= -3) return 'FRIENDLY_REMINDER';
    if (daysFromDue <= 0) return 'FINAL_NOTICE';
    if (daysFromDue <= 1) return 'OVERDUE_1';
    if (daysFromDue <= 3) return 'OVERDUE_3';
    if (daysFromDue <= 7) return 'LATE_FEE_WARNING';
    if (daysFromDue <= 14) return 'ACCOUNT_REVIEW';
    if (daysFromDue <= 30) return 'COLLECTIONS_HANDOFF';
    return 'LEGAL_WARNING';
  }

  /**
   * Process a single collection target
   */
  private async processTarget(target: CollectionTarget): Promise<CollectionAttempt> {
    const rule = COLLECTION_RULES.find((r) => r.stage === target.currentStage);

    if (!rule) {
      throw new Error(`No rule for stage: ${target.currentStage}`);
    }

    // Check if already attempted today
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

    // Check opt-out
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

    // Try each channel in order
    for (const channel of rule.channels) {
      try {
        const result = await this.sendReminder(target, channel, rule);

        if (result.status === 'SENT' || result.status === 'DELIVERED') {
          return result;
        }
      } catch (error) {
        logger.warn('[Collections] Channel failed', {
          channel,
          error: (error as Error).message,
        });
      }
    }

    // All channels failed
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

  /**
   * Send reminder via specific channel
   */
  private async sendReminder(
    target: CollectionTarget,
    channel: CollectionChannel,
    rule: CollectionRule
  ): Promise<CollectionAttempt> {
    const attempt: CollectionAttempt = {
      id: `col_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      advanceId: target.advanceId,
      stage: target.currentStage,
      channel,
      status: 'PENDING',
      sentAt: new Date(),
      attemptNumber: target.previousAttempts + 1,
    };

    // Calculate late fee if overdue
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

    const formatDate = (d: Date) => d.toLocaleDateString('es-MX');
    const formatMoney = (n: number) => `$${n.toLocaleString()} MXN`;

    switch (channel) {
      case 'WHATSAPP': {
        if (!target.phoneNumber) {
          throw new Error('No phone number');
        }

        let message: string;
        if (target.daysFromDue < 0) {
          message = getMessage('reminderFriendly', 'es',
            target.farmerName,
            formatMoney(target.amount),
            formatDate(target.dueDate),
            Math.abs(target.daysFromDue)
          );
        } else if (target.daysFromDue === 0) {
          message = getMessage('reminderDueToday', 'es',
            target.farmerName,
            formatMoney(target.amount)
          );
        } else {
          message = getMessage('reminderOverdue', 'es',
            target.farmerName,
            formatMoney(target.amount),
            target.daysFromDue,
            lateFee
          );
        }

        const messageId = await whatsAppService.sendText(target.phoneNumber, message);

        attempt.messageId = messageId || undefined;
        attempt.status = messageId ? 'SENT' : 'FAILED';
        break;
      }

      case 'SMS': {
        // Twilio SMS integration would go here
        logger.info('[Collections] SMS would be sent', {
          to: target.phoneNumber,
          stage: target.currentStage,
        });
        attempt.status = 'SENT'; // Mock for now
        break;
      }

      case 'EMAIL': {
        // SendGrid email integration would go here
        logger.info('[Collections] Email would be sent', {
          to: target.email,
          stage: target.currentStage,
        });
        attempt.status = 'SENT'; // Mock for now
        break;
      }

      case 'PUSH': {
        // Firebase push notification would go here
        logger.info('[Collections] Push would be sent', {
          userId: target.farmerId,
          stage: target.currentStage,
        });
        attempt.status = 'SENT'; // Mock for now
        break;
      }

      case 'CALL': {
        // Twilio call or human agent trigger
        logger.info('[Collections] Call scheduled', {
          phone: target.phoneNumber,
          stage: target.currentStage,
        });
        attempt.status = 'PENDING'; // Requires human action
        break;
      }
    }

    // Log attempt to database
    await this.logAttempt(attempt);

    return attempt;
  }

  /**
   * Calculate late fee for an advance
   */
  calculateLateFee(input: Partial<LateFeeCalculation> & { advanceId: string; originalAmount: number; daysOverdue: number }): LateFeeCalculation {
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

  /**
   * Apply late fees to overdue advances
   */
  async applyLateFees(): Promise<void> {
    const today = new Date();

    const overdueAdvances = await prisma.advanceContract.findMany({
      where: {
        status: { in: ['OVERDUE', 'DEFAULT_WARNING'] },
        dueDate: { lt: today },
      },
    });

    for (const advance of overdueAdvances) {
      const daysOverdue = Math.floor(
        (today.getTime() - advance.dueDate.getTime()) / (24 * 60 * 60 * 1000)
      );

      const fee = this.calculateLateFee({
        advanceId: advance.id,
        originalAmount: advance.remainingBalance.toNumber(),
        daysOverdue,
      });

      // Log late fee calculation (actual application would depend on business rules)
      logger.debug('[Collections] Late fee calculated', {
        contract: advance.contractNumber,
        daysOverdue,
        feePercentage: fee.feePercentage,
        feeAmount: fee.feeAmount,
      });
    }
  }

  /**
   * Update advance statuses based on overdue days
   */
  async updateAdvanceStatuses(): Promise<void> {
    const today = new Date();

    // Move to OVERDUE if past due
    await prisma.advanceContract.updateMany({
      where: {
        status: { in: ['DISBURSED', 'ACTIVE', 'DELIVERY_CONFIRMED', 'PARTIALLY_REPAID'] },
        dueDate: { lt: today },
      },
      data: {
        status: 'OVERDUE',
      },
    });

    // Move to DEFAULT_WARNING if 7+ days overdue
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

    // Move to DEFAULTED if 30+ days overdue
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

  // ==========================================================================
  // HELPER METHODS
  // ==========================================================================

  private async getAttemptCount(advanceId: string): Promise<number> {
    // Would query collection_attempts table
    // For now, return 0
    return 0;
  }

  private async hasAttemptedToday(advanceId: string, stage: CollectionStage): Promise<boolean> {
    // Would query collection_attempts table
    // For now, return false
    return false;
  }

  private async logAttempt(attempt: CollectionAttempt): Promise<void> {
    // Would insert into collection_attempts table
    logger.info('[Collections] Attempt logged', {
      id: attempt.id,
      advance: attempt.advanceId,
      stage: attempt.stage,
      channel: attempt.channel,
      status: attempt.status,
    });
  }
}

// Export singleton
export const collectionService = new CollectionService();
