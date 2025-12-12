import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware.js';
import * as Prisma from '@prisma/client';
const blockchainRouter = Router();
blockchainRouter.post('/submit', authenticate([Prisma.UserRole.ADMIN]), (req, res) => {
    res.status(501).json({ message: 'Not Implemented: SubmitToBlockchainUseCase not implemented.' });
});
blockchainRouter.get('/transaction/:txId', authenticate([Prisma.UserRole.ADMIN]), (req, res) => {
    res.status(501).json({ message: 'Not Implemented: GetTransactionStatusUseCase not implemented.' });
});
export { blockchainRouter };
