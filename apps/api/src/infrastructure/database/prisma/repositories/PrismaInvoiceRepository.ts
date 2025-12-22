/**
 * Prisma Invoice Repository Implementation
 * Implements IInvoiceRepository using Prisma ORM
 */

import { PrismaClient, InvoiceStatus as PrismaInvoiceStatus } from '@prisma/client';
import {
  IInvoiceRepository,
  CreateInvoiceData,
  UpdateInvoiceData,
} from '../../../../domain/repositories/IInvoiceRepository.js';
import { Invoice, InvoiceStatus, InvoiceFilter } from '../../../../domain/entities/Invoice.js';

export class PrismaInvoiceRepository implements IInvoiceRepository {
  constructor(private readonly prisma: PrismaClient) {}

  private mapToDomain(prismaInvoice: any): Invoice {
    return {
      id: prismaInvoice.id,
      userId: prismaInvoice.userId,
      producerId: prismaInvoice.producerId,
      buyerId: prismaInvoice.buyerId,
      batchId: prismaInvoice.batchId,
      folio: prismaInvoice.folio,
      uuid: prismaInvoice.uuid,
      serie: prismaInvoice.serie,
      subtotal: Number(prismaInvoice.subtotal),
      iva: Number(prismaInvoice.iva),
      ivaRate: Number(prismaInvoice.ivaRate),
      isr: Number(prismaInvoice.isr || 0),
      total: Number(prismaInvoice.total),
      currency: prismaInvoice.currency,
      exchangeRate: prismaInvoice.exchangeRate ? Number(prismaInvoice.exchangeRate) : null,
      recipientRfc: prismaInvoice.recipientRfc,
      recipientName: prismaInvoice.recipientName,
      recipientEmail: prismaInvoice.recipientEmail,
      pdfUrl: prismaInvoice.pdfUrl,
      xmlUrl: prismaInvoice.xmlUrl,
      qrCodeUrl: prismaInvoice.qrCodeUrl,
      cfdiSeal: prismaInvoice.cfdiSeal,
      satSeal: prismaInvoice.satSeal,
      certificateNumber: prismaInvoice.certificateNumber,
      satCertNumber: prismaInvoice.satCertNumber,
      stampDate: prismaInvoice.stampDate,
      blockchainHash: prismaInvoice.blockchainHash,
      blockchainTxHash: prismaInvoice.blockchainTxHash,
      blockchainNetwork: prismaInvoice.blockchainNetwork,
      blockchainVerified: prismaInvoice.blockchainVerified,
      blockchainTimestamp: prismaInvoice.blockchainTimestamp,
      status: prismaInvoice.status as InvoiceStatus,
      issuedAt: prismaInvoice.issuedAt,
      cancelledAt: prismaInvoice.cancelledAt,
      cancellationReason: prismaInvoice.cancellationReason,
      notes: prismaInvoice.notes,
      createdAt: prismaInvoice.createdAt,
      updatedAt: prismaInvoice.updatedAt,
    };
  }

  async create(data: CreateInvoiceData): Promise<Invoice> {
    const invoice = await this.prisma.invoice.create({
      data: {
        id: data.id,
        userId: data.userId,
        producerId: data.producerId,
        buyerId: data.buyerId,
        batchId: data.batchId,
        folio: data.folio,
        uuid: data.uuid,
        subtotal: data.subtotal,
        iva: data.iva,
        ivaRate: data.ivaRate,
        total: data.total,
        currency: data.currency,
        recipientRfc: data.recipientRfc,
        recipientName: data.recipientName,
        recipientEmail: data.recipientEmail,
        notes: data.notes,
        status: data.status as PrismaInvoiceStatus,
      },
    });
    return this.mapToDomain(invoice);
  }

