import { requireAuth, isAdmin } from '../context.js';
import { NotFoundError, ForbiddenError } from '../errors.js';
export const certificationMutations = {
    addCertification: async (_parent, args, context) => {
        requireAuth(context);
        const producer = await context.loaders.producer.load(args.input.producerId);
        if (!producer) {
            throw new NotFoundError('Producer', args.input.producerId);
        }
        if (!isAdmin(context) && producer.userId !== context.user.id) {
            throw new ForbiddenError('You can only add certifications to your own producer profile');
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
            message: 'Certification added successfully',
            certification,
        };
    },
};
export const certificationFieldResolvers = {
    Certification: {
        producer: async (parent, _args, context) => {
            return context.loaders.producer.load(parent.producerId);
        },
    },
};
