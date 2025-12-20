/**
 * Repayment Tracking Service
 * Core payment processing and tracking for advances
 * @module repayments/services
 */

import { PrismaClient, AdvanceStatus, PaymentMethod, PaymentStatus } from '@prisma/client';
import { logger } from '../../../infrastructure/logging/logger';

const prisma = new PrismaClient();

// ============================================================================
// TYPES
// ============================================================================

export interface RepaymentRequest {
  advanceId: string;
  amount: number;
  paymentMethod: PaymentMethod;
  referenceNumber?: string;
  paidAt?: Date;
  notes?: string;
  processedBy?: string;            // Admin user ID for manual entries
}

export interface RepaymentResult {
  success: boolean;
  transactionId?: string;
  previousBalance: number;
  newBalance: number;
  isFullyPaid: boolean;
  lateFees?: number;
  message: string;
}

export interface BalanceBreakdown {
  advanceId: string;
  contractNumber: string;
  principal: number;
  accruedInterest: number;
  lateFees: number;
  totalDue: number;
  amountPaid: number;
  remainingBalance: number;
  dueDate: Date;
  daysOverdue: number;
  status: AdvanceStatus;
}

export interface PaymentSchedule {
  advanceId: string;
  contractNumber: string;
  installments: Installment[];
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
}

export interface Installment {
  number: number;
  dueDate: Date;
  amount: number;
  principal: number;
  interest: number;
  status: 'PENDING' | 'PAID' | 'PARTIAL' | 'OVERDUE';
  paidAmount: number;
  paidAt?: Date;
}

export interface PaymentHistory {
  advanceId: string;
  contractNumber: string;
  payments: PaymentRecord[];
  totalPaid: number;
  remainingBalance: number;
}

export interface PaymentRecord {
  id: string;
  amount: number;
  method: PaymentMethod;
  reference?: string;
  paidAt: Date;
  type: 'PRINCIPAL' | 'INTEREST' | 'LATE_FEE' | 'REFUND';
  status: PaymentStatus;
}

// Late fee configuration
const LATE_FEE_CONFIG = {
  gracePeriodDays: 0,
  percentagePerWeek: 5,
  maxPercentage: 20,
};

// ============================================================================
// MAIN SERVICE CLASS
// ============================================================================

