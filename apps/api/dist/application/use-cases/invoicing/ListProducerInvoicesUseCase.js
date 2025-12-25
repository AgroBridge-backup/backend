import { ValidationError } from '../../../shared/errors/ValidationError.js';
export class ListProducerInvoicesUseCase {
    invoiceRepository;
    constructor(invoiceRepository) {
        this.invoiceRepository = invoiceRepository;
    }
    async execute(request) {
        if (!request.userId) {
            throw new ValidationError('userId is required');
        }
        const filter = {
            status: request.status,
            fromDate: request.fromDate,
            toDate: request.toDate,
            limit: request.limit || 50,
            offset: request.offset || 0,
        };
        const invoices = await this.invoiceRepository.listByUser(request.userId, filter);
        return {
            invoices,
            total: invoices.length,
        };
    }
}
