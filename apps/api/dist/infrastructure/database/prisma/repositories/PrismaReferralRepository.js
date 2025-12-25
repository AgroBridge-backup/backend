import { ReferralStatus as PrismaReferralStatus } from '@prisma/client';
import { randomBytes } from 'crypto';
export class PrismaReferralRepository {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    mapToDomain(prismaReferral) {
        return {
            id: prismaReferral.id,
            referrerId: prismaReferral.referrerId,
            referredId: prismaReferral.referredId,
            referralCode: prismaReferral.referralCode,
            status: prismaReferral.status,
            activityScore: prismaReferral.activityScore,
            batchesCreated: prismaReferral.batchesCreated,
            loginCount: prismaReferral.loginCount,
            lastActivityAt: prismaReferral.lastActivityAt,
            rewardType: prismaReferral.rewardType,
            rewardValue: prismaReferral.rewardValue,
            rewardGranted: prismaReferral.rewardGranted,
            rewardGrantedAt: prismaReferral.rewardGrantedAt,
            blockchainTxHash: prismaReferral.blockchainTxHash,
            blockchainEventId: prismaReferral.blockchainEventId,
            blockchainVerified: prismaReferral.blockchainVerified,
            blockchainNetwork: prismaReferral.blockchainNetwork,
            monthYear: prismaReferral.monthYear,
            ipAddress: prismaReferral.ipAddress,
            deviceFingerprint: prismaReferral.deviceFingerprint,
            isSuspicious: prismaReferral.isSuspicious,
            suspicionReasons: prismaReferral.suspicionReasons || [],
            appliedAt: prismaReferral.appliedAt,
            registeredAt: prismaReferral.registeredAt,
            completedAt: prismaReferral.completedAt,
            createdAt: prismaReferral.createdAt,
            updatedAt: prismaReferral.updatedAt,
        };
    }
    mapUserReferralCodeToDomain(prismaCode) {
        return {
            id: prismaCode.id,
            userId: prismaCode.userId,
            code: prismaCode.code,
            totalReferrals: prismaCode.totalReferrals,
            activeReferrals: prismaCode.activeReferrals,
            completedReferrals: prismaCode.completedReferrals,
            totalRewardsEarned: prismaCode.totalRewardsEarned,
            onChainReferrals: prismaCode.onChainReferrals,
            walletAddress: prismaCode.walletAddress,
            createdAt: prismaCode.createdAt,
            updatedAt: prismaCode.updatedAt,
        };
    }
    async create(data) {
        const referral = await this.prisma.referral.create({
            data: {
                id: data.id,
                referrerId: data.referrerId,
                referredId: data.referredId,
                referralCode: data.referralCode,
                status: data.status,
                monthYear: data.monthYear,
                ipAddress: data.ipAddress,
                deviceFingerprint: data.deviceFingerprint,
                rewardType: data.rewardType || 'PREMIUM_DAYS',
                rewardValue: data.rewardValue || 30,
            },
        });
        return this.mapToDomain(referral);
    }
    async findById(id) {
        const referral = await this.prisma.referral.findUnique({
            where: { id },
        });
        return referral ? this.mapToDomain(referral) : null;
    }
    async findByReferredUser(referredId) {
        const referral = await this.prisma.referral.findFirst({
            where: { referredId },
        });
        return referral ? this.mapToDomain(referral) : null;
    }
    async listByReferrer(referrerId) {
        const referrals = await this.prisma.referral.findMany({
            where: { referrerId },
            orderBy: { createdAt: 'desc' },
        });
        return referrals.map(this.mapToDomain.bind(this));
    }
    async listByReferrerWithStatus(referrerId, status) {
        const referrals = await this.prisma.referral.findMany({
            where: {
                referrerId,
                status: status,
            },
            orderBy: { createdAt: 'desc' },
        });
        return referrals.map(this.mapToDomain.bind(this));
    }
    async update(id, data) {
        const referral = await this.prisma.referral.update({
            where: { id },
            data: {
                ...(data.referredId !== undefined && { referredId: data.referredId }),
                ...(data.status !== undefined && { status: data.status }),
                ...(data.activityScore !== undefined && { activityScore: data.activityScore }),
                ...(data.batchesCreated !== undefined && { batchesCreated: data.batchesCreated }),
                ...(data.loginCount !== undefined && { loginCount: data.loginCount }),
                ...(data.lastActivityAt !== undefined && { lastActivityAt: data.lastActivityAt }),
                ...(data.rewardGranted !== undefined && { rewardGranted: data.rewardGranted }),
                ...(data.rewardGrantedAt !== undefined && { rewardGrantedAt: data.rewardGrantedAt }),
                ...(data.blockchainTxHash !== undefined && { blockchainTxHash: data.blockchainTxHash }),
                ...(data.blockchainEventId !== undefined && { blockchainEventId: data.blockchainEventId }),
                ...(data.blockchainVerified !== undefined && { blockchainVerified: data.blockchainVerified }),
                ...(data.blockchainNetwork !== undefined && { blockchainNetwork: data.blockchainNetwork }),
                ...(data.registeredAt !== undefined && { registeredAt: data.registeredAt }),
                ...(data.completedAt !== undefined && { completedAt: data.completedAt }),
                ...(data.isSuspicious !== undefined && { isSuspicious: data.isSuspicious }),
                ...(data.suspicionReasons !== undefined && { suspicionReasons: data.suspicionReasons }),
            },
        });
        return this.mapToDomain(referral);
    }
    async markRewarded(id, rewardTxHash) {
        const referral = await this.prisma.referral.update({
            where: { id },
            data: {
                rewardGranted: true,
                rewardGrantedAt: new Date(),
                ...(rewardTxHash && {
                    blockchainTxHash: rewardTxHash,
                    blockchainVerified: true,
                }),
            },
        });
        return this.mapToDomain(referral);
    }
    async incrementActivityScore(id, points) {
        const referral = await this.prisma.referral.update({
            where: { id },
            data: {
                activityScore: { increment: points },
                lastActivityAt: new Date(),
            },
        });
        return this.mapToDomain(referral);
    }
    async getStatsForReferrer(referrerId) {
        const [total, active, completed, pending, rewardsData] = await Promise.all([
            this.prisma.referral.count({ where: { referrerId } }),
            this.prisma.referral.count({
                where: { referrerId, status: PrismaReferralStatus.ACTIVE },
            }),
            this.prisma.referral.count({
                where: { referrerId, status: PrismaReferralStatus.COMPLETED },
            }),
            this.prisma.referral.count({
                where: { referrerId, status: PrismaReferralStatus.PENDING },
            }),
            this.prisma.referral.aggregate({
                where: { referrerId, rewardGranted: true },
                _sum: { rewardValue: true },
            }),
        ]);
        const userCode = await this.prisma.userReferralCode.findFirst({
            where: { userId: referrerId },
        });
        let leaderboardRank;
        if (userCode) {
            const higherRanked = await this.prisma.userReferralCode.count({
                where: {
                    activeReferrals: { gt: userCode.activeReferrals },
                },
            });
            leaderboardRank = higherRanked + 1;
        }
        return {
            totalReferrals: total,
            activeReferrals: active,
            completedReferrals: completed,
            pendingReferrals: pending,
            totalRewardsEarned: rewardsData._sum.rewardValue || 0,
            leaderboardRank,
        };
    }
    async getOrCreateUserReferralCode(userId) {
        let code = await this.prisma.userReferralCode.findFirst({
            where: { userId },
        });
        if (!code) {
            const generatedCode = this.generateReferralCode();
            code = await this.prisma.userReferralCode.create({
                data: {
                    userId,
                    code: generatedCode,
                },
            });
        }
        return this.mapUserReferralCodeToDomain(code);
    }
    generateReferralCode() {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        const bytes = randomBytes(6);
        let code = 'AB-';
        for (let i = 0; i < 6; i++) {
            code += chars[bytes[i] % chars.length];
        }
        return code;
    }
    async findUserReferralCodeByCode(code) {
        const referralCode = await this.prisma.userReferralCode.findFirst({
            where: { code: code.toUpperCase() },
        });
        return referralCode ? this.mapUserReferralCodeToDomain(referralCode) : null;
    }
    async updateUserReferralCodeStats(userId, updates) {
        const code = await this.prisma.userReferralCode.update({
            where: { userId },
            data: {
                ...(updates.totalReferrals !== undefined && {
                    totalReferrals: { increment: updates.totalReferrals },
                }),
                ...(updates.activeReferrals !== undefined && {
                    activeReferrals: { increment: updates.activeReferrals },
                }),
                ...(updates.completedReferrals !== undefined && {
                    completedReferrals: { increment: updates.completedReferrals },
                }),
                ...(updates.totalRewardsEarned !== undefined && {
                    totalRewardsEarned: { increment: updates.totalRewardsEarned },
                }),
                ...(updates.onChainReferrals !== undefined && {
                    onChainReferrals: { increment: updates.onChainReferrals },
                }),
            },
        });
        return this.mapUserReferralCodeToDomain(code);
    }
    async getLeaderboard(monthYear, limit = 50) {
        const cached = await this.prisma.referralLeaderboard.findMany({
            where: { monthYear },
            orderBy: { rank: 'asc' },
            take: limit,
        });
        if (cached.length > 0) {
            return cached.map((entry) => ({
                rank: entry.rank,
                userId: entry.userId,
                userName: entry.userName,
                activeReferrals: entry.activeReferrals,
                completedReferrals: entry.completedReferrals,
                totalPoints: entry.totalPoints,
                blockchainVerified: entry.blockchainVerified,
            }));
        }
        const codes = await this.prisma.userReferralCode.findMany({
            where: { activeReferrals: { gt: 0 } },
            orderBy: { activeReferrals: 'desc' },
            take: limit,
        });
        const results = await Promise.all(codes.map(async (code, index) => {
            const user = await this.prisma.user.findUnique({
                where: { id: code.userId },
                select: { firstName: true, lastName: true },
            });
            return {
                rank: index + 1,
                userId: code.userId,
                userName: user ? `${user.firstName} ${user.lastName.charAt(0)}.` : 'Anonymous',
                activeReferrals: code.activeReferrals,
                completedReferrals: code.completedReferrals,
                totalPoints: code.activeReferrals * 100 + code.completedReferrals * 50,
                blockchainVerified: !!code.walletAddress,
            };
        }));
        return results;
    }
    async countByReferrerAndMonth(referrerId, monthYear) {
        return this.prisma.referral.count({
            where: { referrerId, monthYear },
        });
    }
}
