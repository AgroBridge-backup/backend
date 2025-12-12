import { Router, Request, Response } from 'express';
import { authenticate } from '../middlewares/auth.middleware.js';
import * as Prisma from '@prisma/client';

const certificatesRouter = Router();

certificatesRouter.post('/issue', authenticate([Prisma.UserRole.ADMIN, Prisma.UserRole.CERTIFIER]), (req: Request, res: Response) => {
  res.status(501).json({ message: 'Not Implemented: IssueCertificateUseCase not implemented.' });
});

certificatesRouter.get('/:id', authenticate(), (req: Request, res: Response) => {
  res.status(501).json({ message: 'Not Implemented: GetCertificateByIdUseCase not implemented.' });
});

certificatesRouter.post('/verify', (req: Request, res: Response) => {
    res.status(501).json({ message: 'Not Implemented: VerifyCertificateUseCase not implemented.' });
});

export { certificatesRouter };
