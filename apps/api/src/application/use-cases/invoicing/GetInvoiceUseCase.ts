/**
 * Get Invoice Use Case
 * Retrieves invoice details by ID
 */

import { IInvoiceRepository } from '../../../domain/repositories/IInvoiceRepository.js';
import { Invoice } from '../../../domain/entities/Invoice.js';
import { NotFoundError } from '../../../shared/errors/NotFoundError.js';

export interface GetInvoiceRequest {
  invoiceId: string;
  userId?: string; // For ownership validation
}

export interface GetInvoiceResponse {
  invoice: Invoice;
}

export class GetInvoiceUseCase {
  constructor(private readonly invoiceRepository: IInvoiceRepository) {}

  async execute(request: GetInvoiceRequest): Promise<GetInvoiceResponse> {
    const invoice = await this.invoiceRepository.findById(request.invoiceId);

    if (!invoice) {
      throw new NotFoundError('Invoice not found');
    }

    // Ownership check if userId provided
    if (request.userId && invoice.userId !== request.userId) {
      throw new NotFoundError('Invoice not found');
    }

    return { invoice };
  }
}
