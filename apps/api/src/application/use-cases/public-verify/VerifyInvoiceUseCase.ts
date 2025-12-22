/**
 * Verify Invoice Use Case
 * Public verification of invoice authenticity via blockchain
 */

import { IInvoiceRepository } from '../../../domain/repositories/IInvoiceRepository.js';
import { Invoice, InvoiceStatus } from '../../../domain/entities/Invoice.js';
import { NotFoundError } from '../../../shared/errors/NotFoundError.js';

export interface VerifyInvoiceRequest {
  uuid: string;
}

export interface VerifyInvoiceResponse {
  invoice: {
    folio: string;
    uuid: string;
    status: string;
    total: number;
    currency: string;
    issuedAt: Date | null;
    recipientName: string;
  };
  producer?: {
    businessName: string;
    location: string;
  };
  blockchain: {
    verified: boolean;
    hash: string | null;
    txHash: string | null;
    network: string | null;
    timestamp: Date | null;
  };
  verification: {
    isAuthentic: boolean;
    status: 'VERIFIED' | 'PENDING' | 'NOT_REGISTERED';
    message: string;
    verifiedAt: Date;
  };
}

export class VerifyInvoiceUseCase {
  constructor(private readonly invoiceRepository: IInvoiceRepository) {}

  async execute(request: VerifyInvoiceRequest): Promise<VerifyInvoiceResponse> {
    const result = await this.invoiceRepository.findByUuidWithDetails(request.uuid);

    if (!result) {
      throw new NotFoundError('Invoice not found');
    }

    const { invoice, producer } = result;

    // Determine verification status
    let verificationStatus: 'VERIFIED' | 'PENDING' | 'NOT_REGISTERED' = 'NOT_REGISTERED';
    let message = 'Esta factura no está registrada en blockchain.';

    if (invoice.blockchainVerified && invoice.blockchainHash) {
      verificationStatus = 'VERIFIED';
      message = 'Esta factura está verificada en blockchain y es auténtica.';
    } else if (invoice.status === InvoiceStatus.BLOCKCHAIN_PENDING) {
      verificationStatus = 'PENDING';
      message = 'Esta factura está pendiente de verificación en blockchain.';
    }

    return {
      invoice: {
        folio: invoice.folio,
        uuid: invoice.uuid,
        status: invoice.status,
        total: invoice.total,
        currency: invoice.currency,
        issuedAt: invoice.issuedAt ?? null,
        recipientName: invoice.recipientName,
      },
      producer: producer
        ? {
            businessName: producer.businessName,
            location: `${producer.municipality}, ${producer.state}`,
          }
        : undefined,
      blockchain: {
        verified: invoice.blockchainVerified,
        hash: invoice.blockchainHash ?? null,
        txHash: invoice.blockchainTxHash ?? null,
        network: invoice.blockchainNetwork ?? null,
        timestamp: invoice.blockchainTimestamp ?? null,
      },
      verification: {
        isAuthentic: invoice.blockchainVerified,
        status: verificationStatus,
        message,
        verifiedAt: new Date(),
      },
    };
  }
}
