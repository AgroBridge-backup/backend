import { TransitStatus, isValidStatusTransition, calculateDistance, calculateRouteDeviation, estimateArrival, calculateProgress, } from '../entities/TransitSession.js';
import { AppError } from '../../shared/errors/AppError.js';
import logger from '../../shared/utils/logger.js';
export class TransitTrackingService {
    prisma;
    sessionRepository;
    constructor(prisma, sessionRepository) {
        this.prisma = prisma;
        this.sessionRepository = sessionRepository;
    }
    async createSession(input) {
        const batch = await this.prisma.batch.findUnique({
            where: { id: input.batchId },
        });
        if (!batch) {
            throw new AppError('Batch not found', 404);
        }
        const existingSessions = await this.sessionRepository.findByBatchId(input.batchId);
        const activeSession = existingSessions.find(s => [TransitStatus.SCHEDULED, TransitStatus.IN_TRANSIT, TransitStatus.PAUSED, TransitStatus.DELAYED].includes(s.status));
        if (activeSession) {
            throw new AppError('Batch already has an active transit session', 400);
        }
        const session = await this.sessionRepository.create(input);
        logger.info('Transit session created', {
            sessionId: session.id,
            batchId: input.batchId,
            driverId: input.driverId,
            origin: input.originName,
            destination: input.destinationName,
        });
        return session;
    }
    async getSession(sessionId) {
        return this.sessionRepository.findById(sessionId);
    }
    async getSessionWithProgress(sessionId) {
        const session = await this.sessionRepository.findByIdWithLocations(sessionId);
        if (!session)
            return null;
        const lastLocation = await this.sessionRepository.getLatestLocation(sessionId);
        const locationCount = await this.sessionRepository.countLocations(sessionId);
        const progressPercent = session.totalDistanceKm && session.distanceTraveledKm
            ? calculateProgress(session.distanceTraveledKm, session.totalDistanceKm)
            : 0;
        const remainingDistanceKm = session.totalDistanceKm && session.distanceTraveledKm
            ? session.totalDistanceKm - session.distanceTraveledKm
            : null;
        return {
            ...session,
            progressPercent,
            remainingDistanceKm,
            lastLocation,
            locationCount,
        };
    }
    async getBatchSessions(batchId) {
        return this.sessionRepository.findByBatchId(batchId);
    }
    async getDriverActiveSessions(driverId) {
        return this.sessionRepository.findActiveByDriverId(driverId);
    }
    async updateSessionStatus(sessionId, newStatus, userId) {
        const session = await this.sessionRepository.findById(sessionId);
        if (!session) {
            throw new AppError('Transit session not found', 404);
        }
        if (!isValidStatusTransition(session.status, newStatus)) {
            throw new AppError(`Cannot transition from ${session.status} to ${newStatus}`, 400);
        }
        const updates = {};
        if (newStatus === TransitStatus.IN_TRANSIT && !session.actualDeparture) {
            updates.actualDeparture = new Date();
        }
        if (newStatus === TransitStatus.COMPLETED) {
            updates.actualArrival = new Date();
        }
        const updatedSession = await this.sessionRepository.updateStatus(sessionId, newStatus, updates);
        logger.info('Transit session status updated', {
            sessionId,
            previousStatus: session.status,
            newStatus,
            updatedBy: userId,
        });
        return updatedSession;
    }
    async startTransit(sessionId, userId) {
        return this.updateSessionStatus(sessionId, TransitStatus.IN_TRANSIT, userId);
    }
    async completeTransit(sessionId, userId) {
        return this.updateSessionStatus(sessionId, TransitStatus.COMPLETED, userId);
    }
    async addLocationUpdate(input) {
        const session = await this.sessionRepository.findById(input.sessionId);
        if (!session) {
            throw new AppError('Transit session not found', 404);
        }
        if (![TransitStatus.IN_TRANSIT, TransitStatus.PAUSED, TransitStatus.DELAYED].includes(session.status)) {
            throw new AppError('Cannot add location to inactive session', 400);
        }
        const deviationKm = calculateRouteDeviation(input.latitude, input.longitude, session.originLat, session.originLng, session.destinationLat, session.destinationLng);
        const isOffRoute = deviationKm > session.maxDeviationKm;
        const lastLocation = await this.sessionRepository.getLatestLocation(input.sessionId);
        let distanceTraveledKm = session.distanceTraveledKm || 0;
        if (lastLocation) {
            const incrementalDistance = calculateDistance(lastLocation.latitude, lastLocation.longitude, input.latitude, input.longitude);
            distanceTraveledKm += incrementalDistance;
        }
        const location = await this.prisma.transitLocation.create({
            data: {
                sessionId: input.sessionId,
                latitude: input.latitude,
                longitude: input.longitude,
                altitude: input.altitude,
                accuracy: input.accuracy,
                speed: input.speed,
                heading: input.heading,
                address: input.address,
                isOffRoute,
                deviationKm,
            },
        });
        await this.sessionRepository.updateDistanceTraveled(input.sessionId, distanceTraveledKm);
        let newEstimatedArrival = null;
        if (input.speed && session.totalDistanceKm) {
            const remainingDistance = session.totalDistanceKm - distanceTraveledKm;
            newEstimatedArrival = estimateArrival(remainingDistance, input.speed);
            if (newEstimatedArrival) {
                await this.sessionRepository.updateEstimatedArrival(input.sessionId, newEstimatedArrival);
            }
        }
        let alert = undefined;
        if (isOffRoute && session.alertOnDeviation) {
            alert = {
                type: 'ROUTE_DEVIATION',
                message: `Vehicle is ${deviationKm.toFixed(1)}km off route`,
            };
            logger.warn('Transit route deviation detected', {
                sessionId: input.sessionId,
                deviationKm,
                latitude: input.latitude,
                longitude: input.longitude,
            });
        }
        return {
            location: {
                id: location.id,
                sessionId: location.sessionId,
                latitude: Number(location.latitude),
                longitude: Number(location.longitude),
                altitude: location.altitude ? Number(location.altitude) : null,
                accuracy: location.accuracy ? Number(location.accuracy) : null,
                speed: location.speed ? Number(location.speed) : null,
                heading: location.heading ? Number(location.heading) : null,
                address: location.address,
                isOffRoute: location.isOffRoute,
                deviationKm: location.deviationKm ? Number(location.deviationKm) : null,
                timestamp: location.timestamp,
            },
            isOffRoute,
            deviationKm,
            distanceTraveledKm,
            estimatedArrival: newEstimatedArrival,
            alert,
        };
    }
    async getLocationHistory(sessionId, limit) {
        const session = await this.sessionRepository.findById(sessionId);
        if (!session) {
            throw new AppError('Transit session not found', 404);
        }
        return this.sessionRepository.getLocations(sessionId, limit);
    }
    async getCurrentLocation(sessionId) {
        const session = await this.sessionRepository.findById(sessionId);
        if (!session) {
            throw new AppError('Transit session not found', 404);
        }
        return this.sessionRepository.getLatestLocation(sessionId);
    }
}
