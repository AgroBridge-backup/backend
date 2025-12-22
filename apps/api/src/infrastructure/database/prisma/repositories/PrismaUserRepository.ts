import * as Prisma from '@prisma/client';
import { IUserRepository, CreateUserInput } from '../../../../domain/repositories/IUserRepository.js';
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
      // Two-Factor Authentication fields
      twoFactorEnabled: user.twoFactorEnabled,
      twoFactorSecret: user.twoFactorSecret,
      backupCodes: user.backupCodes,
      twoFactorEnabledAt: user.twoFactorEnabledAt,
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

  /**
   * Creates a new user in the database.
   * @param input The user data to create.
   * @returns A Promise resolving to the created User entity.
   */
  async create(input: CreateUserInput): Promise<User> {
    const user = await this.prisma.user.create({
      data: {
        id: input.id,
        email: input.email,
        passwordHash: input.passwordHash,
        firstName: input.firstName,
        lastName: input.lastName,
        role: input.role as Prisma.UserRole,
        isActive: input.isActive,
        createdAt: input.createdAt,
        updatedAt: input.updatedAt,
      },
    });

    return {
      id: user.id,
      email: user.email,
      passwordHash: user.passwordHash,
      role: user.role,
      isActive: user.isActive,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      walletAddress: user.walletAddress,
      twoFactorEnabled: user.twoFactorEnabled,
      twoFactorSecret: user.twoFactorSecret,
      backupCodes: user.backupCodes,
      twoFactorEnabledAt: user.twoFactorEnabledAt,
    };
  }
}
