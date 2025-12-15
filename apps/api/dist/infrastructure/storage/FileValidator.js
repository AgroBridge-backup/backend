export const FileTypeConfig = {
    IMAGE: {
        allowedMimeTypes: [
            'image/jpeg',
            'image/png',
            'image/gif',
            'image/webp',
            'image/avif',
        ],
        allowedExtensions: ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.avif'],
        maxSizeBytes: 10 * 1024 * 1024,
        minSizeBytes: 100,
    },
    DOCUMENT: {
        allowedMimeTypes: [
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        ],
        allowedExtensions: ['.pdf', '.doc', '.docx', '.xls', '.xlsx'],
        maxSizeBytes: 25 * 1024 * 1024,
        minSizeBytes: 100,
    },
    CERTIFICATE: {
        allowedMimeTypes: ['application/pdf', 'image/jpeg', 'image/png'],
        allowedExtensions: ['.pdf', '.jpg', '.jpeg', '.png'],
        maxSizeBytes: 10 * 1024 * 1024,
        minSizeBytes: 100,
    },
    AVATAR: {
        allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
        allowedExtensions: ['.jpg', '.jpeg', '.png', '.webp'],
        maxSizeBytes: 5 * 1024 * 1024,
        minSizeBytes: 100,
    },
};
const MAGIC_NUMBERS = {
    'image/jpeg': [Buffer.from([0xff, 0xd8, 0xff])],
    'image/png': [Buffer.from([0x89, 0x50, 0x4e, 0x47])],
    'image/gif': [Buffer.from([0x47, 0x49, 0x46, 0x38])],
    'image/webp': [Buffer.from([0x52, 0x49, 0x46, 0x46])],
    'application/pdf': [Buffer.from([0x25, 0x50, 0x44, 0x46])],
};
export class FileValidator {
    defaultOptions = {
        maxSizeBytes: 10 * 1024 * 1024,
        minSizeBytes: 1,
        validateMagicNumber: true,
    };
    validate(buffer, filename, options = {}) {
        const opts = { ...this.defaultOptions, ...options };
        const errors = [];
        if (opts.maxSizeBytes && buffer.length > opts.maxSizeBytes) {
            errors.push(`File size (${this.formatBytes(buffer.length)}) exceeds maximum allowed (${this.formatBytes(opts.maxSizeBytes)})`);
        }
        if (opts.minSizeBytes && buffer.length < opts.minSizeBytes) {
            errors.push(`File size (${this.formatBytes(buffer.length)}) is below minimum required (${this.formatBytes(opts.minSizeBytes)})`);
        }
        const extension = this.getExtension(filename).toLowerCase();
        if (opts.allowedExtensions && !opts.allowedExtensions.includes(extension)) {
            errors.push(`File extension "${extension}" is not allowed. Allowed: ${opts.allowedExtensions.join(', ')}`);
        }
        const detectedMimeType = this.detectMimeType(buffer, filename);
        if (opts.allowedMimeTypes &&
            detectedMimeType &&
            !opts.allowedMimeTypes.includes(detectedMimeType)) {
            errors.push(`File type "${detectedMimeType}" is not allowed. Allowed: ${opts.allowedMimeTypes.join(', ')}`);
        }
        if (opts.validateMagicNumber && detectedMimeType) {
            const validMagic = this.validateMagicNumber(buffer, detectedMimeType);
            if (!validMagic) {
                errors.push(`File content does not match declared type "${detectedMimeType}"`);
            }
        }
        const securityIssues = this.checkSecurityIssues(buffer, filename);
        errors.push(...securityIssues);
        const sanitizedFilename = this.sanitizeFilename(filename);
        return {
            valid: errors.length === 0,
            errors,
            sanitizedFilename,
            detectedMimeType,
        };
    }
    validateImage(buffer, filename) {
        return this.validate(buffer, filename, FileTypeConfig.IMAGE);
    }
    validateDocument(buffer, filename) {
        return this.validate(buffer, filename, FileTypeConfig.DOCUMENT);
    }
    validateCertificate(buffer, filename) {
        return this.validate(buffer, filename, FileTypeConfig.CERTIFICATE);
    }
    validateAvatar(buffer, filename) {
        return this.validate(buffer, filename, FileTypeConfig.AVATAR);
    }
    detectMimeType(buffer, filename) {
        for (const [mimeType, signatures] of Object.entries(MAGIC_NUMBERS)) {
            for (const signature of signatures) {
                if (buffer.subarray(0, signature.length).equals(signature)) {
                    return mimeType;
                }
            }
        }
        const extension = this.getExtension(filename).toLowerCase();
        const extensionMimeMap = {
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.png': 'image/png',
            '.gif': 'image/gif',
            '.webp': 'image/webp',
            '.avif': 'image/avif',
            '.pdf': 'application/pdf',
            '.doc': 'application/msword',
            '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            '.xls': 'application/vnd.ms-excel',
            '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        };
        return extensionMimeMap[extension] || undefined;
    }
    validateMagicNumber(buffer, mimeType) {
        const signatures = MAGIC_NUMBERS[mimeType];
        if (!signatures) {
            return true;
        }
        for (const signature of signatures) {
            if (buffer.subarray(0, signature.length).equals(signature)) {
                return true;
            }
        }
        return false;
    }
    checkSecurityIssues(buffer, filename) {
        const issues = [];
        if (filename.includes('\0')) {
            issues.push('Filename contains null bytes');
        }
        if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
            issues.push('Filename contains path traversal characters');
        }
        const executableSignatures = [
            Buffer.from([0x4d, 0x5a]),
            Buffer.from([0x7f, 0x45, 0x4c, 0x46]),
            Buffer.from('#!/'),
            Buffer.from('<?php'),
        ];
        for (const sig of executableSignatures) {
            if (buffer.subarray(0, sig.length).equals(sig)) {
                issues.push('File appears to be an executable');
                break;
            }
        }
        const stringContent = buffer.toString('utf8', 0, Math.min(1000, buffer.length));
        const dangerousPatterns = ['<script', '<iframe', 'javascript:', 'data:text/html'];
        for (const pattern of dangerousPatterns) {
            if (stringContent.toLowerCase().includes(pattern)) {
                issues.push(`File contains potentially dangerous content: ${pattern}`);
                break;
            }
        }
        return issues;
    }
    sanitizeFilename(filename) {
        let sanitized = filename.split(/[/\\]/).pop() || 'file';
        sanitized = sanitized.replace(/\0/g, '');
        sanitized = sanitized.replace(/[^a-zA-Z0-9._-]/g, '_');
        if (sanitized.length > 100) {
            const ext = this.getExtension(sanitized);
            const name = sanitized.substring(0, 100 - ext.length);
            sanitized = name + ext;
        }
        if (sanitized.startsWith('.')) {
            sanitized = '_' + sanitized;
        }
        return sanitized;
    }
    getExtension(filename) {
        const match = filename.match(/\.[^.]+$/);
        return match ? match[0] : '';
    }
    formatBytes(bytes) {
        if (bytes === 0)
            return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
}
export const fileValidator = new FileValidator();
export default fileValidator;
