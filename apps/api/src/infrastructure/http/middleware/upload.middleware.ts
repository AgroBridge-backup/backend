/**
 * @file Upload Middleware
 * @description Multer configuration for file uploads
 *
 * @author AgroBridge Engineering Team
 */

import multer from "multer";
import { Request } from "express";
import { AppError } from "../../../shared/errors/AppError.js";

/**
 * Multer memory storage for buffer-based processing
 */
const storage = multer.memoryStorage();

/**
 * File filter for common upload types
 */
const imageFilter = (
  _req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback,
) => {
  const allowedMimes = [
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    "image/avif",
  ];

  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new AppError(
        `Invalid file type: ${file.mimetype}. Allowed: ${allowedMimes.join(", ")}`,
        400,
      ),
    );
  }
};

const documentFilter = (
  _req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback,
) => {
  const allowedMimes = [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "image/jpeg",
    "image/png",
  ];

  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new AppError(
        `Invalid file type: ${file.mimetype}. Allowed: ${allowedMimes.join(", ")}`,
        400,
      ),
    );
  }
};

/**
 * Image upload configuration
 * Max 10MB, images only
 */
export const uploadImage = multer({
  storage,
  fileFilter: imageFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
});

/**
 * Avatar upload configuration
 * Max 5MB, images only
 */
export const uploadAvatar = multer({
  storage,
  fileFilter: imageFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
});

/**
 * Document upload configuration
 * Max 25MB, documents and images
 */
export const uploadDocument = multer({
  storage,
  fileFilter: documentFilter,
  limits: {
    fileSize: 25 * 1024 * 1024, // 25MB
  },
});

/**
 * Certificate upload configuration
 * Max 10MB, PDFs and images
 */
export const uploadCertificate = multer({
  storage,
  fileFilter: documentFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
});

/**
 * General file upload configuration
 * Max 10MB, no type restriction (validation done in service)
 */
export const uploadGeneral = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
});
