/**
 * @file File Validator Service
 * @description Validates uploaded files for type, size, and security
 *
 * Features:
 * - MIME type validation
 * - File size limits
 * - Magic number verification
 * - Malicious content detection
 * - Extension whitelist
 *
 * @author AgroBridge Engineering Team
 */

import logger from "../../shared/utils/logger.js";

/**
 * File validation options
 */
export interface FileValidationOptions {
  allowedMimeTypes?: string[];
  maxSizeBytes?: number;
  minSizeBytes?: number;
  allowedExtensions?: string[];
  validateMagicNumber?: boolean;
}

/**
 * File validation result
 */
export interface FileValidationResult {
  valid: boolean;
  errors: string[];
  sanitizedFilename?: string;
  detectedMimeType?: string;
}

/**
 * Predefined file type configurations
 */
export const FileTypeConfig: Record<string, FileValidationOptions> = {
  IMAGE: {
    allowedMimeTypes: [
      "image/jpeg",
      "image/png",
      "image/gif",
      "image/webp",
      "image/avif",
    ],
    allowedExtensions: [".jpg", ".jpeg", ".png", ".gif", ".webp", ".avif"],
    maxSizeBytes: 10 * 1024 * 1024, // 10MB
    minSizeBytes: 100, // 100 bytes (prevent empty files)
  },
  DOCUMENT: {
    allowedMimeTypes: [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ],
    allowedExtensions: [".pdf", ".doc", ".docx", ".xls", ".xlsx"],
    maxSizeBytes: 25 * 1024 * 1024, // 25MB
    minSizeBytes: 100,
  },
  CERTIFICATE: {
    allowedMimeTypes: ["application/pdf", "image/jpeg", "image/png"],
    allowedExtensions: [".pdf", ".jpg", ".jpeg", ".png"],
    maxSizeBytes: 10 * 1024 * 1024, // 10MB
    minSizeBytes: 100,
  },
  AVATAR: {
    allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
    allowedExtensions: [".jpg", ".jpeg", ".png", ".webp"],
    maxSizeBytes: 5 * 1024 * 1024, // 5MB
    minSizeBytes: 100,
  },
};

/**
 * Magic number signatures for common file types
 */
const MAGIC_NUMBERS: Record<string, Buffer[]> = {
  "image/jpeg": [Buffer.from([0xff, 0xd8, 0xff])],
  "image/png": [Buffer.from([0x89, 0x50, 0x4e, 0x47])],
  "image/gif": [Buffer.from([0x47, 0x49, 0x46, 0x38])],
  "image/webp": [Buffer.from([0x52, 0x49, 0x46, 0x46])], // RIFF
  "application/pdf": [Buffer.from([0x25, 0x50, 0x44, 0x46])], // %PDF
};

/**
 * File Validator Service
 *
 * Provides comprehensive file validation including:
 * - MIME type verification
 * - Size limit enforcement
 * - Magic number validation
 * - Filename sanitization
 */
export class FileValidator {
  private defaultOptions: FileValidationOptions = {
    maxSizeBytes: 10 * 1024 * 1024, // 10MB default
    minSizeBytes: 1,
    validateMagicNumber: true,
  };

  /**
   * Validate a file buffer
   *
   * @param buffer - File buffer to validate
   * @param filename - Original filename
   * @param options - Validation options
   * @returns Validation result
   */
  validate(
    buffer: Buffer,
    filename: string,
    options: FileValidationOptions = {},
  ): FileValidationResult {
    const opts = { ...this.defaultOptions, ...options };
    const errors: string[] = [];

    // Validate file size
    if (opts.maxSizeBytes && buffer.length > opts.maxSizeBytes) {
      errors.push(
        `File size (${this.formatBytes(buffer.length)}) exceeds maximum allowed (${this.formatBytes(opts.maxSizeBytes)})`,
      );
    }

    if (opts.minSizeBytes && buffer.length < opts.minSizeBytes) {
      errors.push(
        `File size (${this.formatBytes(buffer.length)}) is below minimum required (${this.formatBytes(opts.minSizeBytes)})`,
      );
    }

    // Validate extension
    const extension = this.getExtension(filename).toLowerCase();
    if (opts.allowedExtensions && !opts.allowedExtensions.includes(extension)) {
      errors.push(
        `File extension "${extension}" is not allowed. Allowed: ${opts.allowedExtensions.join(", ")}`,
      );
    }

    // Detect and validate MIME type
    const detectedMimeType = this.detectMimeType(buffer, filename);
    if (
      opts.allowedMimeTypes &&
      detectedMimeType &&
      !opts.allowedMimeTypes.includes(detectedMimeType)
    ) {
      errors.push(
        `File type "${detectedMimeType}" is not allowed. Allowed: ${opts.allowedMimeTypes.join(", ")}`,
      );
    }

    // Validate magic number if enabled
    if (opts.validateMagicNumber && detectedMimeType) {
      const validMagic = this.validateMagicNumber(buffer, detectedMimeType);
      if (!validMagic) {
        errors.push(
          `File content does not match declared type "${detectedMimeType}"`,
        );
      }
    }

    // Check for potentially dangerous content
    const securityIssues = this.checkSecurityIssues(buffer, filename);
    errors.push(...securityIssues);

    // Sanitize filename
    const sanitizedFilename = this.sanitizeFilename(filename);

    return {
      valid: errors.length === 0,
      errors,
      sanitizedFilename,
      detectedMimeType,
    };
  }

