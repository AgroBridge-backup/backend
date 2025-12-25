/**
 * Prisma OrganicField Repository Implementation
 * Implements IOrganicFieldRepository using Prisma ORM
 */

import {
  PrismaClient,
  OrganicFieldStatus as PrismaStatus,
  CertificationType,
} from '@prisma/client';
import {
  IOrganicFieldRepository,
  CreateOrganicFieldData,
  UpdateOrganicFieldData,
  OrganicFieldListResult,
} from '../../../../domain/repositories/IOrganicFieldRepository.js';
import {
  OrganicField,
  OrganicFieldFilter,
  OrganicFieldStatus,
  OrganicFieldWithStats,
  ORGANIC_TRANSITION_MONTHS,
} from '../../../../domain/entities/OrganicField.js';

export class PrismaOrganicFieldRepository implements IOrganicFieldRepository {
  constructor(private readonly prisma: PrismaClient) {}

  private mapToDomain(prismaField: any): OrganicField {
    return {
      id: prismaField.id,
      baseFieldId: prismaField.baseFieldId,
      producerId: prismaField.producerId,
      name: prismaField.name,
      localIdentifier: prismaField.localIdentifier,
      cropType: prismaField.cropType,
      variety: prismaField.variety,
      areaHectares: Number(prismaField.areaHectares),
      boundaryGeoJson: prismaField.boundaryGeoJson,
      centerLat: Number(prismaField.centerLat),
      centerLng: Number(prismaField.centerLng),
      altitude: prismaField.altitude ? Number(prismaField.altitude) : null,
      organicSince: prismaField.organicSince,
      lastConventional: prismaField.lastConventional,
      transitionEndDate: prismaField.transitionEndDate,
      certificationStatus: prismaField.certificationStatus as OrganicFieldStatus,
      certifiedStandards: prismaField.certifiedStandards || [],
      waterSources: prismaField.waterSources || [],
      irrigationType: prismaField.irrigationType,
      soilType: prismaField.soilType,
      lastSoilTestDate: prismaField.lastSoilTestDate,
      isActive: prismaField.isActive,
      createdAt: prismaField.createdAt,
      updatedAt: prismaField.updatedAt,
    };
  }

  async create(data: CreateOrganicFieldData): Promise<OrganicField> {
    const field = await this.prisma.organicField.create({
      data: {
        id: data.id,
        producerId: data.producerId,
        baseFieldId: data.baseFieldId,
        name: data.name,
        localIdentifier: data.localIdentifier,
        cropType: data.cropType,
        variety: data.variety,
        areaHectares: data.areaHectares,
        boundaryGeoJson: data.boundaryGeoJson,
        centerLat: data.centerLat,
        centerLng: data.centerLng,
        altitude: data.altitude,
        organicSince: data.organicSince,
        lastConventional: data.lastConventional,
        transitionEndDate: data.transitionEndDate,
        certificationStatus: data.certificationStatus as PrismaStatus,
        certifiedStandards: data.certifiedStandards as CertificationType[],
        waterSources: data.waterSources,
        irrigationType: data.irrigationType,
        soilType: data.soilType,
        lastSoilTestDate: data.lastSoilTestDate,
      },
    });
    return this.mapToDomain(field);
  }

  async findById(id: string): Promise<OrganicField | null> {
    const field = await this.prisma.organicField.findUnique({
      where: { id },
    });
    return field ? this.mapToDomain(field) : null;
  }

  async findByBaseFieldId(baseFieldId: string): Promise<OrganicField | null> {
    const field = await this.prisma.organicField.findUnique({
      where: { baseFieldId },
    });
    return field ? this.mapToDomain(field) : null;
  }

