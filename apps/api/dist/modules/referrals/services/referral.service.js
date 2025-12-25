import { PrismaClient, ReferralStatus, ReferralRewardType } from '@prisma/client';
import { ethers } from 'ethers';
import { logger } from '../../../infrastructure/logging/logger.js';
import { blockchainNotificationService } from '../../whatsapp-bot/services/blockchain-notification.service.js';
const prisma = new PrismaClient();
const config = {
    blockchain: {
        enabled: process.env.BLOCKCHAIN_ENABLED === 'true',
        rpcUrl: process.env.BLOCKCHAIN_RPC_URL || 'https://polygon-rpc.com',
        contractAddress: process.env.REFERRAL_CONTRACT_ADDRESS || '',
        privateKey: process.env.BLOCKCHAIN_PRIVATE_KEY || '',
        network: 'polygon',
    },
    rewards: {
        referrerDays: 30,
        referredDays: 30,
        activationDays: 30,
        minBatchesForActive: 5,
    },
    codeLength: 8,
    codePrefix: 'AB',
};
export class ReferralService {
    provider = null;
    wallet = null;
    constructor() {
        if (config.blockchain.enabled && config.blockchain.privateKey) {
            this.initializeBlockchain();
        }
    }
    async initializeBlockchain() {
        try {
            this.provider = new ethers.providers.JsonRpcProvider(config.blockchain.rpcUrl);
            this.wallet = new ethers.Wallet(config.blockchain.privateKey, this.provider);
            logger.info('Referral blockchain service initialized');
        }
        catch (error) {
            logger.error('Failed to initialize blockchain for referrals', { error });
        }
    }
    async getOrCreateReferralCode(userId) {
        let userCode = await prisma.userReferralCode.findUnique({
            where: { userId },
        });
        if (userCode) {
            return userCode.code;
        }
        const code = await this.generateUniqueCode();
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { walletAddress: true },
        });
        userCode = await prisma.userReferralCode.create({
            data: {
                userId,
                code,
                walletAddress: user?.walletAddress,
            },
        });
        logger.info('Referral code created', { userId, code });
        return userCode.code;
    }
    async generateUniqueCode() {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let attempts = 0;
        const maxAttempts = 10;
        while (attempts < maxAttempts) {
            let code = config.codePrefix;
            for (let i = 0; i < config.codeLength; i++) {
                code += chars[Math.floor(Math.random() * chars.length)];
            }
            const exists = await prisma.userReferralCode.findUnique({
                where: { code },
            });
            if (!exists) {
                return code;
            }
            attempts++;
        }
        return `${config.codePrefix}${Date.now().toString(36).toUpperCase()}`;
    }
    async applyReferralCode(newUserId, code, ipAddress, deviceFingerprint) {
        try {
            const referrerCode = await prisma.userReferralCode.findUnique({
                where: { code: code.toUpperCase() },
            });
            if (!referrerCode) {
                return { success: false, error: 'Código de referido inválido' };
            }
            const existingReferral = await prisma.referral.findFirst({
                where: { referredId: newUserId },
            });
            if (existingReferral) {
                return { success: false, error: 'Ya tienes un código de referido aplicado' };
            }
            if (referrerCode.userId === newUserId) {
                return { success: false, error: 'No puedes usar tu propio código' };
            }
            const now = new Date();
            const monthYear = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
            const referral = await prisma.referral.create({
                data: {
                    referrerId: referrerCode.userId,
                    referredId: newUserId,
                    referralCode: code.toUpperCase(),
                    status: ReferralStatus.REGISTERED,
                    rewardType: ReferralRewardType.PREMIUM_DAYS,
                    rewardValue: config.rewards.referredDays,
                    monthYear,
                    ipAddress,
                    deviceFingerprint,
                    registeredAt: new Date(),
                },
            });
            await prisma.userReferralCode.update({
                where: { code: code.toUpperCase() },
                data: {
                    totalReferrals: { increment: 1 },
                },
            });
            let blockchainTx = null;
            if (config.blockchain.enabled && this.wallet) {
                blockchainTx = await this.registerReferralOnBlockchain(referrerCode.userId, newUserId, code.toUpperCase());
                if (blockchainTx) {
                    await prisma.referral.update({
                        where: { id: referral.id },
                        data: {
                            blockchainTxHash: blockchainTx.txHash,
                            blockchainEventId: blockchainTx.referralId,
                            blockchainVerified: true,
                            blockchainNetwork: config.blockchain.network,
                        },
                    });
                }
            }
            await this.grantPremiumDays(newUserId, config.rewards.referredDays);
            await this.grantPremiumDays(referrerCode.userId, config.rewards.referrerDays);
            await this.notifyReferrer(referral.id);
            logger.info('Referral applied successfully', {
                referralId: referral.id,
                referrerId: referrerCode.userId,
                referredId: newUserId,
                blockchainVerified: !!blockchainTx,
            });
            return {
                success: true,
                referralId: referral.id,
                reward: {
                    type: ReferralRewardType.PREMIUM_DAYS,
                    value: config.rewards.referredDays,
                    description: `${config.rewards.referredDays} días de premium gratis`,
                },
            };
        }
        catch (error) {
            logger.error('Failed to apply referral code', { error, newUserId, code });
            return {
                success: false,
                error: 'Error al aplicar el código de referido',
            };
        }
    }
    async recordActivity(userId, activityType) {
        const referral = await prisma.referral.findFirst({
            where: {
                referredId: userId,
                status: { in: [ReferralStatus.REGISTERED, ReferralStatus.ACTIVE] },
            },
        });
        if (!referral)
            return;
        const activityPoints = {
            LOGIN: 5,
            BATCH_CREATED: 20,
            ORDER_COMPLETED: 50,
        };
        const points = activityPoints[activityType] || 0;
        await prisma.referral.update({
            where: { id: referral.id },
            data: {
                activityScore: { increment: points },
                lastActivityAt: new Date(),
                loginCount: activityType === 'LOGIN' ? { increment: 1 } : undefined,
                batchesCreated: activityType === 'BATCH_CREATED' ? { increment: 1 } : undefined,
                status: ReferralStatus.ACTIVE,
            },
        });
        if (config.blockchain.enabled && referral.blockchainEventId) {
            await this.recordActivityOnBlockchain(referral.blockchainEventId, points);
        }
    }
    async processReferralCompletions() {
        let completed = 0;
        let errors = 0;
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - config.rewards.activationDays);
        const eligibleReferrals = await prisma.referral.findMany({
            where: {
                status: ReferralStatus.ACTIVE,
                registeredAt: { lte: cutoffDate },
                batchesCreated: { gte: config.rewards.minBatchesForActive },
            },
        });
        for (const referral of eligibleReferrals) {
            try {
                await prisma.referral.update({
                    where: { id: referral.id },
                    data: {
                        status: ReferralStatus.COMPLETED,
                        completedAt: new Date(),
                    },
                });
                await prisma.userReferralCode.updateMany({
                    where: { userId: referral.referrerId },
                    data: {
                        completedReferrals: { increment: 1 },
                        activeReferrals: { increment: 1 },
                    },
                });
                if (config.blockchain.enabled && referral.blockchainEventId && this.wallet) {
                    await this.activateReferralOnBlockchain(referral.blockchainEventId);
                }
                await this.notifyReferralActivated(referral);
                completed++;
            }
            catch (error) {
                logger.error('Failed to complete referral', { error, referralId: referral.id });
                errors++;
            }
        }
        logger.info('Referral completion job finished', { completed, errors });
        return { completed, errors };
    }
    async getLeaderboard(month, year, limit = 20) {
        const now = new Date();
        const targetMonth = month || now.getMonth() + 1;
        const targetYear = year || now.getFullYear();
        const monthYear = `${targetYear}-${String(targetMonth).padStart(2, '0')}`;
        const cached = await prisma.referralLeaderboard.findMany({
            where: { monthYear },
            orderBy: { rank: 'asc' },
            take: limit,
        });
        if (cached.length > 0) {
            return cached.map((entry) => ({
                rank: entry.rank,
                userId: entry.userId,
                userName: entry.userName,
                avatar: entry.userAvatar || undefined,
                activeReferrals: entry.activeReferrals,
                completedReferrals: entry.completedReferrals,
                totalPoints: entry.totalPoints,
                blockchainVerified: entry.blockchainVerified,
                walletAddress: entry.walletAddress || undefined,
            }));
        }
        return this.calculateLeaderboard(monthYear, limit);
    }
    async calculateLeaderboard(monthYear, limit) {
        const referralCodes = await prisma.userReferralCode.findMany({
            where: {
                activeReferrals: { gt: 0 },
            },
            orderBy: { activeReferrals: 'desc' },
            take: limit,
        });
        const entries = [];
        for (let i = 0; i < referralCodes.length; i++) {
            const code = referralCodes[i];
            const user = await prisma.user.findUnique({
                where: { id: code.userId },
                select: { firstName: true, lastName: true, walletAddress: true },
            });
            entries.push({
                rank: i + 1,
                userId: code.userId,
                userName: user ? `${user.firstName} ${user.lastName}` : 'Anonymous',
                activeReferrals: code.activeReferrals,
                completedReferrals: code.completedReferrals,
                totalPoints: code.activeReferrals * 100 + code.completedReferrals * 50,
                blockchainVerified: !!code.walletAddress,
                walletAddress: code.walletAddress || undefined,
            });
        }
        return entries;
    }
    async registerReferralOnBlockchain(referrerId, referredId, code) {
        if (!this.wallet || !config.blockchain.contractAddress) {
            return null;
        }
        try {
            const referrer = await prisma.user.findUnique({
                where: { id: referrerId },
                select: { walletAddress: true },
            });
            const referred = await prisma.user.findUnique({
                where: { id: referredId },
                select: { walletAddress: true },
            });
            if (!referrer?.walletAddress || !referred?.walletAddress) {
                logger.info('Skipping blockchain registration - no wallet addresses');
                return null;
            }
            const abi = [
                'function createReferral(address referrer, address referred, string referralCode) returns (bytes32)',
                'event ReferralCreated(bytes32 indexed referralId, address indexed referrer, address indexed referred, string referralCode, uint256 timestamp)',
            ];
            const contract = new ethers.Contract(config.blockchain.contractAddress, abi, this.wallet);
            const tx = await contract.createReferral(referrer.walletAddress, referred.walletAddress, code);
            const receipt = await tx.wait();
            const event = receipt.events?.find((e) => e.event === 'ReferralCreated');
            const referralId = event?.args?.referralId;
            logger.info('Referral registered on blockchain', {
                txHash: receipt.transactionHash,
                referralId,
            });
            return {
                txHash: receipt.transactionHash,
                referralId: referralId?.toString() || '',
            };
        }
        catch (error) {
            logger.error('Failed to register referral on blockchain', { error });
            return null;
        }
    }
    async recordActivityOnBlockchain(referralId, points) {
        if (!this.wallet || !config.blockchain.contractAddress)
            return;
        try {
            const abi = [
                'function recordActivity(bytes32 referralId, uint256 activityPoints)',
            ];
            const contract = new ethers.Contract(config.blockchain.contractAddress, abi, this.wallet);
            await contract.recordActivity(referralId, points);
        }
        catch (error) {
            logger.error('Failed to record activity on blockchain', { error });
        }
    }
    async activateReferralOnBlockchain(referralId) {
        if (!this.wallet || !config.blockchain.contractAddress)
            return;
        try {
            const abi = ['function activateReferral(bytes32 referralId)'];
            const contract = new ethers.Contract(config.blockchain.contractAddress, abi, this.wallet);
            await contract.activateReferral(referralId);
            logger.info('Referral activated on blockchain', { referralId });
        }
        catch (error) {
            logger.error('Failed to activate referral on blockchain', { error });
        }
    }
    async grantPremiumDays(userId, days) {
        const subscription = await prisma.subscription.findUnique({
            where: { userId },
        });
        if (subscription) {
            const currentEnd = subscription.currentPeriodEnd || new Date();
            const newEnd = new Date(Math.max(currentEnd.getTime(), Date.now()));
            newEnd.setDate(newEnd.getDate() + days);
            await prisma.subscription.update({
                where: { userId },
                data: {
                    currentPeriodEnd: newEnd,
                    tier: 'PREMIUM',
                },
            });
        }
        logger.info('Premium days granted', { userId, days });
    }
    async notifyReferrer(referralId) {
        const referral = await prisma.referral.findUnique({
            where: { id: referralId },
        });
        if (!referral)
            return;
        const phoneNumber = await blockchainNotificationService.getUserPhoneNumber(referral.referrerId);
        if (phoneNumber) {
            await blockchainNotificationService.sendReferralSuccessNotification(referralId, 'un nuevo agricultor', `${config.rewards.referrerDays} días de premium gratis`, phoneNumber);
        }
    }
    async notifyReferralActivated(referral) {
        const phoneNumber = await blockchainNotificationService.getUserPhoneNumber(referral.referrerId);
        if (!phoneNumber)
            return;
        const stats = await prisma.userReferralCode.findFirst({
            where: { userId: referral.referrerId },
        });
        const rank = await prisma.userReferralCode.count({
            where: {
                activeReferrals: { gt: stats?.activeReferrals || 0 },
            },
        }) + 1;
        await blockchainNotificationService.sendReferralActivatedNotification('un agricultor', stats?.activeReferrals || 1, rank, phoneNumber);
    }
    async detectSuspiciousReferrals() {
        const suspiciousByIp = await prisma.$queryRaw `
      SELECT "ipAddress", COUNT(*) as count
      FROM referrals
      WHERE "ipAddress" IS NOT NULL
      GROUP BY "ipAddress"
      HAVING COUNT(*) > 3
    `;
        const suspiciousByDevice = await prisma.$queryRaw `
      SELECT "deviceFingerprint", COUNT(*) as count
      FROM referrals
      WHERE "deviceFingerprint" IS NOT NULL
      GROUP BY "deviceFingerprint"
      HAVING COUNT(*) > 3
    `;
        for (const row of suspiciousByIp) {
            await prisma.referral.updateMany({
                where: { ipAddress: row.ipAddress },
                data: {
                    isSuspicious: true,
                    suspicionReasons: ['MULTIPLE_REFERRALS_SAME_IP'],
                },
            });
        }
        logger.info('Fraud detection completed', {
            suspiciousIps: suspiciousByIp.length,
            suspiciousDevices: suspiciousByDevice.length,
        });
    }
}
export const referralService = new ReferralService();