export class RepaymentService {
  /**
   * Record a payment for an advance
   */
  async recordPayment(request: RepaymentRequest): Promise<RepaymentResult> {
    const { advanceId, amount, paymentMethod, referenceNumber, paidAt, notes, processedBy } = request;

    logger.info('[Repayment] Recording payment', {
      advanceId,
      amount,
      method: paymentMethod,
    });

    // Get advance
    const advance = await prisma.advanceContract.findUnique({
      where: { id: advanceId },
      include: {
        transactions: true,
        pool: true,
      },
    });

    if (!advance) {
      throw new Error('Advance not found');
    }

    // Validate status
    const validStatuses: AdvanceStatus[] = [
      'DISBURSED',
      'ACTIVE',
      'DELIVERY_CONFIRMED',
      'PARTIALLY_REPAID',
      'OVERDUE',
      'DEFAULT_WARNING',
    ];

    if (!validStatuses.includes(advance.status)) {
      throw new Error(`Cannot record payment for advance in status: ${advance.status}`);
    }

    // Calculate current balance with late fees
    const balance = await this.getBalanceBreakdown(advanceId);

    if (amount <= 0) {
      throw new Error('Payment amount must be positive');
    }

    if (amount > balance.totalDue) {
      throw new Error(`Payment amount $${amount} exceeds total due $${balance.totalDue}`);
    }

    // Create transaction
    const transaction = await prisma.advanceTransaction.create({
      data: {
        advanceId,
        type: balance.remainingBalance - amount <= 0 ? 'FINAL_REPAYMENT' : 'PARTIAL_REPAYMENT',
        amount,
        balanceBefore: balance.remainingBalance,
        balanceAfter: balance.remainingBalance - amount,
        description: notes || `Payment via ${paymentMethod}`,
        status: 'COMPLETED',
        paymentMethod,
        paymentReference: referenceNumber,
        processedAt: paidAt || new Date(),
        processedBy,
        metadata: {
          lateFeesPaid: Math.min(amount, balance.lateFees),
          principalPaid: Math.max(0, amount - balance.lateFees),
        },
      },
    });

    // Update advance
    const newBalance = balance.remainingBalance - amount;
    const isFullyPaid = newBalance <= 0;

    await prisma.advanceContract.update({
      where: { id: advanceId },
      data: {
        amountRepaid: { increment: amount },
        remainingBalance: Math.max(0, newBalance),
        status: isFullyPaid ? 'COMPLETED' : 'PARTIALLY_REPAID',
        repaidAt: isFullyPaid ? new Date() : undefined,
        repaymentMethod: paymentMethod,
        repaymentReference: referenceNumber,
      },
    });

    // Update liquidity pool
    if (advance.poolId) {
      await prisma.liquidityPool.update({
        where: { id: advance.poolId },
        data: {
          availableCapital: { increment: amount },
          deployedCapital: { decrement: isFullyPaid ? advance.advanceAmount.toNumber() : amount },
          totalRepaid: { increment: amount },
          totalAdvancesCompleted: isFullyPaid ? { increment: 1 } : undefined,
          totalAdvancesActive: isFullyPaid ? { decrement: 1 } : undefined,
        },
      });

      // Create pool transaction
      await prisma.poolTransaction.create({
        data: {
          poolId: advance.poolId,
          type: 'ADVANCE_REPAYMENT',
          amount,
          balanceBefore: advance.pool.availableCapital.toNumber(),
          balanceAfter: advance.pool.availableCapital.toNumber() + amount,
          description: `Repayment for ${advance.contractNumber}`,
          relatedAdvanceId: advanceId,
        },
      });
    }

    // Add status history
    if (isFullyPaid) {
      await prisma.advanceStatusHistory.create({
        data: {
          advanceId,
          fromStatus: advance.status,
          toStatus: 'COMPLETED',
          reason: 'Full payment received',
          changedBy: processedBy,
        },
      });
    }

    logger.info('[Repayment] Payment recorded successfully', {
      advanceId,
      transactionId: transaction.id,
      previousBalance: balance.remainingBalance,
      newBalance,
      isFullyPaid,
    });

    return {
      success: true,
      transactionId: transaction.id,
      previousBalance: balance.remainingBalance,
      newBalance: Math.max(0, newBalance),
      isFullyPaid,
      lateFees: balance.lateFees,
      message: isFullyPaid
        ? 'Advance fully paid! Thank you.'
        : `Payment of $${amount} recorded. Remaining balance: $${newBalance.toFixed(2)}`,
    };
  }

  /**
   * Get detailed balance breakdown for an advance
   */
  async getBalanceBreakdown(advanceId: string): Promise<BalanceBreakdown> {
    const advance = await prisma.advanceContract.findUnique({
      where: { id: advanceId },
    });

    if (!advance) {
      throw new Error('Advance not found');
    }

    const today = new Date();
    const dueDate = new Date(advance.dueDate);
    const daysOverdue = Math.max(0, Math.floor((today.getTime() - dueDate.getTime()) / (24 * 60 * 60 * 1000)));

    // Calculate late fees
    let lateFees = 0;
    if (daysOverdue > LATE_FEE_CONFIG.gracePeriodDays) {
      const weeksOverdue = Math.ceil(daysOverdue / 7);
      const feePercentage = Math.min(
        weeksOverdue * LATE_FEE_CONFIG.percentagePerWeek,
        LATE_FEE_CONFIG.maxPercentage
      );
      lateFees = advance.remainingBalance.toNumber() * (feePercentage / 100);
    }

    const principal = advance.advanceAmount.toNumber();
    const accruedInterest = advance.implicitInterest.toNumber();
    const amountPaid = advance.amountRepaid.toNumber();
    const remainingBalance = advance.remainingBalance.toNumber();
    const totalDue = remainingBalance + lateFees;

    return {
      advanceId,
      contractNumber: advance.contractNumber,
      principal,
      accruedInterest,
      lateFees: Math.round(lateFees * 100) / 100,
      totalDue: Math.round(totalDue * 100) / 100,
      amountPaid,
      remainingBalance,
      dueDate: advance.dueDate,
      daysOverdue,
      status: advance.status,
    };
  }

