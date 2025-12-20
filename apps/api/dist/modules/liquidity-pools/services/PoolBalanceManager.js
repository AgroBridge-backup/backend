import { Prisma } from '@prisma/client';
import { PoolStatus, RiskTier, PoolTransactionType, calculateEffectiveAvailable, calculateUtilizationRate, calculateReserveRatio, assessPoolHealth, } from '../types/PoolTypes.js';
const CACHE_KEYS = {
    POOL_BALANCE: (poolId) => `cfb:pool:balance:${poolId}`,
    POOL_RESERVED: (poolId) => `cfb:pool:reserved:${poolId}`,
    RESERVATION: (reservationId) => `cfb:reservation:${reservationId}`,
    ALL_POOLS_SUMMARY: 'cfb:pools:summary',
    BALANCE_LOCK: (poolId) => `cfb:lock:balance:${poolId}`,
};
const CACHE_TTL = {
    BALANCE: 30,
    RESERVATION: 300,
    SUMMARY: 60,
    LOCK: 10,
};
const PUBSUB_CHANNELS = {
    BALANCE_CHANGED: 'cfb:balance:changed',
    RESERVATION_CREATED: 'cfb:reservation:created',
    RESERVATION_RELEASED: 'cfb:reservation:released',
};
export class PoolBalanceManager {
    prisma;
    redis;
    eventSubscribers;
    constructor(prisma, redis) {
        this.prisma = prisma;
        this.redis = redis || null;
        this.eventSubscribers = new Map();
    }
    async getBalance(poolId) {
        const startTime = Date.now();
        if (this.redis) {
            const cached = await this.redis.get(CACHE_KEYS.POOL_BALANCE(poolId));
            if (cached) {
                const balance = JSON.parse(cached);
                balance.fromCache = true;
                balance.timestamp = new Date(balance.timestamp);
                return balance;
            }
        }
        const pool = await this.prisma.liquidityPool.findUnique({
            where: { id: poolId },
        });
        if (!pool)
            return null;
        const reservedAmount = await this.getReservedAmount(poolId);
        const balance = this.calculatePoolBalance(pool, reservedAmount);
        if (this.redis) {
            await this.redis.setex(CACHE_KEYS.POOL_BALANCE(poolId), CACHE_TTL.BALANCE, JSON.stringify(balance));
        }
        const elapsed = Date.now() - startTime;
        if (elapsed > 100) {
            console.warn(`Pool balance query took ${elapsed}ms for pool ${poolId}`);
        }
        return balance;
    }
    async getBalances(poolIds) {
        const results = new Map();
        if (this.redis && poolIds.length > 0) {
            const cacheKeys = poolIds.map((id) => CACHE_KEYS.POOL_BALANCE(id));
            const cached = await this.redis.mget(...cacheKeys);
            const uncachedIds = [];
            cached.forEach((value, index) => {
                if (value) {
                    const balance = JSON.parse(value);
                    balance.fromCache = true;
                    balance.timestamp = new Date(balance.timestamp);
                    results.set(poolIds[index], balance);
                }
                else {
                    uncachedIds.push(poolIds[index]);
                }
            });
            if (uncachedIds.length > 0) {
                const pools = await this.prisma.liquidityPool.findMany({
                    where: { id: { in: uncachedIds } },
                });
                for (const pool of pools) {
                    const reservedAmount = await this.getReservedAmount(pool.id);
                    const balance = this.calculatePoolBalance(pool, reservedAmount);
                    results.set(pool.id, balance);
                    await this.redis.setex(CACHE_KEYS.POOL_BALANCE(pool.id), CACHE_TTL.BALANCE, JSON.stringify(balance));
                }
            }
        }
        else {
            const pools = await this.prisma.liquidityPool.findMany({
                where: { id: { in: poolIds } },
            });
            for (const pool of pools) {
                const reservedAmount = await this.getReservedAmount(pool.id);
                results.set(pool.id, this.calculatePoolBalance(pool, reservedAmount));
            }
        }
        return results;
    }
    async getSummary() {
        if (this.redis) {
            const cached = await this.redis.get(CACHE_KEYS.ALL_POOLS_SUMMARY);
            if (cached) {
                const summary = JSON.parse(cached);
                summary.timestamp = new Date(summary.timestamp);
                return summary;
            }
        }
        const pools = await this.prisma.liquidityPool.findMany();
        const summary = {
            totalPools: pools.length,
            activePools: pools.filter((p) => p.status === 'ACTIVE').length,
            aggregateCapital: {
                total: 0,
                available: 0,
                deployed: 0,
                reserved: 0,
            },
            averageUtilization: 0,
            averageReserveRatio: 0,
            poolsByStatus: {
                [PoolStatus.ACTIVE]: 0,
                [PoolStatus.PAUSED]: 0,
                [PoolStatus.CLOSED]: 0,
                [PoolStatus.LIQUIDATING]: 0,
            },
            poolsByRiskTier: {
                [RiskTier.A]: 0,
                [RiskTier.B]: 0,
                [RiskTier.C]: 0,
            },
            timestamp: new Date(),
        };
        let totalUtilization = 0;
        let totalReserveRatio = 0;
        for (const pool of pools) {
            const total = Number(pool.totalCapital);
            const available = Number(pool.availableCapital);
            const deployed = Number(pool.deployedCapital);
            const reserved = Number(pool.reservedCapital);
            summary.aggregateCapital.total += total;
            summary.aggregateCapital.available += available;
            summary.aggregateCapital.deployed += deployed;
            summary.aggregateCapital.reserved += reserved;
            totalUtilization += calculateUtilizationRate(deployed, total);
            totalReserveRatio += calculateReserveRatio(available, total);
            summary.poolsByStatus[pool.status]++;
            summary.poolsByRiskTier[pool.riskTier]++;
        }
        if (pools.length > 0) {
            summary.averageUtilization = totalUtilization / pools.length;
            summary.averageReserveRatio = totalReserveRatio / pools.length;
        }
        if (this.redis) {
            await this.redis.setex(CACHE_KEYS.ALL_POOLS_SUMMARY, CACHE_TTL.SUMMARY, JSON.stringify(summary));
        }
        return summary;
    }
    async createReservation(request) {
        const ttl = request.ttlSeconds || CACHE_TTL.RESERVATION;
        const reservationId = `res_${request.advanceId}_${Date.now()}`;
        const lockAcquired = await this.acquireLock(request.poolId);
        if (!lockAcquired) {
            return {
                success: false,
                error: 'Could not acquire lock for pool. Please retry.',
            };
        }
        try {
            const balance = await this.getBalance(request.poolId);
            if (!balance) {
                return { success: false, error: 'Pool not found' };
            }
            if (request.amount > balance.effectiveAvailable) {
                return {
                    success: false,
                    error: `Insufficient effective available capital (${balance.effectiveAvailable})`,
                };
            }
            const reservation = {
                id: reservationId,
                poolId: request.poolId,
                amount: request.amount,
                advanceId: request.advanceId,
                farmerId: request.farmerId,
                expiresAt: new Date(Date.now() + ttl * 1000),
                createdAt: new Date(),
                status: 'ACTIVE',
            };
            if (this.redis) {
                await this.redis.setex(CACHE_KEYS.RESERVATION(reservationId), ttl, JSON.stringify(reservation));
                await this.redis.hincrby(CACHE_KEYS.POOL_RESERVED(request.poolId), reservationId, request.amount);
                await this.invalidateBalanceCache(request.poolId);
                await this.redis.publish(PUBSUB_CHANNELS.RESERVATION_CREATED, JSON.stringify(reservation));
            }
            else {
                await this.prisma.liquidityPool.update({
                    where: { id: request.poolId },
                    data: {
                        reservedCapital: {
                            increment: new Prisma.Decimal(request.amount),
                        },
                    },
                });
            }
            return { success: true, reservation };
        }
        finally {
            await this.releaseLock(request.poolId);
        }
    }
    async commitReservation(reservationId) {
        if (!this.redis) {
            return { success: true };
        }
        const reservationData = await this.redis.get(CACHE_KEYS.RESERVATION(reservationId));
        if (!reservationData) {
            return { success: false, error: 'Reservation not found or expired' };
        }
        const reservation = JSON.parse(reservationData);
        await this.redis.del(CACHE_KEYS.RESERVATION(reservationId));
        await this.redis.hdel(CACHE_KEYS.POOL_RESERVED(reservation.poolId), reservationId);
        await this.invalidateBalanceCache(reservation.poolId);
        return { success: true };
    }
    async releaseReservation(reservationId) {
        if (!this.redis) {
            return { success: true, releasedAmount: 0 };
        }
        const reservationData = await this.redis.get(CACHE_KEYS.RESERVATION(reservationId));
        if (!reservationData) {
            return { success: false, error: 'Reservation not found or expired' };
        }
        const reservation = JSON.parse(reservationData);
        const lockAcquired = await this.acquireLock(reservation.poolId);
        if (!lockAcquired) {
            return { success: false, error: 'Could not acquire lock' };
        }
        try {
            await this.redis.del(CACHE_KEYS.RESERVATION(reservationId));
            await this.redis.hdel(CACHE_KEYS.POOL_RESERVED(reservation.poolId), reservationId);
            await this.invalidateBalanceCache(reservation.poolId);
            await this.redis.publish(PUBSUB_CHANNELS.RESERVATION_RELEASED, JSON.stringify(reservation));
            return { success: true, releasedAmount: reservation.amount };
        }
        finally {
            await this.releaseLock(reservation.poolId);
        }
    }
    async getPoolReservations(poolId) {
        if (!this.redis)
            return [];
        const reservationAmounts = await this.redis.hgetall(CACHE_KEYS.POOL_RESERVED(poolId));
        const reservations = [];
        for (const reservationId of Object.keys(reservationAmounts)) {
            const data = await this.redis.get(CACHE_KEYS.RESERVATION(reservationId));
            if (data) {
                const reservation = JSON.parse(data);
                reservation.expiresAt = new Date(reservation.expiresAt);
                reservation.createdAt = new Date(reservation.createdAt);
                reservations.push(reservation);
            }
        }
        return reservations;
    }
    async updateBalance(operation) {
        const lockAcquired = await this.acquireLock(operation.poolId);
        if (!lockAcquired) {
            return { success: false, error: 'Could not acquire lock' };
        }
        try {
            const balanceBefore = await this.getBalance(operation.poolId);
            if (!balanceBefore) {
                return { success: false, error: 'Pool not found' };
            }
            const updateData = {};
            const fieldValue = this.getBalanceFieldValue(balanceBefore, operation.field);
            let newValue;
            switch (operation.operation) {
                case 'INCREMENT':
                    newValue = fieldValue + operation.amount;
                    updateData[operation.field] = { increment: new Prisma.Decimal(operation.amount) };
                    break;
                case 'DECREMENT':
                    newValue = fieldValue - operation.amount;
                    updateData[operation.field] = { decrement: new Prisma.Decimal(operation.amount) };
                    break;
                case 'SET':
                    newValue = operation.amount;
                    updateData[operation.field] = new Prisma.Decimal(operation.amount);
                    break;
            }
            const result = await this.prisma.$transaction(async (tx) => {
                const updatedPool = await tx.liquidityPool.update({
                    where: { id: operation.poolId },
                    data: updateData,
                });
                const transaction = await tx.poolTransaction.create({
                    data: {
                        poolId: operation.poolId,
                        type: operation.transactionType,
                        amount: new Prisma.Decimal(operation.amount),
                        balanceBefore: new Prisma.Decimal(fieldValue),
                        balanceAfter: new Prisma.Decimal(newValue),
                        description: operation.description,
                        metadata: operation.metadata,
                        relatedAdvanceId: operation.relatedAdvanceId,
                        relatedInvestorId: operation.relatedInvestorId,
                    },
                });
                return { pool: updatedPool, transaction };
            });
            await this.invalidateBalanceCache(operation.poolId);
            const balanceAfter = await this.getBalance(operation.poolId);
            if (balanceAfter) {
                await this.publishBalanceChange({
                    poolId: operation.poolId,
                    changeType: operation.transactionType,
                    amount: operation.amount,
                    balanceBefore,
                    balanceAfter,
                    relatedEntityId: operation.relatedAdvanceId || operation.relatedInvestorId,
                    relatedEntityType: operation.relatedAdvanceId ? 'ADVANCE' : operation.relatedInvestorId ? 'INVESTOR' : undefined,
                    timestamp: new Date(),
                });
            }
            return {
                success: true,
                balanceBefore,
                balanceAfter: balanceAfter,
                transactionId: result.transaction.id,
            };
        }
        finally {
            await this.releaseLock(operation.poolId);
        }
    }
    async batchUpdateBalances(batch) {
        if (batch.atomic) {
            try {
                const results = await this.prisma.$transaction(async (tx) => {
                    const transactionResults = [];
                    for (const operation of batch.operations) {
                        const pool = await tx.liquidityPool.findUnique({
                            where: { id: operation.poolId },
                        });
                        if (!pool) {
                            throw new Error(`Pool ${operation.poolId} not found`);
                        }
                        const fieldValue = this.getBalanceFieldValueFromPool(pool, operation.field);
                        let newValue;
                        const updateData = {};
                        switch (operation.operation) {
                            case 'INCREMENT':
                                newValue = fieldValue + operation.amount;
                                updateData[operation.field] = { increment: new Prisma.Decimal(operation.amount) };
                                break;
                            case 'DECREMENT':
                                newValue = fieldValue - operation.amount;
                                updateData[operation.field] = { decrement: new Prisma.Decimal(operation.amount) };
                                break;
                            case 'SET':
                                newValue = operation.amount;
                                updateData[operation.field] = new Prisma.Decimal(operation.amount);
                                break;
                        }
                        await tx.liquidityPool.update({
                            where: { id: operation.poolId },
                            data: updateData,
                        });
                        const transaction = await tx.poolTransaction.create({
                            data: {
                                poolId: operation.poolId,
                                type: operation.transactionType,
                                amount: new Prisma.Decimal(operation.amount),
                                balanceBefore: new Prisma.Decimal(fieldValue),
                                balanceAfter: new Prisma.Decimal(newValue),
                                description: operation.description,
                                metadata: operation.metadata,
                                relatedAdvanceId: operation.relatedAdvanceId,
                                relatedInvestorId: operation.relatedInvestorId,
                            },
                        });
                        transactionResults.push({
                            poolId: operation.poolId,
                            success: true,
                            transactionId: transaction.id,
                        });
                    }
                    return transactionResults;
                });
                const poolIds = [...new Set(batch.operations.map((o) => o.poolId))];
                await Promise.all(poolIds.map((id) => this.invalidateBalanceCache(id)));
                return { success: true, results };
            }
            catch (error) {
                return {
                    success: false,
                    error: error instanceof Error ? error.message : 'Batch update failed',
                };
            }
        }
        else {
            const results = await Promise.all(batch.operations.map(async (operation) => {
                const result = await this.updateBalance(operation);
                return {
                    poolId: operation.poolId,
                    success: result.success,
                    transactionId: result.transactionId,
                    error: result.error,
                };
            }));
            return {
                success: results.every((r) => r.success),
                results,
            };
        }
    }
    async getTransactions(options) {
        const where = {};
        if (options.poolId)
            where.poolId = options.poolId;
        if (options.types?.length)
            where.type = { in: options.types };
        if (options.startDate || options.endDate) {
            where.createdAt = {};
            if (options.startDate)
                where.createdAt.gte = options.startDate;
            if (options.endDate)
                where.createdAt.lte = options.endDate;
        }
        if (options.minAmount !== undefined || options.maxAmount !== undefined) {
            const amountFilter = {};
            if (options.minAmount !== undefined) {
                amountFilter.gte = options.minAmount;
            }
            if (options.maxAmount !== undefined) {
                amountFilter.lte = options.maxAmount;
            }
            where.amount = amountFilter;
        }
        if (options.relatedAdvanceId)
            where.relatedAdvanceId = options.relatedAdvanceId;
        if (options.relatedInvestorId)
            where.relatedInvestorId = options.relatedInvestorId;
        const transactions = await this.prisma.poolTransaction.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            skip: options.offset || 0,
            take: options.limit || 50,
        });
        return transactions.map((t) => ({
            id: t.id,
            poolId: t.poolId,
            type: t.type,
            amount: Number(t.amount),
            balanceBefore: Number(t.balanceBefore),
            balanceAfter: Number(t.balanceAfter),
            description: t.description,
            metadata: t.metadata,
            relatedAdvanceId: t.relatedAdvanceId || undefined,
            relatedInvestorId: t.relatedInvestorId || undefined,
            createdAt: t.createdAt,
        }));
    }
    async getTransactionSummary(poolId, startDate, endDate) {
        const transactions = await this.prisma.poolTransaction.findMany({
            where: {
                poolId,
                createdAt: {
                    gte: startDate,
                    lte: endDate,
                },
            },
        });
        const byType = {};
        Object.values(PoolTransactionType).forEach((type) => {
            byType[type] = { count: 0, totalAmount: 0, netAmount: 0 };
        });
        let inflows = 0;
        let outflows = 0;
        for (const tx of transactions) {
            const type = tx.type;
            const amount = Number(tx.amount);
            byType[type].count++;
            byType[type].totalAmount += Math.abs(amount);
            if ([
                PoolTransactionType.CAPITAL_DEPOSIT,
                PoolTransactionType.ADVANCE_REPAYMENT,
                PoolTransactionType.FEE_COLLECTION,
                PoolTransactionType.PENALTY_FEE,
                PoolTransactionType.INTEREST_DISTRIBUTION,
            ].includes(type)) {
                inflows += Math.abs(amount);
                byType[type].netAmount += Math.abs(amount);
            }
            else {
                outflows += Math.abs(amount);
                byType[type].netAmount -= Math.abs(amount);
            }
        }
        return {
            poolId,
            period: { startDate, endDate },
            byType,
            totals: {
                inflows,
                outflows,
                netChange: inflows - outflows,
                transactionCount: transactions.length,
            },
        };
    }
    subscribe(poolId, callback) {
        if (!this.eventSubscribers.has(poolId)) {
            this.eventSubscribers.set(poolId, new Set());
        }
        this.eventSubscribers.get(poolId).add(callback);
        return () => {
            const subscribers = this.eventSubscribers.get(poolId);
            if (subscribers) {
                subscribers.delete(callback);
                if (subscribers.size === 0) {
                    this.eventSubscribers.delete(poolId);
                }
            }
        };
    }
    subscribeAll(callback) {
        return this.subscribe('*', callback);
    }
    calculatePoolBalance(pool, reservedAmount) {
        const totalCapital = Number(pool.totalCapital);
        const availableCapital = Number(pool.availableCapital);
        const deployedCapital = Number(pool.deployedCapital);
        const dbReservedCapital = Number(pool.reservedCapital);
        const minReserveRatio = Number(pool.minReserveRatio);
        const totalReserved = dbReservedCapital + reservedAmount;
        const effectiveAvailable = availableCapital - reservedAmount;
        const requiredReserve = totalCapital * (minReserveRatio / 100);
        const actualEffectiveAvailable = calculateEffectiveAvailable(effectiveAvailable, totalCapital, minReserveRatio);
        const utilizationRate = calculateUtilizationRate(deployedCapital, totalCapital);
        const reserveRatio = calculateReserveRatio(effectiveAvailable, totalCapital);
        return {
            poolId: pool.id,
            poolName: pool.name,
            status: pool.status,
            riskTier: pool.riskTier,
            currency: pool.currency,
            totalCapital,
            availableCapital: effectiveAvailable,
            deployedCapital,
            reservedCapital: totalReserved,
            requiredReserve,
            effectiveAvailable: actualEffectiveAvailable,
            utilizationRate,
            reserveRatio,
            isHealthy: assessPoolHealth(Number(pool.defaultRate), utilizationRate, reserveRatio) === 'HEALTHY',
            timestamp: new Date(),
            fromCache: false,
        };
    }
    async getReservedAmount(poolId) {
        if (!this.redis)
            return 0;
        const reservations = await this.redis.hgetall(CACHE_KEYS.POOL_RESERVED(poolId));
        return Object.values(reservations).reduce((sum, val) => sum + parseInt(val, 10), 0);
    }
    getBalanceFieldValue(balance, field) {
        return balance[field];
    }
    getBalanceFieldValueFromPool(pool, field) {
        return Number(pool[field]);
    }
    async acquireLock(poolId) {
        if (!this.redis)
            return true;
        const lockKey = CACHE_KEYS.BALANCE_LOCK(poolId);
        const lockValue = `lock_${Date.now()}_${Math.random()}`;
        const result = await this.redis.set(lockKey, lockValue, 'EX', CACHE_TTL.LOCK, 'NX');
        return result === 'OK';
    }
    async releaseLock(poolId) {
        if (!this.redis)
            return;
        await this.redis.del(CACHE_KEYS.BALANCE_LOCK(poolId));
    }
    async invalidateBalanceCache(poolId) {
        if (!this.redis)
            return;
        await Promise.all([
            this.redis.del(CACHE_KEYS.POOL_BALANCE(poolId)),
            this.redis.del(CACHE_KEYS.ALL_POOLS_SUMMARY),
        ]);
    }
    async publishBalanceChange(event) {
        const poolSubscribers = this.eventSubscribers.get(event.poolId);
        const allSubscribers = this.eventSubscribers.get('*');
        if (poolSubscribers) {
            poolSubscribers.forEach((callback) => callback(event));
        }
        if (allSubscribers) {
            allSubscribers.forEach((callback) => callback(event));
        }
        if (this.redis) {
            await this.redis.publish(PUBSUB_CHANNELS.BALANCE_CHANGED, JSON.stringify(event));
        }
    }
}
export function createPoolBalanceManager(prisma, redis) {
    return new PoolBalanceManager(prisma, redis);
}
