/**
 * Traceability 2.0 - Blockchain Quality Certificates
 * Prisma Repository Implementation for QualityCertificate
 */

import { PrismaClient, CertificateGrade as PrismaCertificateGrade } from '@prisma/client';
import { IQualityCertificateRepository } from '../../../../domain/repositories/IQualityCertificateRepository.js';
import {
  QualityCertificate,
  CreateCertificateInput,
  CertificateGrade,
} from '../../../../domain/entities/QualityCertificate.js';

export class PrismaQualityCertificateRepository implements IQualityCertificateRepository {
  constructor(private prisma: PrismaClient) {}

  private mapToDomain(certificate: any): QualityCertificate {
    return {
      id: certificate.id,
      batchId: certificate.batchId,
      grade: certificate.grade as CertificateGrade,
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

  async findById(id: string): Promise<QualityCertificate | null> {
    const certificate = await this.prisma.qualityCertificate.findUnique({
      where: { id },
    });
    return certificate ? this.mapToDomain(certificate) : null;
  }

  async findByBatchId(batchId: string): Promise<QualityCertificate[]> {
    const certificates = await this.prisma.qualityCertificate.findMany({
      where: { batchId },
      orderBy: { issuedAt: 'desc' },
    });
    return certificates.map(this.mapToDomain);
  }

  async findByCertifyingBody(certifyingBody: string): Promise<QualityCertificate[]> {
    const certificates = await this.prisma.qualityCertificate.findMany({
      where: { certifyingBody },
      orderBy: { issuedAt: 'desc' },
    });
    return certificates.map(this.mapToDomain);
  }

  async findValidCertificates(batchId: string): Promise<QualityCertificate[]> {
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

  async create(input: CreateCertificateInput & {
    hashOnChain?: string;
    pdfUrl?: string;
    payloadSnapshot?: string;
  }): Promise<QualityCertificate> {
    const certificate = await this.prisma.qualityCertificate.create({
      data: {
        batchId: input.batchId,
        grade: input.grade as PrismaCertificateGrade,
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

  async updateHash(id: string, hashOnChain: string): Promise<QualityCertificate> {
    const certificate = await this.prisma.qualityCertificate.update({
      where: { id },
      data: { hashOnChain },
    });
    return this.mapToDomain(certificate);
  }

  async updatePdfUrl(id: string, pdfUrl: string): Promise<QualityCertificate> {
    const certificate = await this.prisma.qualityCertificate.update({
      where: { id },
      data: { pdfUrl },
    });
    return this.mapToDomain(certificate);
  }

  async countByBatch(batchId: string): Promise<number> {
    return this.prisma.qualityCertificate.count({
      where: { batchId },
    });
  }

  async hasValidCertificate(batchId: string, grade: CertificateGrade): Promise<boolean> {
    const now = new Date();
    const count = await this.prisma.qualityCertificate.count({
      where: {
        batchId,
        grade: grade as PrismaCertificateGrade,
        validFrom: { lte: now },
        validTo: { gte: now },
      },
    });
    return count > 0;
  }
}
