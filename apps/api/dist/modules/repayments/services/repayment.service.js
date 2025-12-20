import { PrismaClient } from '@prisma/client';
import { logger } from '../../../infrastructure/logging/logger.js';
const prisma = new PrismaClient();
const LATE_FEE_CONFIG = {
    gracePeriodDays: 0,
    percentagePerWeek: 5,
    maxPercentage: 20,
};
export class RepaymentService {
    async recordPayment(request) {
        const { advanceId, amount, paymentMethod, referenceNumber, paidAt, notes, processedBy } = request;
        logger.info('[Repayment] Recording payment', {
            advanceId,
            amount,
            method: paymentMethod,
        });
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
        const validStatuses = [
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
        const balance = await this.getBalanceBreakdown(advanceId);
        if (amount <= 0) {
            throw new Error('Payment amount must be positive');
        }
        if (amount > balance.totalDue) {
            throw new Error(`Payment amount $${amount} exceeds total due $${balance.totalDue}`);
        }
        const txnCount = await prisma.advanceTransaction.count();
        const transactionNumber = `TXN-${new Date().getFullYear()}-${String(txnCount + 1).padStart(6, '0')}`;
        const transaction = await prisma.advanceTransaction.create({
            data: {
                advanceId,
                transactionNumber,
                type: balance.remainingBalance - amount <= 0 ? 'FINAL_REPAYMENT' : 'PARTIAL_REPAYMENT',
                amount,
                balanceBefore: balance.remainingBalance,
                balanceAfter: balance.remainingBalance - amount,
                description: notes || `Payment via ${paymentMethod}`,
                paymentStatus: 'COMPLETED',
                paymentMethod,
                paymentProvider: paymentMethod === 'STRIPE' ? 'Stripe' : paymentMethod === 'OPENPAY' ? 'OpenPay' : paymentMethod === 'SPEI' ? 'SPEI' : 'Manual',
                paymentReference: referenceNumber || `REF-${Date.now()}`,
                processedAt: paidAt || new Date(),
                metadata: {
                    lateFeesPaid: Math.min(amount, balance.lateFees),
                    principalPaid: Math.max(0, amount - balance.lateFees),
                    processedBy,
                },
            },
        });
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
    async getBalanceBreakdown(advanceId) {
        const advance = await prisma.advanceContract.findUnique({
            where: { id: advanceId },
        });
        if (!advance) {
            throw new Error('Advance not found');
        }
        const today = new Date();
        const dueDate = new Date(advance.dueDate);
        const daysOverdue = Math.max(0, Math.floor((today.getTime() - dueDate.getTime()) / (24 * 60 * 60 * 1000)));
        let lateFees = 0;
        if (daysOverdue > LATE_FEE_CONFIG.gracePeriodDays) {
            const weeksOverdue = Math.ceil(daysOverdue / 7);
            const feePercentage = Math.min(weeksOverdue * LATE_FEE_CONFIG.percentagePerWeek, LATE_FEE_CONFIG.maxPercentage);
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
    async getPaymentSchedule(advanceId) {
        const advance = await prisma.advanceContract.findUnique({
            where: { id: advanceId },
        });
        if (!advance) {
            throw new Error('Advance not found');
        }
        const storedSchedule = advance.repaymentSchedule;
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
    async getPaymentHistory(advanceId) {
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
        const payments = advance.transactions
            .filter((t) => ['PARTIAL_REPAYMENT', 'FINAL_REPAYMENT'].includes(t.type))
            .map((t) => ({
            id: t.id,
            amount: t.amount.toNumber(),
            method: t.paymentMethod,
            reference: t.paymentReference || undefined,
            paidAt: t.processedAt || t.createdAt,
            type: 'PRINCIPAL',
            status: t.paymentStatus,
        }));
        return {
            advanceId,
            contractNumber: advance.contractNumber,
            payments,
            totalPaid: advance.amountRepaid.toNumber(),
            remainingBalance: advance.remainingBalance.toNumber(),
        };
    }
    async extendDueDate(advanceId, newDueDate, reason, extendedBy) {
        const advance = await prisma.advanceContract.findUnique({
            where: { id: advanceId },
        });
        if (!advance) {
            throw new Error('Advance not found');
        }
        if (newDueDate <= advance.dueDate) {
            throw new Error('New due date must be after current due date');
        }
        const extensionDays = Math.floor((newDueDate.getTime() - advance.dueDate.getTime()) / (24 * 60 * 60 * 1000));
        const dailyRate = 0.08 / 365;
        const additionalInterest = advance.remainingBalance.toNumber() * dailyRate * extensionDays;
        await prisma.advanceContract.update({
            where: { id: advanceId },
            data: {
                dueDate: newDueDate,
                implicitInterest: { increment: additionalInterest },
                remainingBalance: { increment: additionalInterest },
                status: 'ACTIVE',
                internalNotes: `Extended by ${extendedBy}: ${reason}. Previous due: ${advance.dueDate.toISOString()}`,
            },
        });
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
    async processPaymentWebhook(provider, event) {
        logger.info('[Repayment] Processing payment webhook', {
            provider,
            eventType: event.type || event.action,
        });
        if (provider === 'stripe') {
            if (event.type === 'payment_intent.succeeded') {
                const paymentIntent = event.data.object;
                const advanceId = paymentIntent.metadata?.advanceId;
                if (advanceId) {
                    await this.recordPayment({
                        advanceId,
                        amount: paymentIntent.amount / 100,
                        paymentMethod: 'STRIPE',
                        referenceNumber: paymentIntent.id,
                        paidAt: new Date(paymentIntent.created * 1000),
                    });
                    return { processed: true, advanceId };
                }
            }
        }
        if (provider === 'mercadopago') {
            if (event.action === 'payment.updated' || event.action === 'payment.created') {
                const paymentId = event.data?.id;
                return { processed: true };
            }
        }
        return { processed: false };
    }
    async getAgingReport() {
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
            }
            else if (dueDate >= day30) {
                overdue1to30 += balance;
            }
            else if (dueDate >= day60) {
                overdue31to60 += balance;
            }
            else if (dueDate >= day90) {
                overdue61to90 += balance;
            }
            else {
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
export const repaymentService = new RepaymentService();
