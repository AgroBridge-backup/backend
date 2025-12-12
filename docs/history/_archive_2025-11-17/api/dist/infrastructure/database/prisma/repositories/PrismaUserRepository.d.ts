import { PrismaClient } from '@prisma/client';
import { IUserRepository } from '@/domain/repositories/IUserRepository';
import { User } from '@/domain/entities/User';
/**
 * Prisma-based implementation of the user repository.
 * It directly uses the Prisma client to interact with the database.
 * The Prisma User model is structurally compatible with the domain User entity,
 * so no mapping is required.
 */
export declare class PrismaUserRepository implements IUserRepository {
    private readonly prisma;
    constructor(prismaClient: PrismaClient);
    /**
     * Finds a user by their unique ID.
     * @param id The ID of the user to find.
     * @returns A Promise resolving to the User entity or null if not found.
     */
    findById(id: string): Promise<User | null>;
    /**
     * Finds a user by their unique email address.
     * @param email The email of the user to find.
     * @returns A Promise resolving to the User entity or null if not found.
     */
    findByEmail(email: string): Promise<User | null>;
}
//# sourceMappingURL=PrismaUserRepository.d.ts.map