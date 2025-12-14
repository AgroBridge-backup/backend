import * as crypto from 'crypto';
export class CreateBatchUseCase {
    batchRepository;
    constructor(batchRepository) {
        this.batchRepository = batchRepository;
    }
    async execute(data) {
        if (!data.producerId || !data.variety || !data.origin || data.weightKg <= 0) {
            throw new Error('Invalid batch data provided.');
        }
        const timestamp = Date.now();
        const payload = `${data.producerId}${timestamp}${data.variety}${data.weightKg}`;
        const blockchainHash = crypto.createHash('sha256').update(payload).digest('hex');
        const batchToSave = {
            producerId: data.producerId,
            variety: data.variety,
            origin: data.origin,
            weightKg: data.weightKg,
            harvestDate: data.harvestDate,
            blockchainHash: blockchainHash,
            batchNumber: `BATCH-${Date.now()}`,
            cropType: 'Avocado',
            quantity: data.weightKg,
            parcelName: 'Default Parcel',
            latitude: 0,
            longitude: 0,
            qrCode: null,
            nftTokenId: null,
        };
        const newBatch = await this.batchRepository.save(batchToSave);
        return newBatch;
    }
}
