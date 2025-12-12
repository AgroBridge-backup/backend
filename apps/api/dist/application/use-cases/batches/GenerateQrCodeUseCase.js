import { NotFoundError } from '../../../shared/errors/NotFoundError.js';
export class GenerateQrCodeUseCase {
    batchRepository;
    constructor(batchRepository) {
        this.batchRepository = batchRepository;
    }
    async execute(dto) {
        // Check batch exists
        const batch = await this.batchRepository.findById(dto.batchId);
        if (!batch) {
            throw new NotFoundError(`Batch with ID ${dto.batchId} not found.`);
        }
        // Generate QR code data (JSON structure)
        const qrData = {
            batchId: batch.id,
            variety: batch.variety,
            origin: batch.origin,
            harvestDate: batch.harvestDate,
            verifyUrl: `https://agrobridge.io/verify/${batch.id}`,
            blockchainHash: batch.blockchainHash,
        };
        // Generate QR code string (in production, use qrcode library to create actual image)
        const qrCodeString = Buffer.from(JSON.stringify(qrData)).toString('base64');
        // Format QR code URL (in production, upload to S3 and return actual URL)
        const qrCodeUrl = `https://api.agrobridge.io/qr/${batch.id}.png`;
        // Update batch with QR code
        await this.batchRepository.update(dto.batchId, {
            qrCode: qrCodeString,
        });
        return {
            batchId: dto.batchId,
            qrCode: qrCodeString,
            qrCodeUrl,
        };
    }
}