  async list(filter: OrganicFieldFilter): Promise<OrganicFieldListResult> {
    const where: any = {};

    if (filter.producerId) {
      where.producerId = filter.producerId;
    }
    if (filter.certificationStatus) {
      where.certificationStatus = filter.certificationStatus as PrismaStatus;
    }
    if (filter.cropType) {
      where.cropType = filter.cropType;
    }
    if (filter.isActive !== undefined) {
      where.isActive = filter.isActive;
    }

    const [fields, total] = await Promise.all([
      this.prisma.organicField.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: filter.limit || 50,
        skip: filter.offset || 0,
      }),
      this.prisma.organicField.count({ where }),
    ]);

    return {
      fields: fields.map((f) => this.mapToDomain(f)),
      total,
    };
  }

  async listByProducer(
    producerId: string,
    filter?: Omit<OrganicFieldFilter, 'producerId'>
  ): Promise<OrganicFieldListResult> {
    return this.list({ ...filter, producerId });
  }

  async update(id: string, data: UpdateOrganicFieldData): Promise<OrganicField> {
    const updateData: any = {};

    if (data.name !== undefined) updateData.name = data.name;
    if (data.localIdentifier !== undefined) updateData.localIdentifier = data.localIdentifier;
    if (data.cropType !== undefined) updateData.cropType = data.cropType;
    if (data.variety !== undefined) updateData.variety = data.variety;
    if (data.areaHectares !== undefined) updateData.areaHectares = data.areaHectares;
    if (data.boundaryGeoJson !== undefined) updateData.boundaryGeoJson = data.boundaryGeoJson;
    if (data.centerLat !== undefined) updateData.centerLat = data.centerLat;
    if (data.centerLng !== undefined) updateData.centerLng = data.centerLng;
    if (data.altitude !== undefined) updateData.altitude = data.altitude;
    if (data.organicSince !== undefined) updateData.organicSince = data.organicSince;
    if (data.lastConventional !== undefined) updateData.lastConventional = data.lastConventional;
    if (data.transitionEndDate !== undefined) updateData.transitionEndDate = data.transitionEndDate;
    if (data.certificationStatus !== undefined) {
      updateData.certificationStatus = data.certificationStatus as PrismaStatus;
    }
    if (data.certifiedStandards !== undefined) {
      updateData.certifiedStandards = data.certifiedStandards as CertificationType[];
    }
    if (data.waterSources !== undefined) updateData.waterSources = data.waterSources;
    if (data.irrigationType !== undefined) updateData.irrigationType = data.irrigationType;
    if (data.soilType !== undefined) updateData.soilType = data.soilType;
    if (data.lastSoilTestDate !== undefined) updateData.lastSoilTestDate = data.lastSoilTestDate;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;

    const field = await this.prisma.organicField.update({
      where: { id },
      data: updateData,
    });

    return this.mapToDomain(field);
  }

  async findByIdWithStats(id: string): Promise<OrganicFieldWithStats | null> {
    const field = await this.prisma.organicField.findUnique({
      where: { id },
      include: {
        inspections: {
          orderBy: { inspectionDate: 'desc' },
          take: 1,
          select: { inspectionDate: true },
        },
        _count: {
          select: { inspections: true },
        },
      },
    });

    if (!field) return null;

    const lastInspectionDate = field.inspections[0]?.inspectionDate || null;
    const daysSinceLastInspection = lastInspectionDate
      ? Math.floor((Date.now() - lastInspectionDate.getTime()) / (1000 * 60 * 60 * 24))
      : null;

    // Calculate transition progress if applicable
    let transitionProgress: number | null = null;
    if (field.certificationStatus === 'TRANSITIONAL' && field.organicSince) {
      const monthsSinceStart = Math.floor(
        (Date.now() - field.organicSince.getTime()) / (1000 * 60 * 60 * 24 * 30)
      );
      transitionProgress = Math.min(
        Math.round((monthsSinceStart / ORGANIC_TRANSITION_MONTHS) * 100),
        100
      );
    }

    return {
      ...this.mapToDomain(field),
      inspectionCount: field._count.inspections,
      lastInspectionDate,
      daysSinceLastInspection,
      transitionProgress,
    };
  }

  async updateCertificationStatus(id: string, status: OrganicFieldStatus): Promise<OrganicField> {
    const field = await this.prisma.organicField.update({
      where: { id },
      data: { certificationStatus: status as PrismaStatus },
    });
    return this.mapToDomain(field);
  }

  async addCertifiedStandard(id: string, standard: string): Promise<OrganicField> {
    const field = await this.prisma.organicField.findUnique({ where: { id } });
    if (!field) throw new Error('Field not found');

    const currentStandards = field.certifiedStandards || [];
    if (!currentStandards.includes(standard as CertificationType)) {
      const updated = await this.prisma.organicField.update({
        where: { id },
        data: {
          certifiedStandards: [...currentStandards, standard as CertificationType],
        },
      });
      return this.mapToDomain(updated);
    }

    return this.mapToDomain(field);
  }

  async removeCertifiedStandard(id: string, standard: string): Promise<OrganicField> {
    const field = await this.prisma.organicField.findUnique({ where: { id } });
    if (!field) throw new Error('Field not found');

    const currentStandards = field.certifiedStandards || [];
    const updated = await this.prisma.organicField.update({
      where: { id },
      data: {
        certifiedStandards: currentStandards.filter((s) => s !== standard),
      },
    });

    return this.mapToDomain(updated);
  }

  async deactivate(id: string): Promise<OrganicField> {
    const field = await this.prisma.organicField.update({
      where: { id },
      data: { isActive: false },
    });
    return this.mapToDomain(field);
  }

  async countByProducer(producerId: string): Promise<number> {
    return this.prisma.organicField.count({
      where: { producerId, isActive: true },
    });
  }

  async getFieldsReadyForCertification(): Promise<OrganicField[]> {
    const now = new Date();
    const fields = await this.prisma.organicField.findMany({
      where: {
        certificationStatus: 'TRANSITIONAL',
        transitionEndDate: { lte: now },
        isActive: true,
      },
    });
    return fields.map((f) => this.mapToDomain(f));
  }

  async getFieldsWithExpiringCertification(daysUntilExpiry: number): Promise<OrganicField[]> {
    // This would need a certificationExpiryDate field to be fully implemented
    // For now, return empty array
    return [];
  }

  async isPointWithinBoundary(fieldId: string, lat: number, lng: number): Promise<boolean> {
    const field = await this.prisma.organicField.findUnique({
      where: { id: fieldId },
      select: { boundaryGeoJson: true },
    });

    if (!field) return false;

    try {
      // Parse GeoJSON and check if point is within polygon
      const boundary = JSON.parse(field.boundaryGeoJson);
      return this.pointInPolygon([lng, lat], boundary.coordinates[0]);
    } catch {
      return false;
    }
  }

  async getTotalHectaresByProducer(producerId: string): Promise<number> {
    const result = await this.prisma.organicField.aggregate({
      where: { producerId, isActive: true },
      _sum: { areaHectares: true },
    });
    return Number(result._sum.areaHectares || 0);
  }

  // Ray-casting algorithm to check if point is in polygon
  private pointInPolygon(point: [number, number], polygon: [number, number][]): boolean {
    const [x, y] = point;
    let inside = false;

    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const [xi, yi] = polygon[i];
      const [xj, yj] = polygon[j];

      const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;

      if (intersect) inside = !inside;
    }

    return inside;
  }
}
