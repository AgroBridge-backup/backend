import { generateShortCode, generateFarmerSlug, getCountryFlag, detectDeviceType, extractBrowser, getVarietyDisplayName, buildPublicUrl, getStageIcon, getHealthCategory, } from '../entities/PublicTraceability.js';
import { AppError } from '../../shared/errors/AppError.js';
import logger from '../../shared/utils/logger.js';
export class PublicTraceabilityService {
    prisma;
    linkRepository;
    constructor(prisma, linkRepository) {
        this.prisma = prisma;
        this.linkRepository = linkRepository;
    }
    async generatePublicLink(batchId) {
        const existing = await this.linkRepository.findByBatchId(batchId);
        if (existing && existing.isActive) {
            return {
                link: existing,
                publicUrl: existing.publicUrl,
                qrImageUrl: existing.qrImageUrl,
                isNew: false,
            };
        }
        const batch = await this.prisma.batch.findUnique({
            where: { id: batchId },
        });
        if (!batch) {
            throw new AppError('Batch not found', 404);
        }
        let shortCode = generateShortCode();
        let attempts = 0;
        while (await this.linkRepository.findByShortCode(shortCode)) {
            shortCode = generateShortCode();
            attempts++;
            if (attempts > 10) {
                throw new AppError('Failed to generate unique short code', 500);
            }
        }
        const publicUrl = buildPublicUrl(shortCode);
        const link = await this.linkRepository.create({
            batchId,
            shortCode,
            publicUrl,
            expiresAt: undefined,
        });
        logger.info('Public traceability link generated', {
            batchId,
            shortCode,
            publicUrl,
        });
        return {
            link,
            publicUrl,
            qrImageUrl: null,
            isNew: true,
        };
    }
    async setQrImageUrl(shortCode, qrImageUrl) {
        const link = await this.linkRepository.findByShortCode(shortCode);
        if (!link) {
            throw new AppError('Link not found', 404);
        }
        return this.linkRepository.update(link.id, { qrImageUrl });
    }
    async getFarmerProfile(idOrSlug) {
        const producer = await this.prisma.producer.findFirst({
            where: {
                OR: [
                    { id: idOrSlug },
                    { businessName: { contains: idOrSlug, mode: 'insensitive' } },
                ],
            },
            include: {
                user: {
                    select: {
                        name: true,
                    },
                },
                batches: {
                    where: {
                        status: { not: 'REJECTED' },
                    },
                    include: {
                        qualityCertificates: true,
                    },
                },
                certifications: true,
                fields: {
                    where: { status: 'ACTIVE' },
                    include: {
                        imagery: {
                            orderBy: { captureDate: 'desc' },
                            take: 1,
                        },
                    },
                    take: 1,
                },
            },
        });
        if (!producer) {
            return null;
        }
        const totalLots = producer.batches.length;
        const blockchainVerifiedLots = producer.batches.filter((b) => b.qualityCertificates?.some((c) => c.hashOnChain)).length;
        let averageHealthScore = null;
        if (producer.fields.length > 0 && producer.fields[0].imagery?.length > 0) {
            const healthScores = producer.fields
                .flatMap((f) => f.imagery)
                .filter((img) => img?.healthScore)
                .map((img) => Number(img.healthScore));
            if (healthScores.length > 0) {
                averageHealthScore = Math.round(healthScores.reduce((a, b) => a + b, 0) / healthScores.length);
            }
        }
        const countriesExportedTo = ['US', 'CA', 'EU'];
        const field = producer.fields[0];
        return {
            id: producer.id,
            slug: generateFarmerSlug(producer.businessName),
            displayName: producer.businessName,
            photoUrl: null,
            region: `${producer.municipality}, ${producer.state}`,
            country: 'Mexico',
            countryFlag: getCountryFlag('MX'),
            story: null,
            mainCrops: producer.cropTypes || [],
            yearsOfExperience: null,
            certifications: producer.certifications?.map((c) => ({
                name: c.name,
                issuedBy: c.issuedBy,
                validUntil: c.expiresAt,
                badgeUrl: null,
            })) || [],
            stats: {
                totalLotsExported: totalLots,
                blockchainVerifiedLots,
                averageHealthScore,
                countriesExportedTo,
            },
            field: field
                ? {
                    name: field.name,
                    areaHectares: Number(field.areaHectares) || 0,
                    currentCrop: field.currentCrop,
                    centerLatitude: Number(field.centerLat) || 0,
                    centerLongitude: Number(field.centerLng) || 0,
                }
                : undefined,
        };
    }
    async getBatchTraceability(shortCode) {
        const link = await this.linkRepository.findByShortCode(shortCode);
        if (!link || !link.isActive) {
            return null;
        }
        await this.linkRepository.incrementViewCount(shortCode);
        const batch = await this.prisma.batch.findUnique({
            where: { id: link.batchId },
            include: {
                producer: {
                    include: {
                        fields: {
                            where: { status: 'ACTIVE' },
                            include: {
                                imagery: {
                                    orderBy: { captureDate: 'desc' },
                                    take: 1,
                                },
                            },
                            take: 1,
                        },
                    },
                },
                verificationStages: {
                    orderBy: { timestamp: 'asc' },
                },
                qualityCertificates: {
                    orderBy: { issuedAt: 'desc' },
                    take: 1,
                },
                transitSessions: {
                    orderBy: { createdAt: 'desc' },
                    take: 1,
                    include: {
                        locations: {
                            orderBy: { timestamp: 'desc' },
                            take: 1,
                        },
                    },
                },
                temperatureReadings: {
                    orderBy: { timestamp: 'desc' },
                    take: 50,
                },
                nfcSeals: {
                    include: {
                        verifications: {
                            orderBy: { verifiedAt: 'desc' },
                            take: 1,
                        },
                    },
                },
            },
        });
        if (!batch) {
            return null;
        }
        return this.buildPublicBatchResponse(batch, shortCode, link.publicUrl);
    }
    buildPublicBatchResponse(batch, shortCode, publicUrl) {
        const producer = batch.producer;
        const product = {
            name: getVarietyDisplayName(batch.variety),
            variety: batch.variety,
            origin: `${producer.municipality}, ${producer.state}`,
            originFlag: getCountryFlag('MX'),
            harvestDate: batch.harvestDate,
            weightKg: Number(batch.weightKg),
            destinationCountry: null,
        };
        const farmer = {
            id: producer.id,
            slug: generateFarmerSlug(producer.businessName),
            displayName: producer.businessName,
            photoUrl: null,
            region: `${producer.municipality}, ${producer.state}`,
        };
        const keyFacts = this.buildKeyFacts(batch);
        const verificationBadge = this.buildVerificationBadge(batch);
        const journey = this.buildJourneyTimeline(batch.verificationStages);
        const transit = this.buildTransitSummary(batch.transitSessions?.[0]);
        const coldChain = this.buildColdChainSummary(batch.temperatureReadings);
        const sealStatus = this.buildSealStatus(batch.nfcSeals);
        const fieldHealth = this.buildFieldHealthSummary(producer.fields?.[0]);
        const certificate = this.buildCertificateSummary(batch.qualityCertificates?.[0]);
        const shareInfo = {
            title: `${product.name} from ${farmer.displayName} - ${product.origin}`,
            description: `Verified traceability: Harvest ${batch.harvestDate.toLocaleDateString()}, ${product.weightKg}kg. Scan to see the complete journey.`,
            imageUrl: fieldHealth?.thumbnailUrl || null,
            url: publicUrl,
        };
        return {
            shortCode,
            product,
            farmer,
            keyFacts,
            verificationBadge,
            journey,
            transit,
            coldChain,
            sealStatus,
            fieldHealth,
            certificate,
            shareInfo,
        };
    }
    buildKeyFacts(batch) {
        const facts = [];
        facts.push({
            icon: '📅',
            label: 'Harvested',
            value: batch.harvestDate.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
            }),
        });
        if (batch.transitSessions?.[0]) {
            const session = batch.transitSessions[0];
            facts.push({
                icon: '🚚',
                label: 'Distance',
                value: `${Math.round(session.distanceTraveledKm || 0)} km`,
            });
        }
        if (batch.temperatureReadings?.length > 0) {
            const temps = batch.temperatureReadings.map((r) => Number(r.value));
            const avg = temps.reduce((a, b) => a + b, 0) / temps.length;
            facts.push({
                icon: '🌡️',
                label: 'Temp Range',
                value: `${Math.min(...temps).toFixed(1)}–${Math.max(...temps).toFixed(1)}°C`,
            });
        }
        const hasBlockchain = batch.qualityCertificates?.some((c) => c.hashOnChain) ||
            batch.stagesFinalizedHash;
        facts.push({
            icon: hasBlockchain ? '✅' : '⏳',
            label: 'Blockchain',
            value: hasBlockchain ? 'Verified' : 'Pending',
            highlight: hasBlockchain,
        });
        return facts;
    }
    buildVerificationBadge(batch) {
        const stages = batch.verificationStages || [];
        const approvedCount = stages.filter((s) => s.status === 'APPROVED').length;
        const totalStages = 5;
        const cert = batch.qualityCertificates?.[0];
        const hash = cert?.hashOnChain || batch.stagesFinalizedHash;
        if (approvedCount === totalStages && hash) {
            return {
                status: 'VERIFIED',
                label: 'Fully Verified by AgroBridge',
                blockchainHash: hash,
                blockchainUrl: hash ? `https://etherscan.io/tx/${hash}` : null,
            };
        }
        else if (approvedCount > 0) {
            return {
                status: 'PARTIAL',
                label: `${approvedCount}/${totalStages} Stages Verified`,
                blockchainHash: hash || null,
                blockchainUrl: null,
            };
        }
        return {
            status: 'PENDING',
            label: 'Verification in Progress',
            blockchainHash: null,
            blockchainUrl: null,
        };
    }
    buildJourneyTimeline(stages) {
        const stageOrder = ['HARVEST', 'PACKING', 'COLD_CHAIN', 'EXPORT', 'DELIVERY'];
        const stageNames = {
            HARVEST: 'Harvest',
            PACKING: 'Packing',
            COLD_CHAIN: 'Cold Chain',
            EXPORT: 'Export',
            DELIVERY: 'Delivery',
        };
        const stageMap = new Map(stages.map((s) => [s.stageType, s]));
        return stageOrder.map((type, index) => {
            const stage = stageMap.get(type);
            const previousStage = index > 0 ? stageMap.get(stageOrder[index - 1]) : null;
            let status;
            if (stage?.status === 'APPROVED') {
                status = 'COMPLETED';
            }
            else if (stage?.status === 'PENDING' || stage?.status === 'FLAGGED') {
                status = 'CURRENT';
            }
            else if (previousStage?.status === 'APPROVED' && !stage) {
                status = 'CURRENT';
            }
            else {
                status = 'PENDING';
            }
            return {
                name: stageNames[type],
                status,
                date: stage?.timestamp || null,
                location: stage?.location || null,
                actor: stage?.actorRole || null,
                icon: getStageIcon(type),
            };
        });
    }
    buildTransitSummary(session) {
        if (!session)
            return null;
        const lastLocation = session.locations?.[0];
        return {
            status: session.status,
            originName: session.originName,
            destinationName: session.destinationName,
            currentLocation: lastLocation?.address || null,
            distanceTraveledKm: Number(session.distanceTraveledKm) || 0,
            totalDistanceKm: Number(session.totalDistanceKm) || 0,
            progressPercent: session.totalDistanceKm
                ? Math.round((Number(session.distanceTraveledKm) / Number(session.totalDistanceKm)) * 100)
                : 0,
            estimatedArrival: session.estimatedArrival,
            lastUpdate: lastLocation?.timestamp || session.updatedAt,
            mapPreviewUrl: null,
        };
    }
    buildColdChainSummary(readings) {
        if (!readings || readings.length === 0)
            return null;
        const values = readings.map((r) => Number(r.value));
        const outOfRange = readings.filter((r) => r.isOutOfRange);
        const thresholds = readings[0];
        return {
            isCompliant: outOfRange.length === 0,
            minTemp: Math.min(...values),
            maxTemp: Math.max(...values),
            avgTemp: Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10,
            readingCount: readings.length,
            outOfRangeCount: outOfRange.length,
            thresholdMin: Number(thresholds.minThreshold) || 0,
            thresholdMax: Number(thresholds.maxThreshold) || 8,
            lastReading: readings[0]?.timestamp || null,
            chartData: readings
                .slice(0, 24)
                .reverse()
                .map((r) => ({
                timestamp: r.timestamp.toISOString(),
                value: Number(r.value),
            })),
        };
    }
    buildSealStatus(seals) {
        if (!seals || seals.length === 0) {
            return {
                status: 'NOT_APPLIED',
                label: 'No NFC seal applied',
                lastVerified: null,
                verificationCount: 0,
                integrityScore: 0,
            };
        }
        const seal = seals.reduce((latest, s) => !latest || (s.attachedAt && s.attachedAt > latest.attachedAt) ? s : latest, null);
        const latestVerification = seal.verifications?.[0];
        let status;
        let label;
        if (seal.status === 'TAMPERED' || seal.tamperIndicator !== 'NONE') {
            status = 'BROKEN';
            label = 'Seal integrity compromised';
        }
        else if (latestVerification?.isValid) {
            status = 'VERIFIED';
            label = 'Seal verified & intact';
        }
        else {
            status = 'INTACT';
            label = 'Seal applied';
        }
        return {
            status,
            label,
            lastVerified: latestVerification?.verifiedAt || null,
            verificationCount: seal.verifications?.length || 0,
            integrityScore: seal.status === 'TAMPERED' ? 0 : 100,
        };
    }
    buildFieldHealthSummary(field) {
        if (!field || !field.imagery?.length)
            return null;
        const latestImagery = field.imagery[0];
        const healthScore = Number(latestImagery.healthScore) || 0;
        return {
            healthScore,
            healthCategory: getHealthCategory(healthScore),
            ndviValue: Number(latestImagery.ndviValue) || 0,
            lastCaptureDate: latestImagery.captureDate,
            thumbnailUrl: latestImagery.ndviUrl || latestImagery.rgbUrl || null,
            trend: 'STABLE',
        };
    }
    buildCertificateSummary(cert) {
        if (!cert)
            return null;
        const now = new Date();
        const isValid = cert.validFrom <= now && cert.validTo >= now;
        return {
            grade: cert.grade,
            certifyingBody: cert.certifyingBody,
            validFrom: cert.validFrom,
            validTo: cert.validTo,
            isValid,
            pdfUrl: cert.pdfUrl,
            blockchainHash: cert.hashOnChain,
            blockchainUrl: cert.hashOnChain ? `https://etherscan.io/tx/${cert.hashOnChain}` : null,
        };
    }
    async recordScan(input) {
        const link = await this.linkRepository.findByShortCode(input.shortCode);
        if (!link) {
            logger.warn('Scan recorded for unknown short code', { shortCode: input.shortCode });
            return;
        }
        const event = {
            id: crypto.randomUUID(),
            shortCode: input.shortCode,
            timestamp: new Date(),
            country: input.country || null,
            city: input.city || null,
            deviceType: detectDeviceType(input.userAgent),
            browser: extractBrowser(input.userAgent),
            referrer: input.referrer || null,
            userAgent: input.userAgent || null,
        };
        await this.linkRepository.recordScan(event);
        logger.info('QR scan recorded', {
            shortCode: input.shortCode,
            country: event.country,
            deviceType: event.deviceType,
        });
    }
    async getScanAnalytics(batchId) {
        const link = await this.linkRepository.findByBatchId(batchId);
        if (!link) {
            return null;
        }
        return this.linkRepository.getAnalytics(link.shortCode, 30);
    }
}
import crypto from 'crypto';
