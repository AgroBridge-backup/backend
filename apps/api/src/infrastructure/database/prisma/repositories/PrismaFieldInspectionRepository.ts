/**
 * Prisma FieldInspection Repository Implementation
 * Implements IFieldInspectionRepository using Prisma ORM
 */

import {
  PrismaClient,
  InspectionType as PrismaInspectionType,
} from "@prisma/client";
import {
  IFieldInspectionRepository,
  CreateFieldInspectionData,
  CreateInspectionPhotoData,
  CreateOrganicInputData,
  CreateFieldActivityData,
  FieldInspectionListResult,
} from "../../../../domain/repositories/IFieldInspectionRepository.js";
import {
  FieldInspection,
  FieldInspectionWithDetails,
  FieldInspectionFilter,
  InspectionPhoto,
  OrganicInput,
  FieldActivity,
  InspectionType,
} from "../../../../domain/entities/FieldInspection.js";

export class PrismaFieldInspectionRepository
  implements IFieldInspectionRepository
{
  constructor(private readonly prisma: PrismaClient) {}

  private mapInspectionToDomain(prismaInspection: any): FieldInspection {
    return {
      id: prismaInspection.id,
      fieldId: prismaInspection.fieldId,
      inspectorId: prismaInspection.inspectorId,
      inspectorName: prismaInspection.inspectorName,
      inspectorRole: prismaInspection.inspectorRole,
      inspectionType: prismaInspection.inspectionType as InspectionType,
      inspectionDate: prismaInspection.inspectionDate,
      duration: prismaInspection.duration,
      inspectorLat: prismaInspection.inspectorLat
        ? Number(prismaInspection.inspectorLat)
        : null,
      inspectorLng: prismaInspection.inspectorLng
        ? Number(prismaInspection.inspectorLng)
        : null,
      gpsAccuracy: prismaInspection.gpsAccuracy
        ? Number(prismaInspection.gpsAccuracy)
        : null,
      gpsVerified: prismaInspection.gpsVerified,
      weatherCondition: prismaInspection.weatherCondition,
      temperature: prismaInspection.temperature
        ? Number(prismaInspection.temperature)
        : null,
      notes: prismaInspection.notes,
      issues: prismaInspection.issues,
      recommendations: prismaInspection.recommendations,
      isVerified: prismaInspection.isVerified,
      verifiedBy: prismaInspection.verifiedBy,
      verifiedAt: prismaInspection.verifiedAt,
      createdAt: prismaInspection.createdAt,
      updatedAt: prismaInspection.updatedAt,
    };
  }

  private mapPhotoToDomain(prismaPhoto: any): InspectionPhoto {
    return {
      id: prismaPhoto.id,
      inspectionId: prismaPhoto.inspectionId,
      imageUrl: prismaPhoto.imageUrl,
      thumbnailUrl: prismaPhoto.thumbnailUrl,
      latitude: prismaPhoto.latitude ? Number(prismaPhoto.latitude) : null,
      longitude: prismaPhoto.longitude ? Number(prismaPhoto.longitude) : null,
      altitude: prismaPhoto.altitude ? Number(prismaPhoto.altitude) : null,
      capturedAt: prismaPhoto.capturedAt,
      caption: prismaPhoto.caption,
      photoType: prismaPhoto.photoType,
      withinFieldBoundary: prismaPhoto.withinFieldBoundary,
      distanceFromField: prismaPhoto.distanceFromField
        ? Number(prismaPhoto.distanceFromField)
        : null,
      createdAt: prismaPhoto.createdAt,
    };
  }

  private mapInputToDomain(prismaInput: any): OrganicInput {
    return {
      id: prismaInput.id,
      inspectionId: prismaInput.inspectionId,
      productName: prismaInput.productName,
      brandName: prismaInput.brandName,
      manufacturer: prismaInput.manufacturer,
      inputType: prismaInput.inputType,
      isOmriListed: prismaInput.isOmriListed,
      isOrganicApproved: prismaInput.isOrganicApproved,
      certificationNumber: prismaInput.certificationNumber,
      receiptUrl: prismaInput.receiptUrl,
      receiptDate: prismaInput.receiptDate,
      quantity: prismaInput.quantity,
      supplier: prismaInput.supplier,
      ocrExtractedData: prismaInput.ocrExtractedData,
      ocrConfidence: prismaInput.ocrConfidence
        ? Number(prismaInput.ocrConfidence)
        : null,
      verificationStatus: prismaInput.verificationStatus,
      verifiedBy: prismaInput.verifiedBy,
      verifiedAt: prismaInput.verifiedAt,
      rejectionReason: prismaInput.rejectionReason,
      createdAt: prismaInput.createdAt,
    };
  }

  private mapActivityToDomain(prismaActivity: any): FieldActivity {
    return {
      id: prismaActivity.id,
      inspectionId: prismaActivity.inspectionId,
      activityType: prismaActivity.activityType,
      description: prismaActivity.description,
      activityDate: prismaActivity.activityDate,
      duration: prismaActivity.duration,
      areaCovered: prismaActivity.areaCovered
        ? Number(prismaActivity.areaCovered)
        : null,
      workerCount: prismaActivity.workerCount,
      notes: prismaActivity.notes,
      createdAt: prismaActivity.createdAt,
    };
  }

  async create(data: CreateFieldInspectionData): Promise<FieldInspection> {
    const inspection = await this.prisma.fieldInspection.create({
      data: {
        id: data.id,
        fieldId: data.fieldId,
        inspectorId: data.inspectorId,
        inspectorName: data.inspectorName,
        inspectorRole: data.inspectorRole,
        inspectionType: data.inspectionType as PrismaInspectionType,
        inspectionDate: data.inspectionDate,
        duration: data.duration,
        inspectorLat: data.inspectorLat,
        inspectorLng: data.inspectorLng,
        gpsAccuracy: data.gpsAccuracy,
        gpsVerified: data.gpsVerified,
        weatherCondition: data.weatherCondition,
        temperature: data.temperature,
        notes: data.notes,
        issues: data.issues,
        recommendations: data.recommendations,
      },
    });
    return this.mapInspectionToDomain(inspection);
  }

  async findById(id: string): Promise<FieldInspection | null> {
    const inspection = await this.prisma.fieldInspection.findUnique({
      where: { id },
    });
    return inspection ? this.mapInspectionToDomain(inspection) : null;
  }

  async findByIdWithDetails(
    id: string,
  ): Promise<FieldInspectionWithDetails | null> {
    const inspection = await this.prisma.fieldInspection.findUnique({
      where: { id },
      include: {
        photos: true,
        organicInputs: true,
        activities: true,
      },
    });

    if (!inspection) return null;

    return {
      ...this.mapInspectionToDomain(inspection),
      photos: inspection.photos.map((p) => this.mapPhotoToDomain(p)),
      organicInputs: inspection.organicInputs.map((i) =>
        this.mapInputToDomain(i),
      ),
      activities: inspection.activities.map((a) => this.mapActivityToDomain(a)),
    };
  }

  async list(
    filter: FieldInspectionFilter,
  ): Promise<FieldInspectionListResult> {
    const where: any = {};

    if (filter.fieldId) where.fieldId = filter.fieldId;
    if (filter.inspectorId) where.inspectorId = filter.inspectorId;
    if (filter.inspectionType)
      where.inspectionType = filter.inspectionType as PrismaInspectionType;
    if (filter.isVerified !== undefined) where.isVerified = filter.isVerified;
    if (filter.fromDate || filter.toDate) {
      where.inspectionDate = {};
      if (filter.fromDate) where.inspectionDate.gte = filter.fromDate;
      if (filter.toDate) where.inspectionDate.lte = filter.toDate;
    }

    const [inspections, total] = await Promise.all([
      this.prisma.fieldInspection.findMany({
        where,
        orderBy: { inspectionDate: "desc" },
        take: filter.limit || 50,
        skip: filter.offset || 0,
      }),
      this.prisma.fieldInspection.count({ where }),
    ]);

    return {
      inspections: inspections.map((i) => this.mapInspectionToDomain(i)),
      total,
    };
  }

  async listByField(
    fieldId: string,
    filter?: Omit<FieldInspectionFilter, "fieldId">,
  ): Promise<FieldInspectionListResult> {
    return this.list({ ...filter, fieldId });
  }

  async updateNotes(
    id: string,
    notes?: string,
    issues?: string,
    recommendations?: string,
  ): Promise<FieldInspection> {
    const inspection = await this.prisma.fieldInspection.update({
      where: { id },
      data: {
        ...(notes !== undefined && { notes }),
        ...(issues !== undefined && { issues }),
        ...(recommendations !== undefined && { recommendations }),
      },
    });
    return this.mapInspectionToDomain(inspection);
  }

  async verify(id: string, verifiedBy: string): Promise<FieldInspection> {
    const inspection = await this.prisma.fieldInspection.update({
      where: { id },
      data: {
        isVerified: true,
        verifiedBy,
        verifiedAt: new Date(),
      },
    });
    return this.mapInspectionToDomain(inspection);
  }

  async addPhoto(data: CreateInspectionPhotoData): Promise<InspectionPhoto> {
    const photo = await this.prisma.inspectionPhoto.create({
      data: {
        id: data.id,
        inspectionId: data.inspectionId,
        imageUrl: data.imageUrl,
        thumbnailUrl: data.thumbnailUrl,
        latitude: data.latitude,
        longitude: data.longitude,
        altitude: data.altitude,
        capturedAt: data.capturedAt,
        caption: data.caption,
        photoType: data.photoType,
        withinFieldBoundary: data.withinFieldBoundary,
        distanceFromField: data.distanceFromField,
      },
    });
    return this.mapPhotoToDomain(photo);
  }

  async addOrganicInput(data: CreateOrganicInputData): Promise<OrganicInput> {
    const input = await this.prisma.organicInput.create({
      data: {
        id: data.id,
        inspectionId: data.inspectionId,
        productName: data.productName,
        brandName: data.brandName,
        manufacturer: data.manufacturer,
        inputType: data.inputType,
        isOmriListed: data.isOmriListed,
        isOrganicApproved: data.isOrganicApproved,
        certificationNumber: data.certificationNumber,
        receiptUrl: data.receiptUrl,
        receiptDate: data.receiptDate,
        quantity: data.quantity,
        supplier: data.supplier,
        ocrExtractedData: data.ocrExtractedData,
        ocrConfidence: data.ocrConfidence,
        verificationStatus: data.verificationStatus,
      },
    });
    return this.mapInputToDomain(input);
  }

  async addActivity(data: CreateFieldActivityData): Promise<FieldActivity> {
    const activity = await this.prisma.fieldActivity.create({
      data: {
        id: data.id,
        inspectionId: data.inspectionId,
        activityType: data.activityType,
        description: data.description,
        activityDate: data.activityDate,
        duration: data.duration,
        areaCovered: data.areaCovered,
        workerCount: data.workerCount,
        notes: data.notes,
      },
    });
    return this.mapActivityToDomain(activity);
  }

  async getPhotos(inspectionId: string): Promise<InspectionPhoto[]> {
    const photos = await this.prisma.inspectionPhoto.findMany({
      where: { inspectionId },
      orderBy: { capturedAt: "asc" },
    });
    return photos.map((p) => this.mapPhotoToDomain(p));
  }

  async getOrganicInputs(inspectionId: string): Promise<OrganicInput[]> {
    const inputs = await this.prisma.organicInput.findMany({
      where: { inspectionId },
      orderBy: { createdAt: "asc" },
    });
    return inputs.map((i) => this.mapInputToDomain(i));
  }

  async getActivities(inspectionId: string): Promise<FieldActivity[]> {
    const activities = await this.prisma.fieldActivity.findMany({
      where: { inspectionId },
      orderBy: { activityDate: "asc" },
    });
    return activities.map((a) => this.mapActivityToDomain(a));
  }

  async verifyOrganicInput(
    inputId: string,
    verifiedBy: string,
    approved: boolean,
    rejectionReason?: string,
  ): Promise<OrganicInput> {
    const input = await this.prisma.organicInput.update({
      where: { id: inputId },
      data: {
        verificationStatus: approved ? "VERIFIED" : "REJECTED",
        verifiedBy,
        verifiedAt: new Date(),
        rejectionReason: approved ? null : rejectionReason,
      },
    });
    return this.mapInputToDomain(input);
  }

  async countByField(fieldId: string): Promise<number> {
    return this.prisma.fieldInspection.count({ where: { fieldId } });
  }

  async getLastInspectionDate(fieldId: string): Promise<Date | null> {
    const inspection = await this.prisma.fieldInspection.findFirst({
      where: { fieldId },
      orderBy: { inspectionDate: "desc" },
      select: { inspectionDate: true },
    });
    return inspection?.inspectionDate || null;
  }

  async getFieldInspectionStats(fieldId: string): Promise<{
    total: number;
    verified: number;
    unverified: number;
    byType: Record<InspectionType, number>;
    lastInspectionDate: Date | null;
  }> {
    const [total, verified, lastDate, byTypeResult] = await Promise.all([
      this.prisma.fieldInspection.count({ where: { fieldId } }),
      this.prisma.fieldInspection.count({
        where: { fieldId, isVerified: true },
      }),
      this.getLastInspectionDate(fieldId),
      this.prisma.fieldInspection.groupBy({
        by: ["inspectionType"],
        where: { fieldId },
        _count: true,
      }),
    ]);

    const byType: Record<InspectionType, number> = {
      [InspectionType.ROUTINE]: 0,
      [InspectionType.PRE_CERTIFICATION]: 0,
      [InspectionType.AUDIT]: 0,
      [InspectionType.COMPLAINT]: 0,
    };

    for (const item of byTypeResult) {
      byType[item.inspectionType as InspectionType] = item._count;
    }

    return {
      total,
      verified,
      unverified: total - verified,
      byType,
      lastInspectionDate: lastDate,
    };
  }
}
