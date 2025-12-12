import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware.js';
import * as Prisma from '@prisma/client';
const certificatesRouter = Router();
certificatesRouter.post('/issue', authenticate([Prisma.UserRole.ADMIN, Prisma.UserRole.CERTIFIER]), (req, res) => {
    res.status(501).json({ message: 'Not Implemented: IssueCertificateUseCase not implemented.' });
});
certificatesRouter.get('/:id', authenticate(), (req, res) => {
    res.status(501).json({ message: 'Not Implemented: GetCertificateByIdUseCase not implemented.' });
});
certificatesRouter.post('/verify', (req, res) => {
    res.status(501).json({ message: 'Not Implemented: VerifyCertificateUseCase not implemented.' });
});
export { certificatesRouter };
