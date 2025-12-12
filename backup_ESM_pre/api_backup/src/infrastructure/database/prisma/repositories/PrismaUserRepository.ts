import * as Prisma from '@prisma/client';
import { IUserRepository } from '../../../../domain/repositories/IUserRepository.js';
import { User } from '../../../../domain/entities/User.js';

/**
 * Prisma-based implementation of the user repository.
 * It directly uses the Prisma client to interact with the database.
 * The Prisma User model is structurally compatible with the domain User entity,
 * so no mapping is required.
 */
export class PrismaUserRepository implements IUserRepository {
  private readonly prisma: Prisma.PrismaClient;

  constructor(prismaClient: Prisma.PrismaClient) {
    this.prisma = prismaClient;
  }

  /**
   * Finds a user by their unique ID.
   * @param id The ID of the user to find.
   * @returns A Promise resolving to the User entity or null if not found.
   */
  async findById(id: string): Promise<User | null> {
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
  async findByEmail(email: string, include?: { producer?: boolean }): Promise<User | null> {
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: {
        producer: include?.producer,
      },
    });
    if (!user) return null;

    // The 'toDomain' mapping for User needs to handle the optional producer relation
    const domainUser: User = {
      id: user.id,
      email: user.email,
      passwordHash: user.passwordHash,
      role: user.role,
      isActive: user.isActive,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      walletAddress: user.walletAddress,
    };

    if (user.producer) {
      domainUser.producer = {
        id: user.producer.id,
        businessName: user.producer.businessName,
        rfc: user.producer.rfc,
        // Map other producer fields if necessary
      };
    }

    return domainUser;
  }
}
