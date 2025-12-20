import { RiskTier, ScoreTrend, SCORE_WEIGHTS, CREDIT_LIMITS, clampScore, getRiskTierFromScore, getScoreTrend, } from '../types/credit-score.types.js';
export class CreditScoreCalculator {
    modelVersion = '1.0.0';
    startTime;
    constructor() {
        this.startTime = Date.now();
    }
    calculate(producerId, deliveryMetrics, qualityMetrics, paymentMetrics, activityMetrics, blockchainMetrics, previousScores) {
        const componentScores = this.calculateComponentScores(deliveryMetrics, qualityMetrics, paymentMetrics, activityMetrics, blockchainMetrics);
        const overallScore = this.calculateWeightedScore(componentScores);
        const riskTier = getRiskTierFromScore(overallScore);
        const creditLimits = this.calculateCreditLimits(riskTier, overallScore, paymentMetrics);
        const scoreChanges = this.calculateScoreChanges(overallScore, previousScores?.score7DaysAgo, previousScores?.score30DaysAgo, previousScores?.score90DaysAgo);
        const trend = getScoreTrend(scoreChanges.last7Days, scoreChanges.last30Days, scoreChanges.last90Days);
        const scoringFactors = this.generateScoringFactors(componentScores, deliveryMetrics, qualityMetrics, paymentMetrics, activityMetrics, blockchainMetrics);
        const recommendations = this.generateRecommendations(componentScores, deliveryMetrics, qualityMetrics, paymentMetrics, blockchainMetrics);
        const confidenceLevel = this.calculateConfidenceLevel(deliveryMetrics, activityMetrics, blockchainMetrics);
        const calculationDurationMs = Date.now() - this.startTime;
        return {
            producerId,
            overallScore,
            riskTier,
            componentScores,
            creditLimits,
            scoreChanges,
            trend,
            metrics: {
                delivery: deliveryMetrics,
                quality: qualityMetrics,
                payment: paymentMetrics,
                activity: activityMetrics,
                blockchain: blockchainMetrics,
            },
            metadata: {
                modelVersion: this.modelVersion,
                calculatedAt: new Date(),
                calculationDurationMs,
                dataSources: ['blockchain', 'orders', 'deliveries', 'payments'],
                confidenceLevel,
            },
            scoringFactors,
            recommendations,
        };
    }
    calculateComponentScores(delivery, quality, payment, activity, blockchain) {
        return {
            delivery: this.calculateDeliveryScore(delivery),
            quality: this.calculateQualityScore(quality),
            payment: this.calculatePaymentScore(payment),
            volume: this.calculateVolumeScore(activity, delivery),
            blockchain: this.calculateBlockchainScore(blockchain),
        };
    }
    calculateDeliveryScore(metrics) {
        if (metrics.totalCompleted === 0) {
            return 50;
        }
        const successScore = (metrics.successRate / 100) * 70;
        const onTimeScore = (metrics.onTimeRate / 100) * 20;
        let delayScore = 10;
        if (metrics.averageDelayDays > 0) {
            delayScore = Math.max(0, 10 - metrics.averageDelayDays * 2);
        }
        const rawScore = successScore + onTimeScore + delayScore;
        return clampScore(rawScore);
    }
    calculateQualityScore(metrics) {
        if (metrics.inspectionCount === 0) {
            return 50;
        }
        const avgScore = (metrics.averageScore / 100) * 60;
        const consistencyScore = Math.max(0, 25 - metrics.standardDeviation * 1.25);
        let trendScore = 7.5;
        if (metrics.trend === ScoreTrend.IMPROVING) {
            trendScore = 15;
        }
        else if (metrics.trend === ScoreTrend.DECLINING) {
            trendScore = 0;
        }
        const rawScore = avgScore + consistencyScore + trendScore;
        return clampScore(rawScore);
    }
    calculatePaymentScore(metrics) {
        if (metrics.advancesCompleted === 0 && metrics.advancesDefaulted === 0) {
            return 60;
        }
        const totalAdvances = metrics.advancesCompleted + metrics.advancesDefaulted;
        const completionRate = totalAdvances > 0 ? (metrics.advancesCompleted / totalAdvances) * 100 : 100;
        const completionScore = (completionRate / 100) * 50;
        let timelinessScore = 30;
        if (metrics.averageRepaymentDelay > 0) {
            timelinessScore = Math.max(0, 30 - metrics.averageRepaymentDelay * 3);
        }
        const noDefaultScore = metrics.defaultRate === 0 ? 20 : Math.max(0, 20 - metrics.defaultRate * 200);
        const rawScore = completionScore + timelinessScore + noDefaultScore;
        return clampScore(rawScore);
    }
    calculateVolumeScore(activity, delivery) {
        const ageScore = Math.min(30, (activity.accountAgeDays / 365) * 30);
        const frequencyScore = Math.min(35, (activity.ordersPerMonth / 4) * 35);
        const volumeScore = Math.min(35, (delivery.totalValueUSD / 100000) * 35);
        const rawScore = ageScore + frequencyScore + volumeScore;
        return clampScore(rawScore);
    }
    calculateBlockchainScore(metrics) {
        if (metrics.totalTransactions === 0) {
            return 50;
        }
        const rateScore = (metrics.verificationRate / 100) * 70;
        const thresholdScore = Math.min(30, (metrics.verifiedTransactions / 10) * 30);
        const rawScore = rateScore + thresholdScore;
        return clampScore(rawScore);
    }
    calculateWeightedScore(components) {
        const weightedSum = components.delivery * (SCORE_WEIGHTS.DELIVERY / 100) +
            components.quality * (SCORE_WEIGHTS.QUALITY / 100) +
            components.payment * (SCORE_WEIGHTS.PAYMENT / 100) +
            components.volume * (SCORE_WEIGHTS.VOLUME / 100) +
            components.blockchain * (SCORE_WEIGHTS.BLOCKCHAIN / 100);
        return clampScore(Math.round(weightedSum * 100) / 100);
    }
    calculateCreditLimits(tier, score, paymentMetrics) {
        const tierLimits = CREDIT_LIMITS[tier];
        let maxAdvanceAmount = tierLimits.maxAdvanceAmount;
        const tierMin = tier === RiskTier.A ? 90 : tier === RiskTier.B ? 70 : 0;
        const tierMax = tier === RiskTier.A ? 100 : tier === RiskTier.B ? 89 : 69;
        const tierRange = tierMax - tierMin;
        const scoreWithinTier = score - tierMin;
        const tierScoreRatio = tierRange > 0 ? scoreWithinTier / tierRange : 1;
        maxAdvanceAmount = maxAdvanceAmount * (0.7 + 0.3 * tierScoreRatio);
        const currentUtilization = paymentMetrics.totalBorrowed - paymentMetrics.totalRepaid;
        const availableCredit = Math.max(0, maxAdvanceAmount - currentUtilization);
        const utilizationRate = maxAdvanceAmount > 0 ? (currentUtilization / maxAdvanceAmount) * 100 : 0;
        return {
            maxAdvancePercentage: tierLimits.maxAdvancePercentage,
            maxAdvanceAmount: Math.round(maxAdvanceAmount * 100) / 100,
            currentUtilization: Math.round(currentUtilization * 100) / 100,
            availableCredit: Math.round(availableCredit * 100) / 100,
            utilizationRate: Math.round(utilizationRate * 100) / 100,
        };
    }
    calculateScoreChanges(currentScore, score7DaysAgo, score30DaysAgo, score90DaysAgo) {
        return {
            last7Days: score7DaysAgo !== undefined ? currentScore - score7DaysAgo : 0,
            last30Days: score30DaysAgo !== undefined ? currentScore - score30DaysAgo : 0,
            last90Days: score90DaysAgo !== undefined ? currentScore - score90DaysAgo : 0,
        };
    }
    generateScoringFactors(components, delivery, quality, payment, activity, blockchain) {
        const factors = [];
        if (delivery.successRate >= 95) {
            factors.push({
                name: 'Excellent Delivery Rate',
                impact: 10,
                category: 'positive',
                description: `${delivery.successRate.toFixed(1)}% delivery success rate`,
                weight: SCORE_WEIGHTS.DELIVERY,
            });
        }
        else if (delivery.successRate < 80) {
            factors.push({
                name: 'Low Delivery Rate',
                impact: -15,
                category: 'negative',
                description: `${delivery.successRate.toFixed(1)}% delivery success rate needs improvement`,
                weight: SCORE_WEIGHTS.DELIVERY,
            });
        }
        if (delivery.onTimeRate >= 90) {
            factors.push({
                name: 'Reliable Timing',
                impact: 5,
                category: 'positive',
                description: `${delivery.onTimeRate.toFixed(1)}% on-time delivery rate`,
                weight: SCORE_WEIGHTS.DELIVERY,
            });
        }
        if (quality.averageScore >= 90) {
            factors.push({
                name: 'Premium Quality',
                impact: 8,
                category: 'positive',
                description: `Average quality score of ${quality.averageScore.toFixed(1)}`,
                weight: SCORE_WEIGHTS.QUALITY,
            });
        }
        else if (quality.averageScore < 70) {
            factors.push({
                name: 'Quality Concerns',
                impact: -10,
                category: 'negative',
                description: `Average quality score of ${quality.averageScore.toFixed(1)} below standards`,
                weight: SCORE_WEIGHTS.QUALITY,
            });
        }
        if (quality.standardDeviation < 5) {
            factors.push({
                name: 'Consistent Quality',
                impact: 5,
                category: 'positive',
                description: 'Low variance in quality scores shows reliability',
                weight: SCORE_WEIGHTS.QUALITY,
            });
        }
        if (payment.advancesCompleted > 0 && payment.defaultRate === 0) {
            factors.push({
                name: 'Perfect Payment Record',
                impact: 15,
                category: 'positive',
                description: `${payment.advancesCompleted} advances completed with zero defaults`,
                weight: SCORE_WEIGHTS.PAYMENT,
            });
        }
        else if (payment.defaultRate > 0.05) {
            factors.push({
                name: 'Default History',
                impact: -20,
                category: 'negative',
                description: `${(payment.defaultRate * 100).toFixed(1)}% default rate on advances`,
                weight: SCORE_WEIGHTS.PAYMENT,
            });
        }
        if (activity.accountAgeDays >= 365) {
            factors.push({
                name: 'Established Producer',
                impact: 5,
                category: 'positive',
                description: `Active for ${Math.floor(activity.accountAgeDays / 365)} year(s)`,
                weight: SCORE_WEIGHTS.VOLUME,
            });
        }
        else if (activity.accountAgeDays < 90) {
            factors.push({
                name: 'New Producer',
                impact: -5,
                category: 'neutral',
                description: 'Limited history available for assessment',
                weight: SCORE_WEIGHTS.VOLUME,
            });
        }
        if (blockchain.verificationRate >= 95) {
            factors.push({
                name: 'Fully Verified',
                impact: 3,
                category: 'positive',
                description: `${blockchain.verificationRate.toFixed(1)}% blockchain verification rate`,
                weight: SCORE_WEIGHTS.BLOCKCHAIN,
            });
        }
        else if (blockchain.verificationRate < 50) {
            factors.push({
                name: 'Low Verification',
                impact: -5,
                category: 'negative',
                description: 'Many transactions lack blockchain verification',
                weight: SCORE_WEIGHTS.BLOCKCHAIN,
            });
        }
        return factors.sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact));
    }
    generateRecommendations(components, delivery, quality, payment, blockchain) {
        const recommendations = [];
        if (components.delivery < 70) {
            recommendations.push({
                id: 'improve-delivery-rate',
                priority: 'high',
                action: 'Focus on completing deliveries successfully to improve your delivery score',
                expectedImpact: 15,
                category: 'delivery',
            });
        }
        if (delivery.onTimeRate < 80) {
            recommendations.push({
                id: 'improve-timing',
                priority: 'medium',
                action: 'Improve delivery timing by better planning and earlier shipments',
                expectedImpact: 8,
                category: 'delivery',
            });
        }
        if (components.quality < 70) {
            recommendations.push({
                id: 'improve-quality',
                priority: 'high',
                action: 'Invest in quality control processes to improve product quality scores',
                expectedImpact: 12,
                category: 'quality',
            });
        }
        if (quality.standardDeviation > 15) {
            recommendations.push({
                id: 'improve-consistency',
                priority: 'medium',
                action: 'Standardize processes to achieve more consistent quality',
                expectedImpact: 5,
                category: 'quality',
            });
        }
        if (payment.averageRepaymentDelay > 3) {
            recommendations.push({
                id: 'faster-repayment',
                priority: 'high',
                action: 'Pay advance repayments on time or early to boost payment score',
                expectedImpact: 10,
                category: 'payment',
            });
        }
        if (blockchain.verificationRate < 80) {
            recommendations.push({
                id: 'increase-verification',
                priority: 'low',
                action: 'Ensure all transactions are recorded on blockchain for verification',
                expectedImpact: 3,
                category: 'blockchain',
            });
        }
        if (components.volume < 50) {
            recommendations.push({
                id: 'increase-activity',
                priority: 'low',
                action: 'Increase order frequency and volume to build track record',
                expectedImpact: 5,
                category: 'volume',
            });
        }
        return recommendations.sort((a, b) => b.expectedImpact - a.expectedImpact).slice(0, 5);
    }
    calculateConfidenceLevel(delivery, activity, blockchain) {
        let confidence = 0;
        const dataVolume = delivery.totalCompleted;
        if (dataVolume >= 50) {
            confidence += 40;
        }
        else if (dataVolume >= 20) {
            confidence += 30;
        }
        else if (dataVolume >= 10) {
            confidence += 20;
        }
        else if (dataVolume >= 5) {
            confidence += 10;
        }
        if (activity.accountAgeDays >= 365) {
            confidence += 30;
        }
        else if (activity.accountAgeDays >= 180) {
            confidence += 20;
        }
        else if (activity.accountAgeDays >= 90) {
            confidence += 15;
        }
        else if (activity.accountAgeDays >= 30) {
            confidence += 5;
        }
        confidence += Math.min(30, (blockchain.verificationRate / 100) * 30);
        return clampScore(confidence);
    }
    simulateScore(currentResult, changes) {
        const newDelivery = { ...currentResult.metrics.delivery };
        const newQuality = { ...currentResult.metrics.quality };
        const newPayment = { ...currentResult.metrics.payment };
        const newBlockchain = { ...currentResult.metrics.blockchain };
        if (changes.additionalSuccessfulDeliveries) {
            newDelivery.totalCompleted += changes.additionalSuccessfulDeliveries;
            newDelivery.successRate =
                (newDelivery.totalCompleted /
                    (newDelivery.totalCompleted + newDelivery.totalDefaulted)) *
                    100;
        }
        if (changes.additionalDefaultedDeliveries) {
            newDelivery.totalDefaulted += changes.additionalDefaultedDeliveries;
            newDelivery.successRate =
                (newDelivery.totalCompleted /
                    (newDelivery.totalCompleted + newDelivery.totalDefaulted)) *
                    100;
        }
        if (changes.qualityImprovement) {
            newQuality.averageScore = Math.min(100, newQuality.averageScore + changes.qualityImprovement);
        }
        if (changes.completedAdvanceRepayments) {
            newPayment.advancesCompleted += changes.completedAdvanceRepayments;
            const totalAdvances = newPayment.advancesCompleted + newPayment.advancesDefaulted;
            newPayment.defaultRate =
                totalAdvances > 0 ? newPayment.advancesDefaulted / totalAdvances : 0;
        }
        if (changes.additionalBlockchainVerifications) {
            newBlockchain.verifiedTransactions += changes.additionalBlockchainVerifications;
            newBlockchain.totalTransactions += changes.additionalBlockchainVerifications;
            newBlockchain.verificationRate =
                (newBlockchain.verifiedTransactions / newBlockchain.totalTransactions) * 100;
        }
        const newComponents = this.calculateComponentScores(newDelivery, newQuality, newPayment, currentResult.metrics.activity, newBlockchain);
        const projectedScore = this.calculateWeightedScore(newComponents);
        const projectedTier = getRiskTierFromScore(projectedScore);
        return {
            currentScore: currentResult.overallScore,
            projectedScore,
            scoreDifference: projectedScore - currentResult.overallScore,
            currentTier: currentResult.riskTier,
            projectedTier,
            tierChange: projectedTier !== currentResult.riskTier,
        };
    }
}
export function createCreditScoreCalculator() {
    return new CreditScoreCalculator();
}