  /**
   * Validate file for image uploads
   *
   * @param buffer - File buffer
   * @param filename - Original filename
   * @returns Validation result
   */
  validateImage(buffer: Buffer, filename: string): FileValidationResult {
    return this.validate(buffer, filename, FileTypeConfig.IMAGE);
  }

  /**
   * Validate file for document uploads
   *
   * @param buffer - File buffer
   * @param filename - Original filename
   * @returns Validation result
   */
  validateDocument(buffer: Buffer, filename: string): FileValidationResult {
    return this.validate(buffer, filename, FileTypeConfig.DOCUMENT);
  }

  /**
   * Validate file for certificate uploads
   *
   * @param buffer - File buffer
   * @param filename - Original filename
   * @returns Validation result
   */
  validateCertificate(buffer: Buffer, filename: string): FileValidationResult {
    return this.validate(buffer, filename, FileTypeConfig.CERTIFICATE);
  }

  /**
   * Validate file for avatar uploads
   *
   * @param buffer - File buffer
   * @param filename - Original filename
   * @returns Validation result
   */
  validateAvatar(buffer: Buffer, filename: string): FileValidationResult {
    return this.validate(buffer, filename, FileTypeConfig.AVATAR);
  }

  /**
   * Detect MIME type from buffer and filename
   *
   * @param buffer - File buffer
   * @param filename - Original filename
   * @returns Detected MIME type or undefined
   */
  detectMimeType(buffer: Buffer, filename: string): string | undefined {
    // Try magic number detection first
    for (const [mimeType, signatures] of Object.entries(MAGIC_NUMBERS)) {
      for (const signature of signatures) {
        if (buffer.subarray(0, signature.length).equals(signature)) {
          return mimeType;
        }
      }
    }

    // Fall back to extension-based detection
    const extension = this.getExtension(filename).toLowerCase();
    const extensionMimeMap: Record<string, string> = {
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".png": "image/png",
      ".gif": "image/gif",
      ".webp": "image/webp",
      ".avif": "image/avif",
      ".pdf": "application/pdf",
      ".doc": "application/msword",
      ".docx":
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ".xls": "application/vnd.ms-excel",
      ".xlsx":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    };

    return extensionMimeMap[extension] || undefined;
  }

  /**
   * Validate magic number for a specific MIME type
   *
   * @param buffer - File buffer
   * @param mimeType - Expected MIME type
   * @returns True if magic number matches
   */
  private validateMagicNumber(buffer: Buffer, mimeType: string): boolean {
    const signatures = MAGIC_NUMBERS[mimeType];
    if (!signatures) {
      // No signature to validate - allow
      return true;
    }

    for (const signature of signatures) {
      if (buffer.subarray(0, signature.length).equals(signature)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Check for security issues in file content
   *
   * @param buffer - File buffer
   * @param filename - Original filename
   * @returns Array of security issue messages
   */
  private checkSecurityIssues(buffer: Buffer, filename: string): string[] {
    const issues: string[] = [];

    // Check for null bytes in filename (path traversal)
    if (filename.includes("\0")) {
      issues.push("Filename contains null bytes");
    }

    // Check for path traversal attempts
    if (
      filename.includes("..") ||
      filename.includes("/") ||
      filename.includes("\\")
    ) {
      issues.push("Filename contains path traversal characters");
    }

    // Check for executable signatures
    const executableSignatures = [
      Buffer.from([0x4d, 0x5a]), // MZ (Windows executable)
      Buffer.from([0x7f, 0x45, 0x4c, 0x46]), // ELF (Linux executable)
      Buffer.from("#!/"), // Shebang
      Buffer.from("<?php"), // PHP
    ];

    for (const sig of executableSignatures) {
      if (buffer.subarray(0, sig.length).equals(sig)) {
        issues.push("File appears to be an executable");
        break;
      }
    }

    // Check for HTML/JavaScript injection in images
    const stringContent = buffer.toString(
      "utf8",
      0,
      Math.min(1000, buffer.length),
    );
    const dangerousPatterns = [
      "<script",
      "<iframe",
      "javascript:",
      "data:text/html",
    ];

    for (const pattern of dangerousPatterns) {
      if (stringContent.toLowerCase().includes(pattern)) {
        issues.push(`File contains potentially dangerous content: ${pattern}`);
        break;
      }
    }

    return issues;
  }

  /**
   * Sanitize filename to prevent security issues
   *
   * @param filename - Original filename
   * @returns Sanitized filename
   */
  sanitizeFilename(filename: string): string {
    // Remove path components
    let sanitized = filename.split(/[/\\]/).pop() || "file";

    // Remove null bytes
    sanitized = sanitized.replace(/\0/g, "");

    // Replace dangerous characters
    sanitized = sanitized.replace(/[^a-zA-Z0-9._-]/g, "_");

    // Limit length
    if (sanitized.length > 100) {
      const ext = this.getExtension(sanitized);
      const name = sanitized.substring(0, 100 - ext.length);
      sanitized = name + ext;
    }

    // Ensure it doesn't start with a dot
    if (sanitized.startsWith(".")) {
      sanitized = "_" + sanitized;
    }

    return sanitized;
  }

  /**
   * Get file extension including the dot
   *
   * @param filename - Filename
   * @returns Extension (e.g., ".jpg")
   */
  private getExtension(filename: string): string {
    const match = filename.match(/\.[^.]+$/);
    return match ? match[0] : "";
  }

  /**
   * Format bytes to human readable string
   *
   * @param bytes - Number of bytes
   * @returns Formatted string (e.g., "1.5 MB")
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return "0 Bytes";

    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  }
}

/**
 * Singleton instance of the File Validator
 */
export const fileValidator = new FileValidator();

export default fileValidator;