  async findById(id: string): Promise<Invoice | null> {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id },
    });
    return invoice ? this.mapToDomain(invoice) : null;
  }

  async findByUuid(uuid: string): Promise<Invoice | null> {
    const invoice = await this.prisma.invoice.findUnique({
      where: { uuid },
    });
    return invoice ? this.mapToDomain(invoice) : null;
  }

  async findByFolio(folio: string): Promise<Invoice | null> {
    const invoice = await this.prisma.invoice.findUnique({
      where: { folio },
    });
    return invoice ? this.mapToDomain(invoice) : null;
  }

  async listByUser(userId: string, filter?: InvoiceFilter): Promise<Invoice[]> {
    const invoices = await this.prisma.invoice.findMany({
      where: {
        userId,
        ...(filter?.status && { status: filter.status as PrismaInvoiceStatus }),
        ...(filter?.fromDate && { createdAt: { gte: filter.fromDate } }),
        ...(filter?.toDate && { createdAt: { lte: filter.toDate } }),
      },
      orderBy: { createdAt: 'desc' },
      take: filter?.limit || 50,
      skip: filter?.offset || 0,
    });
    return invoices.map(this.mapToDomain);
  }

  async listByProducer(producerId: string, filter?: InvoiceFilter): Promise<Invoice[]> {
    const invoices = await this.prisma.invoice.findMany({
      where: {
        producerId,
        ...(filter?.status && { status: filter.status as PrismaInvoiceStatus }),
        ...(filter?.fromDate && { createdAt: { gte: filter.fromDate } }),
        ...(filter?.toDate && { createdAt: { lte: filter.toDate } }),
      },
      orderBy: { createdAt: 'desc' },
      take: filter?.limit || 50,
      skip: filter?.offset || 0,
    });
    return invoices.map(this.mapToDomain);
  }

  async update(id: string, data: UpdateInvoiceData): Promise<Invoice> {
    const invoice = await this.prisma.invoice.update({
      where: { id },
      data: {
        ...(data.uuid !== undefined && { uuid: data.uuid }),
        ...(data.pdfUrl !== undefined && { pdfUrl: data.pdfUrl }),
        ...(data.xmlUrl !== undefined && { xmlUrl: data.xmlUrl }),
        ...(data.qrCodeUrl !== undefined && { qrCodeUrl: data.qrCodeUrl }),
        ...(data.cfdiSeal !== undefined && { cfdiSeal: data.cfdiSeal }),
        ...(data.satSeal !== undefined && { satSeal: data.satSeal }),
        ...(data.satCertNumber !== undefined && { satCertNumber: data.satCertNumber }),
        ...(data.stampDate !== undefined && { stampDate: data.stampDate }),
        ...(data.blockchainHash !== undefined && { blockchainHash: data.blockchainHash }),
        ...(data.blockchainTxHash !== undefined && { blockchainTxHash: data.blockchainTxHash }),
        ...(data.blockchainNetwork !== undefined && { blockchainNetwork: data.blockchainNetwork }),
        ...(data.blockchainVerified !== undefined && { blockchainVerified: data.blockchainVerified }),
        ...(data.blockchainTimestamp !== undefined && { blockchainTimestamp: data.blockchainTimestamp }),
        ...(data.status !== undefined && { status: data.status as PrismaInvoiceStatus }),
        ...(data.issuedAt !== undefined && { issuedAt: data.issuedAt }),
        ...(data.cancelledAt !== undefined && { cancelledAt: data.cancelledAt }),
        ...(data.cancellationReason !== undefined && { cancellationReason: data.cancellationReason }),
      },
    });
    return this.mapToDomain(invoice);
  }

  async markAsPaid(id: string, paidAt: Date, txHash?: string): Promise<Invoice> {
    const invoice = await this.prisma.invoice.update({
      where: { id },
      data: {
        status: PrismaInvoiceStatus.VERIFIED,
        ...(txHash && { blockchainTxHash: txHash }),
        blockchainVerified: true,
        blockchainTimestamp: paidAt,
      },
    });
    return this.mapToDomain(invoice);
  }

  async cancel(id: string, reason: string): Promise<Invoice> {
    const invoice = await this.prisma.invoice.update({
      where: { id },
      data: {
        status: PrismaInvoiceStatus.CANCELLED,
        cancelledAt: new Date(),
        cancellationReason: reason,
      },
    });
    return this.mapToDomain(invoice);
  }

  async countByYear(year: number): Promise<number> {
    return this.prisma.invoice.count({
      where: {
        createdAt: {
          gte: new Date(`${year}-01-01`),
          lt: new Date(`${year + 1}-01-01`),
        },
      },
    });
  }

  async findByIdWithDetails(id: string): Promise<Invoice | null> {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id },
    });
    return invoice ? this.mapToDomain(invoice) : null;
  }

  async findByUuidWithDetails(uuid: string): Promise<{
    invoice: Invoice;
    producer?: { businessName: string; state: string; municipality: string };
  } | null> {
    const invoice = await this.prisma.invoice.findUnique({
      where: { uuid },
    });

    if (!invoice) return null;

    let producer = undefined;
    if (invoice.producerId) {
      const producerData = await this.prisma.producer.findUnique({
        where: { id: invoice.producerId },
        select: {
          businessName: true,
          state: true,
          municipality: true,
        },
      });
      if (producerData) {
        producer = producerData;
      }
    }

    return {
      invoice: this.mapToDomain(invoice),
      producer,
    };
  }
}
