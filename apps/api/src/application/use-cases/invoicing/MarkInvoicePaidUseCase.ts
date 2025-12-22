/**
 * Mark Invoice Paid Use Case
 * Marks an invoice as paid with optional blockchain transaction hash
 */

import { IInvoiceRepository } from '../../../domain/repositories/IInvoiceRepository.js';
import { Invoice, InvoiceStatus } from '../../../domain/entities/Invoice.js';
import { NotFoundError } from '../../../shared/errors/NotFoundError.js';
import { ValidationError } from '../../../shared/errors/ValidationError.js';
import { ILogger } from '../../../domain/services/ILogger.js';

export interface MarkInvoicePaidRequest {
  invoiceId: string;
  userId?: string; // For ownership validation
  blockchainTxHash?: string;
  paidAt?: Date;
}

export interface MarkInvoicePaidResponse {
  invoice: Invoice;
  message: string;
}

export class MarkInvoicePaidUseCase {
  constructor(
    private readonly invoiceRepository: IInvoiceRepository,
    private readonly logger?: ILogger
  ) {}

  async execute(request: MarkInvoicePaidRequest): Promise<MarkInvoicePaidResponse> {
    if (!request.invoiceId) {
      throw new ValidationError('Invoice ID is required');
    }

    const existingInvoice = await this.invoiceRepository.findById(request.invoiceId);

    if (!existingInvoice) {
      throw new NotFoundError('Invoice not found');
    }

    // Ownership check
    if (request.userId && existingInvoice.userId !== request.userId) {
      throw new NotFoundError('Invoice not found');
    }

    // Idempotency: if already paid/verified, return success
    if (existingInvoice.status === InvoiceStatus.VERIFIED) {
      this.logger?.info('Invoice already marked as paid', { invoiceId: request.invoiceId });
      return {
        invoice: existingInvoice,
        message: 'Invoice already paid',
      };
    }

    // Check valid status for marking as paid
    if (
      existingInvoice.status !== InvoiceStatus.ISSUED &&
      existingInvoice.status !== InvoiceStatus.BLOCKCHAIN_PENDING
    ) {
      throw new ValidationError(
        `Cannot mark invoice as paid with status: ${existingInvoice.status}`
      );
    }

    const paidAt = request.paidAt || new Date();

    this.logger?.info('Marking invoice as paid', {
      invoiceId: request.invoiceId,
      blockchainTxHash: request.blockchainTxHash,
    });

    const invoice = await this.invoiceRepository.markAsPaid(
      request.invoiceId,
      paidAt,
      request.blockchainTxHash
    );

    this.logger?.info('Invoice marked as paid successfully', {
      invoiceId: invoice.id,
      folio: invoice.folio,
    });

    return {
      invoice,
      message: 'Invoice marked as paid successfully',
    };
  }
}
