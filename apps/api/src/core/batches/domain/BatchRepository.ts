import { Batch } from "../../../domain/entities/Batch.js";

/**
 * The BatchRepository interface defines the contract for persistence operations
 * related to the Batch entity. This allows the application layer to be
 * independent of the specific database technology.
 */
export interface BatchRepository {
  /**
   * Saves a new batch to the persistence layer.
   * @param batch The batch entity to save.
   * @returns A promise that resolves to the saved batch.
   */
  save(
    batch: Omit<Batch, "id" | "createdAt" | "updatedAt" | "status"> & {
      producerId: string;
    },
  ): Promise<Batch>;

  /**
   * Finds a batch by its unique ID.
   * @param id The ID of the batch to find.
   * @returns A promise that resolves to the found batch or null if not found.
   */
  findById(id: string): Promise<Batch | null>;

  /**
   * Finds all batches associated with a specific producer.
   * @param producerId The ID of the producer.
   * @returns A promise that resolves to an array of batches.
   */
  findAllByProducerId(producerId: string): Promise<Batch[]>;
}
