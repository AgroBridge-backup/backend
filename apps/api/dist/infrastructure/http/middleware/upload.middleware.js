import multer from 'multer';
import { AppError } from '../../../shared/errors/AppError.js';
const storage = multer.memoryStorage();
const imageFilter = (_req, file, cb) => {
    const allowedMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/avif'];
    if (allowedMimes.includes(file.mimetype)) {
        cb(null, true);
    }
    else {
        cb(new AppError(`Invalid file type: ${file.mimetype}. Allowed: ${allowedMimes.join(', ')}`, 400));
    }
};
const documentFilter = (_req, file, cb) => {
    const allowedMimes = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'image/jpeg',
        'image/png',
    ];
    if (allowedMimes.includes(file.mimetype)) {
        cb(null, true);
    }
    else {
        cb(new AppError(`Invalid file type: ${file.mimetype}. Allowed: ${allowedMimes.join(', ')}`, 400));
    }
};
export const uploadImage = multer({
    storage,
    fileFilter: imageFilter,
    limits: {
        fileSize: 10 * 1024 * 1024,
    },
});
export const uploadAvatar = multer({
    storage,
    fileFilter: imageFilter,
    limits: {
        fileSize: 5 * 1024 * 1024,
    },
});
export const uploadDocument = multer({
    storage,
    fileFilter: documentFilter,
    limits: {
        fileSize: 25 * 1024 * 1024,
    },
});
export const uploadCertificate = multer({
    storage,
    fileFilter: documentFilter,
    limits: {
        fileSize: 10 * 1024 * 1024,
    },
});
export const uploadGeneral = multer({
    storage,
    limits: {
        fileSize: 10 * 1024 * 1024,
    },
});
