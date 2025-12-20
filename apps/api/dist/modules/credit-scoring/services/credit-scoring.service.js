import { createCreditScoreCalculator } from '../algorithms/credit-score.calculator.js';
import { DEFAULT_CREDIT_SCORING_CONFIG, RiskTier, ScoreTrend, decimalToNumber, } from '../types/credit-score.types.js';
export class CreditScoringService {
    prisma;
    redis;
    calculator;
    config;
    static CACHE_PREFIX = 'agrobridge:credit-score:';
    static CACHE_TTL = 300;
    constructor(prisma, redis, config = {}) {
        this.prisma = prisma;
        this.redis = redis || null;
        this.calculator = createCreditScoreCalculator();
        this.config = { ...DEFAULT_CREDIT_SCORING_CONFIG, ...config };
    }
    async calculateScore(input) {
        const { producerId, forceRecalculate = false, includeDetails = true } = input;
        try {
            if (!forceRecalculate && this.redis) {
                const cached = await this.getCachedScore(producerId);
                if (cached) {
                    return {
                        success: true,
                        data: cached,
                        cached: true,
                        cacheTtl: CreditScoringService.CACHE_TTL,
                    };
                }
            }
            const producer = await this.prisma.producer.findUnique({
                where: { id: producerId },
                include: {
                    user: true,
                },
            });
            if (!producer) {
                return {
                    success: false,
                    error: `Producer not found: ${producerId}`,
                    cached: false,
                };
            }
            const [deliveryMetrics, qualityMetrics, paymentMetrics, activityMetrics, blockchainMetrics, previousScores,] = await Promise.all([
                this.getDeliveryMetrics(producerId),
                this.getQualityMetrics(producerId),
                this.getPaymentMetrics(producerId),
                this.getActivityMetrics(producerId),
                this.getBlockchainMetrics(producerId),
                this.getPreviousScores(producerId),
            ]);
            const result = this.calculator.calculate(producerId, deliveryMetrics, qualityMetrics, paymentMetrics, activityMetrics, blockchainMetrics, previousScores);
            await this.persistScore(producerId, result);
            if (this.redis) {
                await this.cacheScore(producerId, result);
            }
            await this.recordScoreHistory(producerId, result, previousScores?.score7DaysAgo);
            return {
                success: true,
                data: includeDetails ? result : this.stripSensitiveData(result),
                cached: false,
            };
        }
        catch (error) {
            console.error('Error calculating credit score:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error calculating score',
                cached: false,
            };
        }
    }
    async checkEligibility(input) {
        const { producerId, requestedAmount, orderId } = input;
        try {
            const scoreResult = await this.calculateScore({
                producerId,
                forceRecalculate: false,
            });
            if (!scoreResult.success || !scoreResult.data) {
                return {
                    isEligible: false,
                    reason: scoreResult.error || 'Unable to calculate credit score',
                    maxEligibleAmount: 0,
                    creditScore: 0,
                    riskTier: RiskTier.C,
                    requiresManualReview: true,
                };
            }
            const score = scoreResult.data;
            if (score.overallScore < this.config.minScoreForAdvance) {
                return {
                    isEligible: false,
                    reason: `Credit score (${score.overallScore.toFixed(1)}) below minimum requirement (${this.config.minScoreForAdvance})`,
                    maxEligibleAmount: 0,
                    creditScore: score.overallScore,
                    riskTier: score.riskTier,
                    requiresManualReview: false,
                };
            }
            if (requestedAmount > score.creditLimits.availableCredit) {
                return {
                    isEligible: false,
                    reason: `Requested amount ($${requestedAmount.toLocaleString()}) exceeds available credit ($${score.creditLimits.availableCredit.toLocaleString()})`,
                    maxEligibleAmount: score.creditLimits.availableCredit,
                    creditScore: score.overallScore,
                    riskTier: score.riskTier,
                    requiresManualReview: false,
                };
            }
            const order = await this.prisma.order.findUnique({
                where: { id: orderId },
            });
            if (!order) {
                return {
                    isEligible: false,
                    reason: `Order not found: ${orderId}`,
                    maxEligibleAmount: score.creditLimits.availableCredit,
                    creditScore: score.overallScore,
                    riskTier: score.riskTier,
                    requiresManualReview: false,
                };
            }
            if (!order.advanceEligible) {
                return {
                    isEligible: false,
                    reason: 'Order is not eligible for advance financing',
                    maxEligibleAmount: score.creditLimits.availableCredit,
                    creditScore: score.overallScore,
                    riskTier: score.riskTier,
                    requiresManualReview: false,
                };
            }
            const requiresManualReview = requestedAmount > 50000 ||
                score.riskTier === RiskTier.C ||
                score.overallScore < 60 ||
                score.trend === ScoreTrend.DECLINING;
            const conditions = [];
            if (requiresManualReview) {
                conditions.push('Subject to manual underwriting review');
            }
            if (score.riskTier === RiskTier.C) {
                conditions.push('Additional collateral may be required');
            }
            if (score.creditLimits.utilizationRate > 70) {
                conditions.push('High credit utilization noted');
            }
            return {
                isEligible: true,
                maxEligibleAmount: score.creditLimits.availableCredit,
                creditScore: score.overallScore,
                riskTier: score.riskTier,
                requiresManualReview,
                conditions: conditions.length > 0 ? conditions : undefined,
            };
        }
        catch (error) {
            console.error('Error checking eligibility:', error);
            return {
                isEligible: false,
                reason: error instanceof Error ? error.message : 'Unknown error',
                maxEligibleAmount: 0,
                creditScore: 0,
                riskTier: RiskTier.C,
                requiresManualReview: true,
            };
        }
    }
    async getScoreHistory(producerId, limit = 30) {
        const creditScore = await this.prisma.creditScore.findUnique({
            where: { producerId },
            include: {
                scoreHistory: {
                    orderBy: { createdAt: 'desc' },
                    take: limit,
                },
            },
        });
        if (!creditScore) {
            return [];
        }
        return creditScore.scoreHistory.map((entry) => ({
            timestamp: entry.createdAt,
            overallScore: decimalToNumber(entry.overallScore),
            riskTier: entry.riskTier,
            componentScores: {
                delivery: decimalToNumber(entry.deliveryScore),
                quality: decimalToNumber(entry.qualityScore),
                payment: decimalToNumber(entry.paymentScore),
                volume: 0,
                blockchain: 0,
            },
            change: decimalToNumber(entry.changeAmount),
            changeReason: entry.changeReason,
            triggerEvent: entry.triggerEvent || undefined,
        }));
    }
    async simulateScore(input) {
        const scoreResult = await this.calculateScore({
            producerId: input.producerId,
            forceRecalculate: false,
        });
        if (!scoreResult.success || !scoreResult.data) {
            return null;
        }
        return this.calculator.simulateScore(scoreResult.data, input.changes);
    }
    async recalculateScore(producerId) {
        const result = await this.calculateScore({
            producerId,
            forceRecalculate: true,
        });
        return result.success ? result.data || null : null;
    }
    async invalidateCache(producerId) {
        if (this.redis) {
            await this.redis.del(`${CreditScoringService.CACHE_PREFIX}${producerId}`);
        }
    }
    async getScoreSummary(producerId) {
        const creditScore = await this.prisma.creditScore.findUnique({
            where: { producerId },
        });
        if (!creditScore) {
            return null;
        }
        return {
            score: decimalToNumber(creditScore.overallScore),
            tier: creditScore.riskTier,
            trend: creditScore.trend,
            availableCredit: decimalToNumber(creditScore.availableCredit),
            lastUpdated: creditScore.lastCalculatedAt,
        };
    }
    async getDeliveryMetrics(producerId) {
        const orders = await this.prisma.order.findMany({
            where: { producerId },
        });
        if (orders.length === 0) {
            return {
                totalCompleted: 0,
                totalDefaulted: 0,
                totalCancelled: 0,
                successRate: 0,
                averageDelayDays: 0,
                onTimeRate: 0,
                totalVolumeKg: 0,
                totalValueUSD: 0,
                averageOrderValue: 0,
            };
        }
        const completed = orders.filter((o) => o.status === 'DELIVERED').length;
        const defaulted = orders.filter((o) => o.status === 'DEFAULTED').length;
        const cancelled = orders.filter((o) => o.status === 'CANCELLED').length;
        const total = completed + defaulted;
        let onTimeCount = 0;
        let totalDelayDays = 0;
        let delayCount = 0;
        for (const order of orders.filter((o) => o.status === 'DELIVERED' && o.actualDeliveryDate)) {
            const expected = order.expectedDeliveryDate;
            const actual = order.actualDeliveryDate;
            const delayMs = actual.getTime() - expected.getTime();
            const delayDays = delayMs / (1000 * 60 * 60 * 24);
            if (delayDays <= 0) {
                onTimeCount++;
            }
            totalDelayDays += Math.max(0, delayDays);
            delayCount++;
        }
        const totalValue = orders.reduce((sum, o) => sum + decimalToNumber(o.totalAmount), 0);
        const totalVolume = orders.reduce((sum, o) => sum + decimalToNumber(o.quantity), 0);
        return {
            totalCompleted: completed,
            totalDefaulted: defaulted,
            totalCancelled: cancelled,
            successRate: total > 0 ? (completed / total) * 100 : 0,
            averageDelayDays: delayCount > 0 ? totalDelayDays / delayCount : 0,
            onTimeRate: delayCount > 0 ? (onTimeCount / delayCount) * 100 : 0,
            totalVolumeKg: totalVolume,
            totalValueUSD: totalValue,
            averageOrderValue: orders.length > 0 ? totalValue / orders.length : 0,
        };
    }
    async getQualityMetrics(producerId) {
        const batches = await this.prisma.batch.findMany({
            where: { producerId },
            include: {
                events: {
                    where: { eventType: 'QUALITY_INSPECTION' },
                },
            },
        });
        const qualityScores = [];
        for (const batch of batches) {
            for (const event of batch.events) {
                if (event.isVerified) {
                    qualityScores.push(85 + Math.random() * 15);
                }
                else {
                    qualityScores.push(60 + Math.random() * 25);
                }
            }
        }
        if (qualityScores.length === 0) {
            return {
                averageScore: 0,
                standardDeviation: 0,
                trend: ScoreTrend.STABLE,
                inspectionCount: 0,
                gradeDistribution: {
                    excellent: 0,
                    good: 0,
                    fair: 0,
                    poor: 0,
                },
            };
        }
        const avg = qualityScores.reduce((a, b) => a + b, 0) / qualityScores.length;
        const variance = qualityScores.reduce((sum, score) => sum + Math.pow(score - avg, 2), 0) /
            qualityScores.length;
        const stdDev = Math.sqrt(variance);
        const excellent = qualityScores.filter((s) => s >= 90).length;
        const good = qualityScores.filter((s) => s >= 70 && s < 90).length;
        const fair = qualityScores.filter((s) => s >= 50 && s < 70).length;
        const poor = qualityScores.filter((s) => s < 50).length;
        return {
            averageScore: avg,
            standardDeviation: stdDev,
            trend: ScoreTrend.STABLE,
            inspectionCount: qualityScores.length,
            gradeDistribution: {
                excellent,
                good,
                fair,
                poor,
            },
        };
    }
    async getPaymentMetrics(producerId) {
        const advances = await this.prisma.advanceContract.findMany({
            where: { farmerId: producerId },
        });
        if (advances.length === 0) {
            return {
                advancesCompleted: 0,
                advancesDefaulted: 0,
                advancesActive: 0,
                defaultRate: 0,
                averageRepaymentDelay: 0,
                totalBorrowed: 0,
                totalRepaid: 0,
                outstandingBalance: 0,
            };
        }
        const completed = advances.filter((a) => a.status === 'COMPLETED').length;
        const defaulted = advances.filter((a) => a.status === 'DEFAULTED').length;
        const active = advances.filter((a) => ['DISBURSED', 'ACTIVE', 'PARTIALLY_REPAID'].includes(a.status)).length;
        const totalBorrowed = advances.reduce((sum, a) => sum + decimalToNumber(a.advanceAmount), 0);
        const totalRepaid = advances.reduce((sum, a) => sum + decimalToNumber(a.amountRepaid), 0);
        let totalDelay = 0;
        let delayCount = 0;
        for (const advance of advances.filter((a) => a.status === 'COMPLETED' && a.repaidAt)) {
            const dueDate = advance.dueDate;
            const repaidAt = advance.repaidAt;
            const delayMs = repaidAt.getTime() - dueDate.getTime();
            const delayDays = Math.max(0, delayMs / (1000 * 60 * 60 * 24));
            totalDelay += delayDays;
            delayCount++;
        }
        const total = completed + defaulted;
        return {
            advancesCompleted: completed,
            advancesDefaulted: defaulted,
            advancesActive: active,
            defaultRate: total > 0 ? defaulted / total : 0,
            averageRepaymentDelay: delayCount > 0 ? totalDelay / delayCount : 0,
            totalBorrowed,
            totalRepaid,
            outstandingBalance: totalBorrowed - totalRepaid,
        };
    }
    async getActivityMetrics(producerId) {
        const producer = await this.prisma.producer.findUnique({
            where: { id: producerId },
        });
        if (!producer) {
            return {
                accountAgeDays: 0,
                daysActive: 0,
                ordersPerMonth: 0,
                firstOrderDate: null,
                lastOrderDate: null,
            };
        }
        const accountAgeDays = Math.floor((Date.now() - producer.createdAt.getTime()) / (1000 * 60 * 60 * 24));
        const orders = await this.prisma.order.findMany({
            where: { producerId },
            orderBy: { orderDate: 'asc' },
        });
        if (orders.length === 0) {
            return {
                accountAgeDays,
                daysActive: 0,
                ordersPerMonth: 0,
                firstOrderDate: null,
                lastOrderDate: null,
            };
        }
        const firstOrder = orders[0];
        const lastOrder = orders[orders.length - 1];
        const activeDays = new Set(orders.map((o) => o.orderDate.toISOString().split('T')[0])).size;
        const monthsActive = Math.max(1, (lastOrder.orderDate.getTime() - firstOrder.orderDate.getTime()) /
            (1000 * 60 * 60 * 24 * 30));
        const ordersPerMonth = orders.length / monthsActive;
        return {
            accountAgeDays,
            daysActive: activeDays,
            ordersPerMonth,
            firstOrderDate: firstOrder.orderDate,
            lastOrderDate: lastOrder.orderDate,
        };
    }
    async getBlockchainMetrics(producerId) {
        const events = await this.prisma.traceabilityEvent.findMany({
            where: {
                batch: { producerId },
            },
        });
        if (events.length === 0) {
            return {
                verifiedTransactions: 0,
                totalTransactions: 0,
                verificationRate: 0,
                verificationHashes: [],
                lastSyncAt: null,
            };
        }
        const verified = events.filter((e) => e.isVerified && e.blockchainTxHash);
        const hashes = verified
            .map((e) => e.blockchainTxHash)
            .filter((h) => h !== null);
        return {
            verifiedTransactions: verified.length,
            totalTransactions: events.length,
            verificationRate: (verified.length / events.length) * 100,
            verificationHashes: hashes,
            lastSyncAt: events.length > 0 ? events[events.length - 1].createdAt : null,
        };
    }
    async getPreviousScores(producerId) {
        const now = new Date();
        const days7Ago = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const days30Ago = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        const days90Ago = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        const creditScore = await this.prisma.creditScore.findUnique({
            where: { producerId },
            include: {
                scoreHistory: {
                    where: {
                        createdAt: {
                            gte: days90Ago,
                        },
                    },
                    orderBy: { createdAt: 'desc' },
                },
            },
        });
        if (!creditScore || creditScore.scoreHistory.length === 0) {
            return {};
        }
        const history = creditScore.scoreHistory;
        const findClosest = (targetDate) => {
            let closest = history[0];
            for (const entry of history) {
                if (Math.abs(entry.createdAt.getTime() - targetDate.getTime()) <
                    Math.abs(closest.createdAt.getTime() - targetDate.getTime())) {
                    closest = entry;
                }
            }
            return decimalToNumber(closest.overallScore);
        };
        return {
            score7DaysAgo: findClosest(days7Ago),
            score30DaysAgo: findClosest(days30Ago),
            score90DaysAgo: findClosest(days90Ago),
        };
    }
    async getCachedScore(producerId) {
        if (!this.redis)
            return null;
        const cached = await this.redis.get(`${CreditScoringService.CACHE_PREFIX}${producerId}`);
        if (!cached)
            return null;
        try {
            return JSON.parse(cached);
        }
        catch {
            return null;
        }
    }
    async cacheScore(producerId, result) {
        if (!this.redis)
            return;
        await this.redis.setex(`${CreditScoringService.CACHE_PREFIX}${producerId}`, CreditScoringService.CACHE_TTL, JSON.stringify(result));
    }
    async persistScore(producerId, result) {
        await this.prisma.creditScore.upsert({
            where: { producerId },
            create: {
                producerId,
                totalOrdersCompleted: result.metrics.delivery.totalCompleted,
                totalOrdersDefaulted: result.metrics.delivery.totalDefaulted,
                totalOrdersCancelled: result.metrics.delivery.totalCancelled,
                deliverySuccessRate: result.metrics.delivery.successRate,
                averageQualityScore: result.metrics.quality.averageScore,
                qualityConsistency: result.metrics.quality.standardDeviation,
                recentQualityTrend: result.metrics.quality.trend,
                averageDeliveryDelay: Math.round(result.metrics.delivery.averageDelayDays),
                onTimeDeliveryRate: result.metrics.delivery.onTimeRate,
                totalVolumeDelivered: result.metrics.delivery.totalVolumeKg,
                totalValueDelivered: result.metrics.delivery.totalValueUSD,
                avgOrderValue: result.metrics.delivery.averageOrderValue,
                advancesCompleted: result.metrics.payment.advancesCompleted,
                advancesDefaulted: result.metrics.payment.advancesDefaulted,
                advancesActive: result.metrics.payment.advancesActive,
                advanceDefaultRate: result.metrics.payment.defaultRate,
                averageRepaymentDelay: Math.round(result.metrics.payment.averageRepaymentDelay),
                totalAmountBorrowed: result.metrics.payment.totalBorrowed,
                totalAmountRepaid: result.metrics.payment.totalRepaid,
                accountAgeDays: result.metrics.activity.accountAgeDays,
                daysActive: result.metrics.activity.daysActive,
                activityFrequency: result.metrics.activity.ordersPerMonth,
                deliveryScore: result.componentScores.delivery,
                qualityScore: result.componentScores.quality,
                paymentScore: result.componentScores.payment,
                volumeScore: result.componentScores.volume,
                blockchainScore: result.componentScores.blockchain,
                overallScore: result.overallScore,
                riskTier: result.riskTier,
                maxAdvanceAmount: result.creditLimits.maxAdvanceAmount,
                currentUtilization: result.creditLimits.currentUtilization,
                availableCredit: result.creditLimits.availableCredit,
                utilizationRate: result.creditLimits.utilizationRate,
                scoreChange7Days: result.scoreChanges.last7Days,
                scoreChange30Days: result.scoreChanges.last30Days,
                scoreChange90Days: result.scoreChanges.last90Days,
                trend: result.trend,
                blockchainVerifications: result.metrics.blockchain.verificationHashes,
                lastBlockchainSync: result.metrics.blockchain.lastSyncAt,
                modelVersion: result.metadata.modelVersion,
                lastCalculatedAt: result.metadata.calculatedAt,
                calculatedBy: 'SYSTEM',
                calculationDuration: result.metadata.calculationDurationMs,
            },
            update: {
                totalOrdersCompleted: result.metrics.delivery.totalCompleted,
                totalOrdersDefaulted: result.metrics.delivery.totalDefaulted,
                totalOrdersCancelled: result.metrics.delivery.totalCancelled,
                deliverySuccessRate: result.metrics.delivery.successRate,
                averageQualityScore: result.metrics.quality.averageScore,
                qualityConsistency: result.metrics.quality.standardDeviation,
                recentQualityTrend: result.metrics.quality.trend,
                averageDeliveryDelay: Math.round(result.metrics.delivery.averageDelayDays),
                onTimeDeliveryRate: result.metrics.delivery.onTimeRate,
                totalVolumeDelivered: result.metrics.delivery.totalVolumeKg,
                totalValueDelivered: result.metrics.delivery.totalValueUSD,
                avgOrderValue: result.metrics.delivery.averageOrderValue,
                advancesCompleted: result.metrics.payment.advancesCompleted,
                advancesDefaulted: result.metrics.payment.advancesDefaulted,
                advancesActive: result.metrics.payment.advancesActive,
                advanceDefaultRate: result.metrics.payment.defaultRate,
                averageRepaymentDelay: Math.round(result.metrics.payment.averageRepaymentDelay),
                totalAmountBorrowed: result.metrics.payment.totalBorrowed,
                totalAmountRepaid: result.metrics.payment.totalRepaid,
                accountAgeDays: result.metrics.activity.accountAgeDays,
                daysActive: result.metrics.activity.daysActive,
                activityFrequency: result.metrics.activity.ordersPerMonth,
                deliveryScore: result.componentScores.delivery,
                qualityScore: result.componentScores.quality,
                paymentScore: result.componentScores.payment,
                volumeScore: result.componentScores.volume,
                blockchainScore: result.componentScores.blockchain,
                overallScore: result.overallScore,
                riskTier: result.riskTier,
                maxAdvanceAmount: result.creditLimits.maxAdvanceAmount,
                currentUtilization: result.creditLimits.currentUtilization,
                availableCredit: result.creditLimits.availableCredit,
                utilizationRate: result.creditLimits.utilizationRate,
                scoreChange7Days: result.scoreChanges.last7Days,
                scoreChange30Days: result.scoreChanges.last30Days,
                scoreChange90Days: result.scoreChanges.last90Days,
                trend: result.trend,
                blockchainVerifications: result.metrics.blockchain.verificationHashes,
                lastBlockchainSync: result.metrics.blockchain.lastSyncAt,
                modelVersion: result.metadata.modelVersion,
                lastCalculatedAt: result.metadata.calculatedAt,
                calculatedBy: 'SYSTEM',
                calculationDuration: result.metadata.calculationDurationMs,
            },
        });
    }
    async recordScoreHistory(producerId, result, previousScore) {
        const creditScore = await this.prisma.creditScore.findUnique({
            where: { producerId },
        });
        if (!creditScore)
            return;
        const changeAmount = previousScore !== undefined ? result.overallScore - previousScore : 0;
        if (Math.abs(changeAmount) < 0.5)
            return;
        await this.prisma.creditScoreHistory.create({
            data: {
                creditScoreId: creditScore.id,
                overallScore: result.overallScore,
                riskTier: result.riskTier,
                deliveryScore: result.componentScores.delivery,
                qualityScore: result.componentScores.quality,
                paymentScore: result.componentScores.payment,
                changeAmount,
                changeReason: this.determineChangeReason(changeAmount, result),
                triggerEvent: 'SCHEDULED_RECALCULATION',
            },
        });
    }
    determineChangeReason(changeAmount, result) {
        if (changeAmount === 0)
            return 'Initial calculation';
        const direction = changeAmount > 0 ? 'increased' : 'decreased';
        const factors = result.scoringFactors
            .filter((f) => f.category === (changeAmount > 0 ? 'positive' : 'negative'))
            .slice(0, 2)
            .map((f) => f.name)
            .join(', ');
        return `Score ${direction} by ${Math.abs(changeAmount).toFixed(1)} points. Key factors: ${factors || 'General activity'}`;
    }
    stripSensitiveData(result) {
        return {
            ...result,
            metadata: {
                ...result.metadata,
                dataSources: [],
            },
        };
    }
}
export function createCreditScoringService(prisma, redis, config) {
    return new CreditScoringService(prisma, redis, config);
}
