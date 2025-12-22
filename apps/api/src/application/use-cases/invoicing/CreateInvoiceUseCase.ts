/**
 * Create Invoice Use Case
 * Creates a new CFDI invoice with optional blockchain registration
 */

import { randomUUID } from 'crypto';
import { IInvoiceRepository } from '../../../domain/repositories/IInvoiceRepository.js';
import { Invoice, InvoiceStatus, CreateInvoiceInput, InvoiceLineItem } from '../../../domain/entities/Invoice.js';
import { ValidationError } from '../../../shared/errors/ValidationError.js';
import { ILogger } from '../../../domain/services/ILogger.js';

export interface CreateInvoiceRequest {
  userId: string;
  producerId?: string;
  batchId?: string;
  recipientRfc: string;
  recipientName: string;
  recipientEmail?: string;
  lineItems: InvoiceLineItem[];
  notes?: string;
  currency?: string;
  ivaRate?: number;
}

export interface CreateInvoiceResponse {
  invoice: Invoice;
  message: string;
}

export class CreateInvoiceUseCase {
  constructor(
    private readonly invoiceRepository: IInvoiceRepository,
    private readonly logger?: ILogger
  ) {}

  async execute(request: CreateInvoiceRequest): Promise<CreateInvoiceResponse> {
    // Validate required fields
    if (!request.userId) {
      throw new ValidationError('userId is required');
    }
    if (!request.recipientRfc || request.recipientRfc.length < 12) {
      throw new ValidationError('Valid RFC is required (12-13 characters)');
    }
    if (!request.recipientName) {
      throw new ValidationError('Recipient name is required');
    }
    if (!request.lineItems || request.lineItems.length === 0) {
      throw new ValidationError('At least one line item is required');
    }

    // Validate line items
    for (const item of request.lineItems) {
      if (!item.description || !item.quantity || !item.unitPrice) {
        throw new ValidationError('Line items must have description, quantity, and unitPrice');
      }
    }

    // Calculate totals
    const subtotal = request.lineItems.reduce(
      (sum, item) => sum + item.quantity * item.unitPrice,
      0
    );
    const ivaRate = request.ivaRate ?? 16;
    const iva = subtotal * (ivaRate / 100);
    const total = subtotal + iva;

    // Generate folio
    const year = new Date().getFullYear();
    const count = await this.invoiceRepository.countByYear(year);
    const folio = `AB-${year}-${String(count + 1).padStart(6, '0')}`;

    // Generate temporary UUID (will be replaced by SAT stamp)
    const tempUuid = randomUUID();
    const invoiceId = randomUUID();

    this.logger?.info('Creating invoice', {
      userId: request.userId,
      folio,
      total,
      currency: request.currency || 'MXN',
    });

    // Create invoice
    const invoice = await this.invoiceRepository.create({
      id: invoiceId,
      userId: request.userId,
      producerId: request.producerId,
      batchId: request.batchId,
      folio,
      uuid: tempUuid,
      subtotal,
      iva,
      ivaRate,
      total,
      currency: request.currency || 'MXN',
      recipientRfc: request.recipientRfc.toUpperCase().trim(),
      recipientName: request.recipientName.trim(),
      recipientEmail: request.recipientEmail?.trim(),
      notes: request.notes,
      status: InvoiceStatus.DRAFT,
    });

    this.logger?.info('Invoice created successfully', {
      invoiceId: invoice.id,
      folio: invoice.folio,
    });

    return {
      invoice,
      message: 'Invoice created successfully',
    };
  }
}