  /**
   * Get payment schedule for an advance (if installment plan)
   */
  async getPaymentSchedule(advanceId: string): Promise<PaymentSchedule> {
    const advance = await prisma.advanceContract.findUnique({
      where: { id: advanceId },
    });

    if (!advance) {
      throw new Error('Advance not found');
    }

    // Check if there's a stored schedule
    const storedSchedule = advance.repaymentSchedule as Installment[] | null;

    if (storedSchedule && storedSchedule.length > 0) {
      return {
        advanceId,
        contractNumber: advance.contractNumber,
        installments: storedSchedule,
        totalAmount: advance.advanceAmount.toNumber() + advance.implicitInterest.toNumber(),
        paidAmount: advance.amountRepaid.toNumber(),
        remainingAmount: advance.remainingBalance.toNumber(),
      };
    }

    // Generate single payment schedule (default)
    const totalAmount = advance.advanceAmount.toNumber() + advance.implicitInterest.toNumber();

    return {
      advanceId,
      contractNumber: advance.contractNumber,
      installments: [
        {
          number: 1,
          dueDate: advance.dueDate,
          amount: totalAmount,
          principal: advance.advanceAmount.toNumber(),
          interest: advance.implicitInterest.toNumber(),
          status: advance.status === 'COMPLETED' ? 'PAID' : advance.amountRepaid.toNumber() > 0 ? 'PARTIAL' : new Date() > advance.dueDate ? 'OVERDUE' : 'PENDING',
          paidAmount: advance.amountRepaid.toNumber(),
          paidAt: advance.repaidAt || undefined,
        },
      ],
      totalAmount,
      paidAmount: advance.amountRepaid.toNumber(),
      remainingAmount: advance.remainingBalance.toNumber(),
    };
  }

  /**
   * Get payment history for an advance
   */
  async getPaymentHistory(advanceId: string): Promise<PaymentHistory> {
    const advance = await prisma.advanceContract.findUnique({
      where: { id: advanceId },
      include: {
        transactions: {
          orderBy: { processedAt: 'desc' },
        },
      },
    });

    if (!advance) {
      throw new Error('Advance not found');
    }

    const payments: PaymentRecord[] = advance.transactions
      .filter((t) => ['PARTIAL_REPAYMENT', 'FINAL_REPAYMENT'].includes(t.type))
      .map((t) => ({
        id: t.id,
        amount: t.amount.toNumber(),
        method: t.paymentMethod as PaymentMethod,
        reference: t.paymentReference || undefined,
        paidAt: t.processedAt || t.createdAt,
        type: 'PRINCIPAL' as const,
        status: t.status as PaymentStatus,
      }));

    return {
      advanceId,
      contractNumber: advance.contractNumber,
      payments,
      totalPaid: advance.amountRepaid.toNumber(),
      remainingBalance: advance.remainingBalance.toNumber(),
    };
  }

  /**
   * Extend due date (admin action)
   */
  async extendDueDate(
    advanceId: string,
    newDueDate: Date,
    reason: string,
    extendedBy: string
  ): Promise<{ success: boolean; message: string }> {
    const advance = await prisma.advanceContract.findUnique({
      where: { id: advanceId },
    });

    if (!advance) {
      throw new Error('Advance not found');
    }

    if (newDueDate <= advance.dueDate) {
      throw new Error('New due date must be after current due date');
    }

    // Calculate additional interest for extension
    const extensionDays = Math.floor(
      (newDueDate.getTime() - advance.dueDate.getTime()) / (24 * 60 * 60 * 1000)
    );
    const dailyRate = 0.08 / 365; // 8% annual
    const additionalInterest = advance.remainingBalance.toNumber() * dailyRate * extensionDays;

    await prisma.advanceContract.update({
      where: { id: advanceId },
      data: {
        dueDate: newDueDate,
        implicitInterest: { increment: additionalInterest },
        remainingBalance: { increment: additionalInterest },
        status: 'ACTIVE', // Remove overdue status
        internalNotes: `Extended by ${extendedBy}: ${reason}. Previous due: ${advance.dueDate.toISOString()}`,
      },
    });

    // Log status change
    await prisma.advanceStatusHistory.create({
      data: {
        advanceId,
        fromStatus: advance.status,
        toStatus: 'ACTIVE',
        reason: `Due date extended: ${reason}`,
        changedBy: extendedBy,
      },
    });

    logger.info('[Repayment] Due date extended', {
      advanceId,
      oldDueDate: advance.dueDate,
      newDueDate,
      extensionDays,
      additionalInterest,
      extendedBy,
    });

    return {
      success: true,
      message: `Due date extended by ${extensionDays} days. Additional interest: $${additionalInterest.toFixed(2)}`,
    };
  }

