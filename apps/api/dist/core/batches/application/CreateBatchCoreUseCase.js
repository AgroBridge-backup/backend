import * as crypto from 'crypto';
/**
 * CreateBatchUseCase orchestrates the business logic for creating a new batch.
 * It ensures that all business rules are met before persisting the data.
 */
export class CreateBatchUseCase {
    batchRepository;
    constructor(batchRepository) {
        this.batchRepository = batchRepository;
    }
    /**
     * Executes the use case.
     * @param data The DTO containing the data for the new batch.
     * @returns A promise that resolves to the newly created batch.
     */
    async execute(data) {
        // 1. Zero-Trust Validation (can be expanded with a validation library like Zod)
        if (!data.producerId || !data.variety || !data.origin || data.weightKg <= 0) {
            throw new Error('Invalid batch data provided.'); // In a real app, use custom error classes
        }
        // 2. Blockchain-Ready Hashing (Cryptographic Traceability)
        const timestamp = Date.now();
        const payload = `${data.producerId}${timestamp}${data.variety}${data.weightKg}`;
        const blockchainHash = crypto.createHash('sha256').update(payload).digest('hex');
        // 3. Create the entity object
        const batchToSave = {
            producerId: data.producerId,
            variety: data.variety,
            origin: data.origin,
            weightKg: data.weightKg,
            harvestDate: data.harvestDate,
            blockchainHash: blockchainHash,
            // Dummy values for now to satisfy the Batch interface
            batchNumber: `BATCH-${Date.now()}`,
            cropType: 'Avocado', // Default value
            quantity: data.weightKg, // Assuming quantity is same as weight for now
            parcelName: 'Default Parcel',
            latitude: 0, // Default value
            longitude: 0, // Default value
            qrCode: null,
            nftTokenId: null,
        };
        // 4. Persist using the repository
        const newBatch = await this.batchRepository.save(batchToSave);
        // 5. Return the fully created entity
        return newBatch;
    }
}
