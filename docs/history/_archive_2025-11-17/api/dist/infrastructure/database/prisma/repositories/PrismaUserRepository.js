/**
 * Prisma-based implementation of the user repository.
 * It directly uses the Prisma client to interact with the database.
 * The Prisma User model is structurally compatible with the domain User entity,
 * so no mapping is required.
 */
export class PrismaUserRepository {
    prisma;
    constructor(prismaClient) {
        this.prisma = prismaClient;
    }
    /**
     * Finds a user by their unique ID.
     * @param id The ID of the user to find.
     * @returns A Promise resolving to the User entity or null if not found.
     */
    async findById(id) {
        const user = await this.prisma.user.findUnique({
            where: { id },
        });
        return user;
    }
    /**
     * Finds a user by their unique email address.
     * @param email The email of the user to find.
     * @returns A Promise resolving to the User entity or null if not found.
     */
    async findByEmail(email) {
        const user = await this.prisma.user.findUnique({
            where: { email },
        });
        return user;
    }
}
//# sourceMappingURL=PrismaUserRepository.js.map