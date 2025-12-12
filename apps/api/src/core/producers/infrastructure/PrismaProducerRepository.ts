import { PrismaClient, Prisma } from '@prisma/client';
import { Producer } from '@/domain/entities/Producer.js';
import { IProducerRepository, ProducerList, FindProducersCriteria } from '@/domain/repositories/IProducerRepository.js';
import { User } from '@/domain/entities/User.js';

type ProducerWithUser = Prisma.ProducerGetPayload<{
  include: { user: true };
}>;

export class PrismaProducerRepository implements IProducerRepository {
  constructor(private prisma: Prisma.PrismaClient) {}

  async findById(id: string): Promise<Producer | null> {
    const producer = await this.prisma.producer.findUnique({
      where: { id },
      include: { user: true },
    });
    if (!producer) return null;
    return this.toDomain(producer);
  }

  async find(criteria: FindProducersCriteria): Promise<ProducerList> {
    // FIX: Defensively parse pagination params to integers
    const page = criteria.page ? parseInt(criteria.page.toString(), 10) : 1;
    const limit = criteria.limit ? parseInt(criteria.limit.toString(), 10) : 10;
    const { isWhitelisted, state } = criteria;

    const where: Prisma.ProducerWhereInput = {};
    if (isWhitelisted !== undefined) {
      where.isWhitelisted = isWhitelisted === true || isWhitelisted === 'true';
    }
    if (state) {
      where.state = {
        equals: state,
        mode: 'insensitive',
      };
    }

    try {
      const [total, producersData] = await Promise.all([
        this.prisma.producer.count({ where }),
        this.prisma.producer.findMany({
          where,
          skip: (page - 1) * limit,
          take: limit,
          orderBy: {
            createdAt: 'desc',
          },
          include: {
            user: true,
          },
        }),
      ]);

      return {
        producers: producersData.map(this.toDomain),
        total,
      };
    } catch (error) {
      throw error;
    }
  }
  
  async save(producer: Producer): Promise<Producer> {
    const savedProducer = await this.prisma.producer.create({
      data: {
        id: producer.id,
        businessName: producer.businessName,
        rfc: producer.rfc,
        state: producer.state,
        municipality: producer.municipality,
        isWhitelisted: producer.isWhitelisted,
        userId: producer.userId,
        latitude: producer.latitude,
        longitude: producer.longitude,
      },
      include: { user: true },
    });
    return this.toDomain(savedProducer);
  }

  private toDomain(prismaProducer: ProducerWithUser): Producer {
    const user: User = {
        id: prismaProducer.user.id,
        email: prismaProducer.user.email,
        passwordHash: prismaProducer.user.passwordHash,
        role: prismaProducer.user.role,
        isActive: prismaProducer.user.isActive,
        createdAt: prismaProducer.user.createdAt,
        updatedAt: prismaProducer.user.updatedAt,
        walletAddress: prismaProducer.user.walletAddress,
    };
    
    return {
      id: prismaProducer.id,
      userId: prismaProducer.userId,
      businessName: prismaProducer.businessName,
      rfc: prismaProducer.rfc,
      state: prismaProducer.state,
      municipality: prismaProducer.municipality,
      isWhitelisted: prismaProducer.isWhitelisted,
      whitelistedAt: prismaProducer.whitelistedAt,
      createdAt: prismaProducer.createdAt,
      updatedAt: prismaProducer.updatedAt,
      // FIX: Defensive mapping for potentially null decimal values
      latitude: prismaProducer.latitude ? prismaProducer.latitude.toNumber() : 0,
      longitude: prismaProducer.longitude ? prismaProducer.longitude.toNumber() : 0,
      user: user,
    };
  }
}