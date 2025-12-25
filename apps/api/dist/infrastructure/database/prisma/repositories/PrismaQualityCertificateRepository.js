export class PrismaQualityCertificateRepository {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    mapToDomain(certificate) {
        return {
            id: certificate.id,
            batchId: certificate.batchId,
            grade: certificate.grade,
            certifyingBody: certificate.certifyingBody,
            validFrom: certificate.validFrom,
            validTo: certificate.validTo,
            hashOnChain: certificate.hashOnChain,
            pdfUrl: certificate.pdfUrl,
            issuedAt: certificate.issuedAt,
            issuedBy: certificate.issuedBy,
            payloadSnapshot: certificate.payloadSnapshot,
            createdAt: certificate.createdAt,
            updatedAt: certificate.updatedAt,
        };
    }
    async findById(id) {
        const certificate = await this.prisma.qualityCertificate.findUnique({
            where: { id },
        });
        return certificate ? this.mapToDomain(certificate) : null;
    }
    async findByBatchId(batchId) {
        const certificates = await this.prisma.qualityCertificate.findMany({
            where: { batchId },
            orderBy: { issuedAt: 'desc' },
        });
        return certificates.map(this.mapToDomain);
    }
    async findByCertifyingBody(certifyingBody) {
        const certificates = await this.prisma.qualityCertificate.findMany({
            where: { certifyingBody },
            orderBy: { issuedAt: 'desc' },
        });
        return certificates.map(this.mapToDomain);
    }
    async findValidCertificates(batchId) {
        const now = new Date();
        const certificates = await this.prisma.qualityCertificate.findMany({
            where: {
                batchId,
                validFrom: { lte: now },
                validTo: { gte: now },
            },
            orderBy: { issuedAt: 'desc' },
        });
        return certificates.map(this.mapToDomain);
    }
    async create(input) {
        const certificate = await this.prisma.qualityCertificate.create({
            data: {
                batchId: input.batchId,
                grade: input.grade,
                certifyingBody: input.certifyingBody,
                validFrom: input.validFrom,
                validTo: input.validTo,
                issuedBy: input.issuedBy,
                hashOnChain: input.hashOnChain,
                pdfUrl: input.pdfUrl,
                payloadSnapshot: input.payloadSnapshot,
            },
        });
        return this.mapToDomain(certificate);
    }
    async updateHash(id, hashOnChain) {
        const certificate = await this.prisma.qualityCertificate.update({
            where: { id },
            data: { hashOnChain },
        });
        return this.mapToDomain(certificate);
    }
    async updatePdfUrl(id, pdfUrl) {
        const certificate = await this.prisma.qualityCertificate.update({
            where: { id },
            data: { pdfUrl },
        });
        return this.mapToDomain(certificate);
    }
    async countByBatch(batchId) {
        return this.prisma.qualityCertificate.count({
            where: { batchId },
        });
    }
    async hasValidCertificate(batchId, grade) {
        const now = new Date();
        const count = await this.prisma.qualityCertificate.count({
            where: {
                batchId,
                grade: grade,
                validFrom: { lte: now },
                validTo: { gte: now },
            },
        });
        return count > 0;
    }
}
