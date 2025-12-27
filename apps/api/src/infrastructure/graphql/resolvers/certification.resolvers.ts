/**
 * @file Certification GraphQL Resolvers
 * @description Resolvers for Certification mutations
 *
 * @author AgroBridge Engineering Team
 */

import { Certification, CertificationType } from "@prisma/client";
import {
  GraphQLContext,
  requireAuth,
  requireRole,
  isAdmin,
} from "../context.js";
import { NotFoundError, ForbiddenError } from "../errors.js";

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface AddCertificationInput {
  producerId: string;
  type: CertificationType;
  certifier: string;
  certificateNumber: string;
  issuedAt: Date;
  expiresAt: Date;
}

// ═══════════════════════════════════════════════════════════════════════════════
// MUTATION RESOLVERS
// ═══════════════════════════════════════════════════════════════════════════════

export const certificationMutations = {
  addCertification: async (
    _parent: unknown,
    args: { input: AddCertificationInput },
    context: GraphQLContext,
  ) => {
    requireAuth(context);

    // Verify producer exists
    const producer = await context.loaders.producer.load(args.input.producerId);
    if (!producer) {
      throw new NotFoundError("Producer", args.input.producerId);
    }

    // Check authorization - only admin or the producer themselves can add certifications
    if (!isAdmin(context) && producer.userId !== context.user.id) {
      throw new ForbiddenError(
        "You can only add certifications to your own producer profile",
      );
    }

    const certification = await context.prisma.certification.create({
      data: {
        producerId: args.input.producerId,
        type: args.input.type,
        certifier: args.input.certifier,
        certificateNumber: args.input.certificateNumber,
        issuedAt: args.input.issuedAt,
        expiresAt: args.input.expiresAt,
      },
    });

    return {
      success: true,
      message: "Certification added successfully",
      certification,
    };
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// FIELD RESOLVERS
// ═══════════════════════════════════════════════════════════════════════════════

export const certificationFieldResolvers = {
  Certification: {
    producer: async (
      parent: Certification,
      _args: unknown,
      context: GraphQLContext,
    ) => {
      return context.loaders.producer.load(parent.producerId);
    },
  },
};
