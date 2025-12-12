import { Router, Request, Response } from 'express';
import { authenticate } from '../middlewares/auth.middleware.js';
import * as Prisma from '@prisma/client';

const exportsRouter = Router();

exportsRouter.post('/', authenticate([Prisma.UserRole.ADMIN, Prisma.UserRole.PRODUCER]), (req: Request, res: Response) => {
  res.status(501).json({ message: 'Not Implemented: CreateExportUseCase not implemented.' });
});

exportsRouter.get('/:exportId', authenticate([Prisma.UserRole.ADMIN, Prisma.UserRole.PRODUCER]), (req: Request, res: Response) => {
  res.status(501).json({ message: 'Not Implemented: GetExportDetailsUseCase not implemented.' });
});

export { exportsRouter };
