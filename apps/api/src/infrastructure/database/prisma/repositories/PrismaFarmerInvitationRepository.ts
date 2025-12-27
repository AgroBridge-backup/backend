/**
 * Prisma FarmerInvitation Repository Implementation
 * Implements IFarmerInvitationRepository using Prisma ORM
 */

import {
  PrismaClient,
  FarmerInvitationStatus as PrismaStatus,
} from "@prisma/client";
import {
  IFarmerInvitationRepository,
  CreateFarmerInvitationData,
  FarmerInvitationListResult,
} from "../../../../domain/repositories/IFarmerInvitationRepository.js";
import {
  FarmerInvitation,
  FarmerInvitationFilter,
  FarmerInvitationStatus,
  FarmerInvitationWithCompany,
} from "../../../../domain/entities/FarmerInvitation.js";

export class PrismaFarmerInvitationRepository
  implements IFarmerInvitationRepository
{
  constructor(private readonly prisma: PrismaClient) {}

  private mapToDomain(prismaInvitation: any): FarmerInvitation {
    return {
      id: prismaInvitation.id,
      exportCompanyId: prismaInvitation.exportCompanyId,
      email: prismaInvitation.email,
      phone: prismaInvitation.phone,
      farmerName: prismaInvitation.farmerName,
      inviteToken: prismaInvitation.inviteToken,
      status: prismaInvitation.status as FarmerInvitationStatus,
      farmerId: prismaInvitation.farmerId,
      sentAt: prismaInvitation.sentAt,
      expiresAt: prismaInvitation.expiresAt,
      acceptedAt: prismaInvitation.acceptedAt,
      createdAt: prismaInvitation.createdAt,
    };
  }

  private mapToWithCompany(prismaInvitation: any): FarmerInvitationWithCompany {
    return {
      ...this.mapToDomain(prismaInvitation),
      exportCompany: {
        id: prismaInvitation.exportCompany.id,
        name: prismaInvitation.exportCompany.name,
        logoUrl: prismaInvitation.exportCompany.logoUrl,
        primaryColor: prismaInvitation.exportCompany.primaryColor,
      },
    };
  }

  async create(data: CreateFarmerInvitationData): Promise<FarmerInvitation> {
    const invitation = await this.prisma.farmerInvitation.create({
      data: {
        id: data.id,
        exportCompanyId: data.exportCompanyId,
        email: data.email.toLowerCase(),
        phone: data.phone,
        farmerName: data.farmerName,
        inviteToken: data.inviteToken,
        status: data.status as PrismaStatus,
        expiresAt: data.expiresAt,
      },
    });
    return this.mapToDomain(invitation);
  }

  async findById(id: string): Promise<FarmerInvitation | null> {
    const invitation = await this.prisma.farmerInvitation.findUnique({
      where: { id },
    });
    return invitation ? this.mapToDomain(invitation) : null;
  }

  async findByToken(
    token: string,
  ): Promise<FarmerInvitationWithCompany | null> {
    const invitation = await this.prisma.farmerInvitation.findUnique({
      where: { inviteToken: token },
      include: {
        exportCompany: {
          select: {
            id: true,
            name: true,
            logoUrl: true,
            primaryColor: true,
          },
        },
      },
    });
    return invitation ? this.mapToWithCompany(invitation) : null;
  }

  async findByEmailAndCompany(
    email: string,
    exportCompanyId: string,
  ): Promise<FarmerInvitation | null> {
    const invitation = await this.prisma.farmerInvitation.findFirst({
      where: {
        email: email.toLowerCase(),
        exportCompanyId,
      },
      orderBy: { createdAt: "desc" },
    });
    return invitation ? this.mapToDomain(invitation) : null;
  }

  async list(
    filter: FarmerInvitationFilter,
  ): Promise<FarmerInvitationListResult> {
    const where: any = {};

    if (filter.exportCompanyId) {
      where.exportCompanyId = filter.exportCompanyId;
    }
    if (filter.status) {
      where.status = filter.status as PrismaStatus;
    }
    if (filter.email) {
      where.email = {
        contains: filter.email.toLowerCase(),
        mode: "insensitive",
      };
    }

    const [invitations, total] = await Promise.all([
      this.prisma.farmerInvitation.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: filter.limit || 50,
        skip: filter.offset || 0,
      }),
      this.prisma.farmerInvitation.count({ where }),
    ]);

    return {
      invitations: invitations.map((i) => this.mapToDomain(i)),
      total,
    };
  }

  async listByCompany(
    exportCompanyId: string,
    filter?: Omit<FarmerInvitationFilter, "exportCompanyId">,
  ): Promise<FarmerInvitationListResult> {
    return this.list({ ...filter, exportCompanyId });
  }

  async accept(id: string, farmerId: string): Promise<FarmerInvitation> {
    const invitation = await this.prisma.farmerInvitation.update({
      where: { id },
      data: {
        status: "ACCEPTED",
        farmerId,
        acceptedAt: new Date(),
      },
    });
    return this.mapToDomain(invitation);
  }

  async cancel(id: string): Promise<FarmerInvitation> {
    const invitation = await this.prisma.farmerInvitation.update({
      where: { id },
      data: { status: "CANCELLED" },
    });
    return this.mapToDomain(invitation);
  }

  async markExpired(): Promise<number> {
    const result = await this.prisma.farmerInvitation.updateMany({
      where: {
        status: "PENDING",
        expiresAt: { lt: new Date() },
      },
      data: { status: "EXPIRED" },
    });
    return result.count;
  }

  async resend(
    id: string,
    newToken: string,
    newExpiresAt: Date,
  ): Promise<FarmerInvitation> {
    const invitation = await this.prisma.farmerInvitation.update({
      where: { id },
      data: {
        inviteToken: newToken,
        expiresAt: newExpiresAt,
        sentAt: new Date(),
        status: "PENDING",
      },
    });
    return this.mapToDomain(invitation);
  }

  async countPending(exportCompanyId: string): Promise<number> {
    return this.prisma.farmerInvitation.count({
      where: {
        exportCompanyId,
        status: "PENDING",
      },
    });
  }

  async hasPendingInvitation(
    email: string,
    exportCompanyId: string,
  ): Promise<boolean> {
    const count = await this.prisma.farmerInvitation.count({
      where: {
        email: email.toLowerCase(),
        exportCompanyId,
        status: "PENDING",
      },
    });
    return count > 0;
  }
}
