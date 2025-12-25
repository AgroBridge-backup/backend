export class PrismaExportCompanyRepository {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    mapToDomain(prismaCompany) {
        return {
            id: prismaCompany.id,
            name: prismaCompany.name,
            legalName: prismaCompany.legalName,
            rfc: prismaCompany.rfc,
            email: prismaCompany.email,
            phone: prismaCompany.phone,
            country: prismaCompany.country,
            state: prismaCompany.state,
            city: prismaCompany.city,
            address: prismaCompany.address,
            postalCode: prismaCompany.postalCode,
            contactName: prismaCompany.contactName,
            contactEmail: prismaCompany.contactEmail,
            contactPhone: prismaCompany.contactPhone,
            tier: prismaCompany.tier,
            status: prismaCompany.status,
            trialEndsAt: prismaCompany.trialEndsAt,
            monthlyFee: Number(prismaCompany.monthlyFee),
            certificateFee: Number(prismaCompany.certificateFee),
            farmersIncluded: prismaCompany.farmersIncluded,
            certsIncluded: prismaCompany.certsIncluded,
            stripeCustomerId: prismaCompany.stripeCustomerId,
            stripeSubscriptionId: prismaCompany.stripeSubscriptionId,
            enabledStandards: prismaCompany.enabledStandards || [],
            logoUrl: prismaCompany.logoUrl,
            primaryColor: prismaCompany.primaryColor,
            createdAt: prismaCompany.createdAt,
            updatedAt: prismaCompany.updatedAt,
        };
    }
    async create(data) {
        const company = await this.prisma.exportCompany.create({
            data: {
                id: data.id,
                name: data.name,
                legalName: data.legalName,
                rfc: data.rfc,
                email: data.email,
                phone: data.phone,
                country: data.country,
                state: data.state,
                city: data.city,
                address: data.address,
                postalCode: data.postalCode,
                contactName: data.contactName,
                contactEmail: data.contactEmail,
                contactPhone: data.contactPhone,
                tier: data.tier,
                status: data.status,
                trialEndsAt: data.trialEndsAt,
                monthlyFee: data.monthlyFee,
                certificateFee: data.certificateFee,
                farmersIncluded: data.farmersIncluded,
                certsIncluded: data.certsIncluded,
                enabledStandards: data.enabledStandards,
                logoUrl: data.logoUrl,
                primaryColor: data.primaryColor,
            },
        });
        return this.mapToDomain(company);
    }
    async findById(id) {
        const company = await this.prisma.exportCompany.findUnique({
            where: { id },
        });
        return company ? this.mapToDomain(company) : null;
    }
    async findByRfc(rfc) {
        const company = await this.prisma.exportCompany.findUnique({
            where: { rfc },
        });
        return company ? this.mapToDomain(company) : null;
    }
    async findByEmail(email) {
        const company = await this.prisma.exportCompany.findUnique({
            where: { email },
        });
        return company ? this.mapToDomain(company) : null;
    }
    async findByStripeCustomerId(stripeCustomerId) {
        const company = await this.prisma.exportCompany.findUnique({
            where: { stripeCustomerId },
        });
        return company ? this.mapToDomain(company) : null;
    }
    async list(filter) {
        const where = {};
        if (filter?.status) {
            where.status = filter.status;
        }
        if (filter?.tier) {
            where.tier = filter.tier;
        }
        if (filter?.search) {
            where.OR = [
                { name: { contains: filter.search, mode: 'insensitive' } },
                { rfc: { contains: filter.search, mode: 'insensitive' } },
                { email: { contains: filter.search, mode: 'insensitive' } },
            ];
        }
        const [companies, total] = await Promise.all([
            this.prisma.exportCompany.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                take: filter?.limit || 50,
                skip: filter?.offset || 0,
            }),
            this.prisma.exportCompany.count({ where }),
        ]);
        return {
            companies: companies.map((c) => this.mapToDomain(c)),
            total,
        };
    }
    async update(id, data) {
        const updateData = {};
        if (data.name !== undefined)
            updateData.name = data.name;
        if (data.legalName !== undefined)
            updateData.legalName = data.legalName;
        if (data.email !== undefined)
            updateData.email = data.email;
        if (data.phone !== undefined)
            updateData.phone = data.phone;
        if (data.state !== undefined)
            updateData.state = data.state;
        if (data.city !== undefined)
            updateData.city = data.city;
        if (data.address !== undefined)
            updateData.address = data.address;
        if (data.postalCode !== undefined)
            updateData.postalCode = data.postalCode;
        if (data.contactName !== undefined)
            updateData.contactName = data.contactName;
        if (data.contactEmail !== undefined)
            updateData.contactEmail = data.contactEmail;
        if (data.contactPhone !== undefined)
            updateData.contactPhone = data.contactPhone;
        if (data.tier !== undefined)
            updateData.tier = data.tier;
        if (data.status !== undefined)
            updateData.status = data.status;
        if (data.trialEndsAt !== undefined)
            updateData.trialEndsAt = data.trialEndsAt;
        if (data.monthlyFee !== undefined)
            updateData.monthlyFee = data.monthlyFee;
        if (data.certificateFee !== undefined)
            updateData.certificateFee = data.certificateFee;
        if (data.farmersIncluded !== undefined)
            updateData.farmersIncluded = data.farmersIncluded;
        if (data.certsIncluded !== undefined)
            updateData.certsIncluded = data.certsIncluded;
        if (data.stripeCustomerId !== undefined)
            updateData.stripeCustomerId = data.stripeCustomerId;
        if (data.stripeSubscriptionId !== undefined)
            updateData.stripeSubscriptionId = data.stripeSubscriptionId;
        if (data.enabledStandards !== undefined)
            updateData.enabledStandards = data.enabledStandards;
        if (data.logoUrl !== undefined)
            updateData.logoUrl = data.logoUrl;
        if (data.primaryColor !== undefined)
            updateData.primaryColor = data.primaryColor;
        const company = await this.prisma.exportCompany.update({
            where: { id },
            data: updateData,
        });
        return this.mapToDomain(company);
    }
    async findByIdWithStats(id) {
        const company = await this.prisma.exportCompany.findUnique({
            where: { id },
            include: {
                _count: {
                    select: {
                        farmers: true,
                        organicCertificates: true,
                    },
                },
            },
        });
        if (!company)
            return null;
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        const monthlyStats = await this.prisma.organicCertificate.count({
            where: {
                exportCompanyId: id,
                createdAt: {
                    gte: startOfMonth,
                    lte: endOfMonth,
                },
            },
        });
        return {
            ...this.mapToDomain(company),
            farmerCount: company._count.farmers,
            certificateCount: company._count.organicCertificates,
            monthlyUsage: {
                certificates: monthlyStats,
                farmers: company._count.farmers,
            },
        };
    }
    async countFarmers(id) {
        return this.prisma.producer.count({
            where: { exportCompanyId: id },
        });
    }
    async countCertificatesInMonth(id, year, month) {
        const startOfMonth = new Date(year, month - 1, 1);
        const endOfMonth = new Date(year, month, 0);
        return this.prisma.organicCertificate.count({
            where: {
                exportCompanyId: id,
                createdAt: {
                    gte: startOfMonth,
                    lte: endOfMonth,
                },
            },
        });
    }
    async findExpiringTrials(daysUntilExpiry) {
        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + daysUntilExpiry);
        const companies = await this.prisma.exportCompany.findMany({
            where: {
                status: 'TRIAL',
                trialEndsAt: {
                    lte: expiryDate,
                    gte: new Date(),
                },
            },
            orderBy: { trialEndsAt: 'asc' },
        });
        return companies.map((c) => this.mapToDomain(c));
    }
    async activate(id, stripeCustomerId, stripeSubscriptionId) {
        const company = await this.prisma.exportCompany.update({
            where: { id },
            data: {
                status: 'ACTIVE',
                stripeCustomerId,
                stripeSubscriptionId,
                trialEndsAt: null,
            },
        });
        return this.mapToDomain(company);
    }
    async suspend(id) {
        const company = await this.prisma.exportCompany.update({
            where: { id },
            data: { status: 'SUSPENDED' },
        });
        return this.mapToDomain(company);
    }
    async cancel(id) {
        const company = await this.prisma.exportCompany.update({
            where: { id },
            data: {
                status: 'CANCELLED',
                stripeSubscriptionId: null,
            },
        });
        return this.mapToDomain(company);
    }
    async hasCapacityForFarmers(id) {
        const company = await this.prisma.exportCompany.findUnique({
            where: { id },
            include: {
                _count: {
                    select: { farmers: true },
                },
            },
        });
        if (!company)
            return false;
        if (company.farmersIncluded === -1)
            return true;
        return company._count.farmers < company.farmersIncluded;
    }
    async hasCapacityForCertificates(id) {
        const company = await this.prisma.exportCompany.findUnique({
            where: { id },
        });
        if (!company)
            return false;
        if (company.certsIncluded === -1)
            return true;
        const now = new Date();
        const monthlyCount = await this.countCertificatesInMonth(id, now.getFullYear(), now.getMonth() + 1);
        return monthlyCount < company.certsIncluded;
    }
}
