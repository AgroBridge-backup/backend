import { NotFoundError } from '../../../shared/errors/NotFoundError.js';
export class GetInvoiceUseCase {
    invoiceRepository;
    constructor(invoiceRepository) {
        this.invoiceRepository = invoiceRepository;
    }
    async execute(request) {
        const invoice = await this.invoiceRepository.findById(request.invoiceId);
        if (!invoice) {
            throw new NotFoundError('Invoice not found');
        }
        if (request.userId && invoice.userId !== request.userId) {
            throw new NotFoundError('Invoice not found');
        }
        return { invoice };
    }
}