  /**
   * Process webhook from payment provider (Stripe, MercadoPago)
   */
  async processPaymentWebhook(
    provider: 'stripe' | 'mercadopago',
    event: any
  ): Promise<{ processed: boolean; advanceId?: string }> {
    logger.info('[Repayment] Processing payment webhook', {
      provider,
      eventType: event.type || event.action,
    });

    // Handle Stripe webhook
    if (provider === 'stripe') {
      if (event.type === 'payment_intent.succeeded') {
        const paymentIntent = event.data.object;
        const advanceId = paymentIntent.metadata?.advanceId;

        if (advanceId) {
          await this.recordPayment({
            advanceId,
            amount: paymentIntent.amount / 100, // Cents to dollars
            paymentMethod: 'STRIPE',
            referenceNumber: paymentIntent.id,
            paidAt: new Date(paymentIntent.created * 1000),
          });

          return { processed: true, advanceId };
        }
      }
    }

    // Handle MercadoPago webhook
    if (provider === 'mercadopago') {
      if (event.action === 'payment.updated' || event.action === 'payment.created') {
        const paymentId = event.data?.id;
        // Would fetch payment details from MercadoPago API
        // Then call recordPayment

        return { processed: true };
      }
    }

    return { processed: false };
  }

  /**
   * Generate aging report for admin
   */
  async getAgingReport(): Promise<{
    current: number;
    overdue1to30: number;
    overdue31to60: number;
    overdue61to90: number;
    overdue90plus: number;
    totalOutstanding: number;
    advanceCount: number;
  }> {
    const today = new Date();
    const day30 = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
    const day60 = new Date(today.getTime() - 60 * 24 * 60 * 60 * 1000);
    const day90 = new Date(today.getTime() - 90 * 24 * 60 * 60 * 1000);

    const advances = await prisma.advanceContract.findMany({
      where: {
        status: {
          in: ['DISBURSED', 'ACTIVE', 'PARTIALLY_REPAID', 'OVERDUE', 'DEFAULT_WARNING'],
        },
      },
    });

    let current = 0;
    let overdue1to30 = 0;
    let overdue31to60 = 0;
    let overdue61to90 = 0;
    let overdue90plus = 0;

    for (const advance of advances) {
      const balance = advance.remainingBalance.toNumber();
      const dueDate = advance.dueDate;

      if (dueDate >= today) {
        current += balance;
      } else if (dueDate >= day30) {
        overdue1to30 += balance;
      } else if (dueDate >= day60) {
        overdue31to60 += balance;
      } else if (dueDate >= day90) {
        overdue61to90 += balance;
      } else {
        overdue90plus += balance;
      }
    }

    return {
      current: Math.round(current * 100) / 100,
      overdue1to30: Math.round(overdue1to30 * 100) / 100,
      overdue31to60: Math.round(overdue31to60 * 100) / 100,
      overdue61to90: Math.round(overdue61to90 * 100) / 100,
      overdue90plus: Math.round(overdue90plus * 100) / 100,
      totalOutstanding: Math.round((current + overdue1to30 + overdue31to60 + overdue61to90 + overdue90plus) * 100) / 100,
      advanceCount: advances.length,
    };
  }
}

// Export singleton
export const repaymentService = new RepaymentService();
