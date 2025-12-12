import { PrismaClient } from '@prisma/client';
import { encrypt, decrypt } from './utils/crypto';

const prisma = new PrismaClient();

// Middleware to encrypt the 'internalNotes' field of the 'Product' model
prisma.$use(async (params, next) => {
  if (params.model === 'Product' && (params.action === 'create' || params.action === 'update')) {
    if (params.args.data.internalNotes) {
      params.args.data.internalNotes = encrypt(params.args.data.internalNotes);
    }
  }
  return next(params);
});

// Middleware to decrypt the 'internalNotes' field when a 'Product' is found
// Note: This is a simplified example. In a real app, you'd need to handle various find actions
// like findMany, findFirst, etc., and recursively decrypt through relations if needed.
prisma.$use(async (params, next) => {
  const result = await next(params);
  if (params.model === 'Product' && (params.action === 'findUnique' || params.action === 'findFirst')) {
    if (result && result.internalNotes) {
      result.internalNotes = decrypt(result.internalNotes);
    }
  }
  // For findMany, you would loop through the results
  if (params.model === 'Product' && params.action === 'findMany') {
    if (Array.isArray(result)) {
      for (const item of result) {
        if (item.internalNotes) {
          item.internalNotes = decrypt(item.internalNotes);
        }
      }
    }
  }
  return result;
});

export default prisma;
