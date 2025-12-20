import { PrismaClient } from '@prisma/client';
import { logger } from '../../infrastructure/logging/logger.js';
const prisma = new PrismaClient();
const SCORING_WEIGHTS = {
    repaymentHistory: 0.40,
    transactionFrequency: 0.20,
    profileCompleteness: 0.15,
    requestPattern: 0.15,
    externalSignals: 0.10,
};
const APPROVAL_THRESHOLDS = {
    autoApproveHigh: { minScore: 700, maxAmount: 10000 },
    autoApproveLow: { minScore: 500, maxAmount: 5000 },
    manualReview: { minScore: 300 },
    autoReject: { maxScore: 299 },
};
export class SimpleCreditScoringService {
    async calculateScore(userId) {
        logger.info('[CreditScoring] Calculating score', { userId });
        const startTime = Date.now();
        const user = await prisma.user.findUnique({
            where: { id: userId },
            include: {
                producer: {
                    include: {
                        certifications: true,
                        advances: {
                            include: {
                                transactions: true,
                            },
                        },
                        orders: true,
                    },
                },
                notificationPreferences: true,
            },
        });
        if (!user) {
            throw new Error('User not found');
        }
        const producer = user.producer;
        const factors = {
            repaymentHistory: await this.calculateRepaymentHistory(producer?.id),
            transactionFrequency: await this.calculateTransactionFrequency(producer?.id, user.createdAt),
            profileCompleteness: this.calculateProfileCompleteness(user, producer),
            requestPattern: await this.calculateRequestPattern(producer?.id),
            externalSignals: this.calculateExternalSignals(producer),
        };
        const breakdown = {
            repaymentScore: factors.repaymentHistory.rawScore * SCORING_WEIGHTS.repaymentHistory,
            transactionScore: factors.transactionFrequency.rawScore * SCORING_WEIGHTS.transactionFrequency,
            profileScore: factors.profileCompleteness.rawScore * SCORING_WEIGHTS.profileCompleteness,
            patternScore: factors.requestPattern.rawScore * SCORING_WEIGHTS.requestPattern,
            externalScore: factors.externalSignals.rawScore * SCORING_WEIGHTS.externalSignals,
            totalScore: 0,
        };
        breakdown.totalScore = Math.round(breakdown.repaymentScore +
            breakdown.transactionScore +
            breakdown.profileScore +
            breakdown.patternScore +
            breakdown.externalScore);
        const score = breakdown.totalScore;
        const tier = this.determineTier(score);
        const { decision, maxAmount } = this.determineDecision(score);
        const result = {
            userId,
            producerId: producer?.id,
            score,
            tier,
            decision,
            maxApprovedAmount: maxAmount,
            factors,
            breakdown,
            calculatedAt: new Date(),
            validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        };
        await this.storeScore(result);
        const duration = Date.now() - startTime;
        logger.info('[CreditScoring] Score calculated', {
            userId,
            score,
            tier,
            decision,
            duration,
        });
        return result;
    }
    async checkEligibility(userId, requestedAmount) {
        const score = await this.calculateScore(userId);
        if (score.decision === 'AUTO_REJECT') {
            return {
                eligible: false,
                reason: 'Credit score too low',
                requiresReview: false,
            };
        }
        if (requestedAmount > score.maxApprovedAmount) {
            if (score.decision === 'MANUAL_REVIEW') {
                return {
                    eligible: true,
                    reason: 'Amount exceeds auto-approval limit, requires review',
                    maxAmount: score.maxApprovedAmount,
                    requiresReview: true,
                };
            }
            return {
                eligible: false,
                reason: `Maximum approved amount is $${score.maxApprovedAmount.toLocaleString()}`,
                maxAmount: score.maxApprovedAmount,
                requiresReview: false,
            };
        }
        return {
            eligible: true,
            maxAmount: score.maxApprovedAmount,
            requiresReview: score.decision === 'MANUAL_REVIEW',
        };
    }
    async calculateRepaymentHistory(producerId) {
        if (!producerId) {
            return {
                totalAdvances: 0,
                successfulRepayments: 0,
                onTimeRate: 0,
                avgDaysOverdue: 0,
                hasDefaulted: false,
                rawScore: 100,
            };
        }
        const advances = await prisma.advanceContract.findMany({
            where: { farmerId: producerId },
        });
        const total = advances.length;
        const completed = advances.filter((a) => a.status === 'COMPLETED').length;
        const defaulted = advances.filter((a) => ['DEFAULTED', 'IN_COLLECTIONS'].includes(a.status)).length;
        const completedAdvances = advances.filter((a) => a.status === 'COMPLETED');
        const onTimeCount = completedAdvances.filter((a) => {
            const repaidAt = a.repaidAt;
            return repaidAt && repaidAt <= a.dueDate;
        }).length;
        const onTimeRate = completedAdvances.length > 0
            ? (onTimeCount / completedAdvances.length) * 100
            : 100;
        let totalDaysOverdue = 0;
        completedAdvances.forEach((a) => {
            if (a.repaidAt && a.repaidAt > a.dueDate) {
                const daysOver = Math.floor((a.repaidAt.getTime() - a.dueDate.getTime()) / (24 * 60 * 60 * 1000));
                totalDaysOverdue += daysOver;
            }
        });
        const avgDaysOverdue = completedAdvances.length > 0
            ? totalDaysOverdue / completedAdvances.length
            : 0;
        let rawScore = 250;
        if (defaulted > 0)
            rawScore -= 100;
        rawScore -= (100 - onTimeRate) * 1.5;
        rawScore -= avgDaysOverdue * 5;
        if (total >= 3 && defaulted === 0 && onTimeRate >= 90) {
            rawScore += 50;
        }
        rawScore = Math.max(0, Math.min(250, rawScore));
        return {
            totalAdvances: total,
            successfulRepayments: completed,
            onTimeRate: Math.round(onTimeRate * 10) / 10,
            avgDaysOverdue: Math.round(avgDaysOverdue * 10) / 10,
            hasDefaulted: defaulted > 0,
            rawScore: Math.round(rawScore),
        };
    }
    async calculateTransactionFrequency(producerId, accountCreatedAt) {
        if (!producerId) {
            return {
                activeDays90: 0,
                listingsCreated: 0,
                totalSalesVolume: 0,
                accountAgeDays: 0,
                rawScore: 100,
            };
        }
        const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
        const recentOrders = await prisma.order.findMany({
            where: {
                producerId,
                createdAt: { gte: ninetyDaysAgo },
            },
        });
        const listingsCreated = recentOrders.length;
        const totalSalesVolume = recentOrders.reduce((sum, o) => sum + o.totalAmount.toNumber(), 0);
        const uniqueDays = new Set(recentOrders.map((o) => o.createdAt.toISOString().split('T')[0]));
        const activeDays90 = uniqueDays.size;
        const accountAgeDays = accountCreatedAt
            ? Math.floor((Date.now() - accountCreatedAt.getTime()) / (24 * 60 * 60 * 1000))
            : 0;
        let rawScore = 100;
        rawScore += Math.min(50, activeDays90 * 2);
        rawScore += Math.min(50, listingsCreated * 5);
        rawScore += Math.min(30, totalSalesVolume / 10000);
        rawScore += Math.min(20, accountAgeDays / 30);
        rawScore = Math.max(0, Math.min(250, rawScore));
        return {
            activeDays90,
            listingsCreated,
            totalSalesVolume,
            accountAgeDays,
            rawScore: Math.round(rawScore),
        };
    }
    calculateProfileCompleteness(user, producer) {
        const prefs = user.notificationPreferences;
        const phoneVerified = prefs?.phoneVerified || false;
        const locationAdded = !!(producer?.latitude && producer?.longitude);
        const idUploaded = !!producer?.rfc;
        const bankLinked = false;
        const certificationsCount = producer?.certifications?.length || 0;
        let rawScore = 50;
        if (phoneVerified)
            rawScore += 40;
        if (locationAdded)
            rawScore += 30;
        if (idUploaded)
            rawScore += 50;
        if (bankLinked)
            rawScore += 40;
        rawScore += Math.min(40, certificationsCount * 20);
        rawScore = Math.min(250, rawScore);
        return {
            phoneVerified,
            locationAdded,
            idUploaded,
            bankLinked,
            certificationsCount,
            rawScore: Math.round(rawScore),
        };
    }
    async calculateRequestPattern(producerId) {
        if (!producerId) {
            return {
                requestAmountRatio: 1,
                daysSinceLastRequest: 999,
                requestFrequency: 0,
                rawScore: 150,
            };
        }
        const advances = await prisma.advanceContract.findMany({
            where: { farmerId: producerId },
            orderBy: { requestedAt: 'desc' },
            take: 10,
        });
        const orders = await prisma.order.findMany({
            where: { producerId },
        });
        const avgOrderValue = orders.length > 0
            ? orders.reduce((sum, o) => sum + o.totalAmount.toNumber(), 0) / orders.length
            : 10000;
        const lastAdvance = advances[0];
        const daysSinceLastRequest = lastAdvance
            ? Math.floor((Date.now() - lastAdvance.requestedAt.getTime()) / (24 * 60 * 60 * 1000))
            : 999;
        const sixMonthsAgo = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000);
        const recentAdvances = advances.filter((a) => a.requestedAt >= sixMonthsAgo);
        const requestFrequency = recentAdvances.length / 6;
        const lastRequestAmount = lastAdvance?.advanceAmount.toNumber() || 0;
        const requestAmountRatio = avgOrderValue > 0 ? lastRequestAmount / avgOrderValue : 1;
        let rawScore = 150;
        if (requestFrequency > 2)
            rawScore -= 30;
        if (requestAmountRatio > 1.5)
            rawScore -= 50;
        if (requestAmountRatio <= 1 && requestFrequency <= 1)
            rawScore += 50;
        if (daysSinceLastRequest < 14 && advances.length > 0)
            rawScore -= 30;
        rawScore = Math.max(0, Math.min(250, rawScore));
        return {
            requestAmountRatio: Math.round(requestAmountRatio * 100) / 100,
            daysSinceLastRequest,
            requestFrequency: Math.round(requestFrequency * 10) / 10,
            rawScore: Math.round(rawScore),
        };
    }
    calculateExternalSignals(producer) {
        const month = new Date().getMonth();
        const isHarvestSeason = month >= 9 || month <= 1;
        const cropTypes = producer?.cropTypes || [];
        let cropRiskFactor = 0.5;
        if (cropTypes.includes('HASS'))
            cropRiskFactor = 0.3;
        if (cropTypes.includes('BERRIES'))
            cropRiskFactor = 0.4;
        const state = producer?.state || '';
        let regionDefaultRate = 5;
        if (state === 'Michoacán')
            regionDefaultRate = 3;
        if (state === 'Jalisco')
            regionDefaultRate = 4;
        let rawScore = 150;
        if (isHarvestSeason)
            rawScore += 30;
        rawScore += (0.5 - cropRiskFactor) * 100;
        rawScore -= regionDefaultRate * 5;
        rawScore = Math.max(0, Math.min(250, rawScore));
        return {
            isHarvestSeason,
            cropRiskFactor,
            regionDefaultRate,
            rawScore: Math.round(rawScore),
        };
    }
    determineTier(score) {
        if (score >= 800)
            return 'A';
        if (score >= 600)
            return 'B';
        if (score >= 400)
            return 'C';
        return 'D';
    }
    determineDecision(score) {
        if (score >= APPROVAL_THRESHOLDS.autoApproveHigh.minScore) {
            return {
                decision: 'AUTO_APPROVE',
                maxAmount: APPROVAL_THRESHOLDS.autoApproveHigh.maxAmount,
            };
        }
        if (score >= APPROVAL_THRESHOLDS.autoApproveLow.minScore) {
            return {
                decision: 'AUTO_APPROVE',
                maxAmount: APPROVAL_THRESHOLDS.autoApproveLow.maxAmount,
            };
        }
        if (score >= APPROVAL_THRESHOLDS.manualReview.minScore) {
            return {
                decision: 'MANUAL_REVIEW',
                maxAmount: 2500,
            };
        }
        return {
            decision: 'AUTO_REJECT',
            maxAmount: 0,
        };
    }
    async storeScore(result) {
        if (!result.producerId)
            return;
        try {
            const creditScore = await prisma.creditScore.upsert({
                where: { producerId: result.producerId },
                create: {
                    producerId: result.producerId,
                    overallScore: result.score,
                    riskTier: result.tier === 'A' ? 'A' : result.tier === 'B' ? 'B' : 'C',
                    trend: 'STABLE',
                    lastCalculatedAt: result.calculatedAt,
                    deliveryScore: result.breakdown.transactionScore,
                    qualityScore: result.breakdown.profileScore,
                    paymentScore: result.breakdown.repaymentScore,
                    volumeScore: result.breakdown.patternScore,
                    blockchainScore: result.breakdown.externalScore,
                },
                update: {
                    overallScore: result.score,
                    riskTier: result.tier === 'A' ? 'A' : result.tier === 'B' ? 'B' : 'C',
                    lastCalculatedAt: result.calculatedAt,
                    deliveryScore: result.breakdown.transactionScore,
                    qualityScore: result.breakdown.profileScore,
                    paymentScore: result.breakdown.repaymentScore,
                    volumeScore: result.breakdown.patternScore,
                    blockchainScore: result.breakdown.externalScore,
                },
            });
            await prisma.creditScoreHistory.create({
                data: {
                    creditScoreId: creditScore.id,
                    overallScore: result.score,
                    riskTier: result.tier === 'A' ? 'A' : result.tier === 'B' ? 'B' : 'C',
                    deliveryScore: result.breakdown.transactionScore,
                    qualityScore: result.breakdown.profileScore,
                    paymentScore: result.breakdown.repaymentScore,
                    changeAmount: 0,
                    changeReason: 'Recalculated',
                    triggerEvent: 'MANUAL_CALCULATION',
                },
            });
        }
        catch (error) {
            logger.error('[CreditScoring] Failed to store score:', error);
        }
    }
    async getStoredScore(producerId) {
        const score = await prisma.creditScore.findUnique({
            where: { producerId },
        });
        if (!score)
            return null;
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        if (score.lastCalculatedAt < thirtyDaysAgo) {
            return null;
        }
        const overallScore = score.overallScore.toNumber();
        const deliveryScore = score.deliveryScore.toNumber();
        const qualityScore = score.qualityScore.toNumber();
        const paymentScore = score.paymentScore.toNumber();
        const volumeScore = score.volumeScore.toNumber();
        const blockchainScore = score.blockchainScore.toNumber();
        return {
            userId: '',
            producerId,
            score: overallScore,
            tier: score.riskTier,
            decision: this.determineDecision(overallScore).decision,
            maxApprovedAmount: this.determineDecision(overallScore).maxAmount,
            factors: {
                repaymentHistory: {
                    totalAdvances: score.advancesCompleted + score.advancesActive + score.advancesDefaulted,
                    successfulRepayments: score.advancesCompleted,
                    onTimeRate: 100 - score.advanceDefaultRate.toNumber() * 100,
                    avgDaysOverdue: score.averageRepaymentDelay,
                    hasDefaulted: score.advancesDefaulted > 0,
                    rawScore: paymentScore,
                },
                transactionFrequency: {
                    activeDays90: score.daysActive,
                    listingsCreated: score.totalOrdersCompleted,
                    totalSalesVolume: score.totalValueDelivered.toNumber(),
                    accountAgeDays: score.accountAgeDays,
                    rawScore: deliveryScore,
                },
                profileCompleteness: {
                    phoneVerified: true,
                    locationAdded: true,
                    idUploaded: true,
                    bankLinked: false,
                    certificationsCount: 0,
                    rawScore: qualityScore,
                },
                requestPattern: {
                    requestAmountRatio: 1,
                    daysSinceLastRequest: 30,
                    requestFrequency: score.activityFrequency.toNumber(),
                    rawScore: volumeScore,
                },
                externalSignals: {
                    isHarvestSeason: false,
                    cropRiskFactor: 0.5,
                    regionDefaultRate: 5,
                    rawScore: blockchainScore,
                },
            },
            breakdown: {
                repaymentScore: paymentScore,
                transactionScore: deliveryScore,
                profileScore: qualityScore,
                patternScore: volumeScore,
                externalScore: blockchainScore,
                totalScore: overallScore,
            },
            calculatedAt: score.lastCalculatedAt,
            validUntil: new Date(score.lastCalculatedAt.getTime() + 30 * 24 * 60 * 60 * 1000),
        };
    }
}
export const simpleCreditScoringService = new SimpleCreditScoringService();
