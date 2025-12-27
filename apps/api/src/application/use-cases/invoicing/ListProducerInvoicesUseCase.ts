/**
 * List Producer Invoices Use Case
 * Lists invoices for the authenticated producer
 */

import { IInvoiceRepository } from "../../../domain/repositories/IInvoiceRepository.js";
import {
  Invoice,
  InvoiceFilter,
  InvoiceStatus,
} from "../../../domain/entities/Invoice.js";
import { ValidationError } from "../../../shared/errors/ValidationError.js";

export interface ListProducerInvoicesRequest {
  userId: string;
  status?: InvoiceStatus;
  fromDate?: Date;
  toDate?: Date;
  limit?: number;
  offset?: number;
}

export interface ListProducerInvoicesResponse {
  invoices: Invoice[];
  total: number;
}

export class ListProducerInvoicesUseCase {
  constructor(private readonly invoiceRepository: IInvoiceRepository) {}

  async execute(
    request: ListProducerInvoicesRequest,
  ): Promise<ListProducerInvoicesResponse> {
    if (!request.userId) {
      throw new ValidationError("userId is required");
    }

    const filter: InvoiceFilter = {
      status: request.status,
      fromDate: request.fromDate,
      toDate: request.toDate,
      limit: request.limit || 50,
      offset: request.offset || 0,
    };

    const invoices = await this.invoiceRepository.listByUser(
      request.userId,
      filter,
    );

    return {
      invoices,
      total: invoices.length,
    };
  }
}
