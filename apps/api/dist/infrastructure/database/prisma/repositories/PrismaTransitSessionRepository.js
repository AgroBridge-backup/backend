import { TransitStatus as PrismaTransitStatus } from '@prisma/client';
export class PrismaTransitSessionRepository {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    mapSessionToDomain(session) {
        return {
            id: session.id,
            batchId: session.batchId,
            status: session.status,
            driverId: session.driverId,
            vehicleId: session.vehicleId,
            originName: session.originName,
            originLat: Number(session.originLat),
            originLng: Number(session.originLng),
            destinationName: session.destinationName,
            destinationLat: Number(session.destinationLat),
            destinationLng: Number(session.destinationLng),
            scheduledDeparture: session.scheduledDeparture,
            actualDeparture: session.actualDeparture,
            scheduledArrival: session.scheduledArrival,
            actualArrival: session.actualArrival,
            estimatedArrival: session.estimatedArrival,
            totalDistanceKm: session.totalDistanceKm ? Number(session.totalDistanceKm) : null,
            distanceTraveledKm: session.distanceTraveledKm ? Number(session.distanceTraveledKm) : null,
            maxDeviationKm: Number(session.maxDeviationKm),
            alertOnDeviation: session.alertOnDeviation,
            locations: session.locations?.map(this.mapLocationToDomain),
            createdAt: session.createdAt,
            updatedAt: session.updatedAt,
        };
    }
    mapLocationToDomain(location) {
        return {
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
        };
    }
    async findById(id) {
        const session = await this.prisma.transitSession.findUnique({
            where: { id },
        });
        return session ? this.mapSessionToDomain(session) : null;
    }
    async findByIdWithLocations(id) {
        const session = await this.prisma.transitSession.findUnique({
            where: { id },
            include: {
                locations: {
                    orderBy: { timestamp: 'desc' },
                    take: 100,
                },
            },
        });
        return session ? this.mapSessionToDomain(session) : null;
    }
    async findByBatchId(batchId) {
        const sessions = await this.prisma.transitSession.findMany({
            where: { batchId },
            orderBy: { createdAt: 'desc' },
        });
        return sessions.map(this.mapSessionToDomain.bind(this));
    }
    async findActiveByDriverId(driverId) {
        const sessions = await this.prisma.transitSession.findMany({
            where: {
                driverId,
                status: {
                    in: [
                        PrismaTransitStatus.SCHEDULED,
                        PrismaTransitStatus.IN_TRANSIT,
                        PrismaTransitStatus.PAUSED,
                        PrismaTransitStatus.DELAYED,
                    ],
                },
            },
            orderBy: { scheduledDeparture: 'asc' },
        });
        return sessions.map(this.mapSessionToDomain.bind(this));
    }
    async findByStatus(status) {
        const sessions = await this.prisma.transitSession.findMany({
            where: { status: status },
            orderBy: { scheduledDeparture: 'asc' },
        });
        return sessions.map(this.mapSessionToDomain.bind(this));
    }
    async create(input) {
        const session = await this.prisma.transitSession.create({
            data: {
                batchId: input.batchId,
                driverId: input.driverId,
                vehicleId: input.vehicleId,
                originName: input.originName,
                originLat: input.originLat,
                originLng: input.originLng,
                destinationName: input.destinationName,
                destinationLat: input.destinationLat,
                destinationLng: input.destinationLng,
                scheduledDeparture: input.scheduledDeparture,
                scheduledArrival: input.scheduledArrival,
                totalDistanceKm: input.totalDistanceKm,
                maxDeviationKm: input.maxDeviationKm ?? 5.0,
                alertOnDeviation: input.alertOnDeviation ?? true,
                status: PrismaTransitStatus.SCHEDULED,
            },
        });
        return this.mapSessionToDomain(session);
    }
    async updateStatus(id, status, updates) {
        const session = await this.prisma.transitSession.update({
            where: { id },
            data: {
                status: status,
                actualDeparture: updates?.actualDeparture,
                actualArrival: updates?.actualArrival,
                estimatedArrival: updates?.estimatedArrival,
            },
        });
        return this.mapSessionToDomain(session);
    }
    async updateEstimatedArrival(id, estimatedArrival) {
        const session = await this.prisma.transitSession.update({
            where: { id },
            data: { estimatedArrival },
        });
        return this.mapSessionToDomain(session);
    }
    async updateDistanceTraveled(id, distanceTraveledKm) {
        const session = await this.prisma.transitSession.update({
            where: { id },
            data: { distanceTraveledKm },
        });
        return this.mapSessionToDomain(session);
    }
    async addLocation(input) {
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
            },
        });
        return this.mapLocationToDomain(location);
    }
    async getLocations(sessionId, limit) {
        const locations = await this.prisma.transitLocation.findMany({
            where: { sessionId },
            orderBy: { timestamp: 'desc' },
            take: limit,
        });
        return locations.map(this.mapLocationToDomain);
    }
    async getLatestLocation(sessionId) {
        const location = await this.prisma.transitLocation.findFirst({
            where: { sessionId },
            orderBy: { timestamp: 'desc' },
        });
        return location ? this.mapLocationToDomain(location) : null;
    }
    async countLocations(sessionId) {
        return this.prisma.transitLocation.count({
            where: { sessionId },
        });
    }
    async getOffRouteLocations(sessionId) {
        const locations = await this.prisma.transitLocation.findMany({
            where: {
                sessionId,
                isOffRoute: true,
            },
            orderBy: { timestamp: 'desc' },
        });
        return locations.map(this.mapLocationToDomain);
    }
}
