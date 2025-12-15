import { Socket } from 'net';
import logger from '../../shared/utils/logger.js';
const CLAMD_HOST = process.env.CLAMD_HOST || 'localhost';
const CLAMD_PORT = parseInt(process.env.CLAMD_PORT || '3310', 10);
const CLAMD_TIMEOUT = parseInt(process.env.CLAMD_TIMEOUT || '30000', 10);
const VIRUS_SCAN_ENABLED = process.env.VIRUS_SCAN_ENABLED !== 'false';
const MAX_FILE_SIZE = 100 * 1024 * 1024;
const MALICIOUS_SIGNATURES = [
    { signature: Buffer.from('X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR'), name: 'EICAR-Test-File' },
    { signature: Buffer.from([0x4D, 0x5A]), name: 'Windows-Executable', offset: 0 },
];
export class VirusScanner {
    static instance = null;
    isAvailable = false;
    lastHealthCheck = null;
    constructor() {
        this.checkAvailability();
    }
    static getInstance() {
        if (!VirusScanner.instance) {
            VirusScanner.instance = new VirusScanner();
        }
        return VirusScanner.instance;
    }
    async checkAvailability() {
        if (!VIRUS_SCAN_ENABLED) {
            logger.info('[VirusScanner] Virus scanning disabled by configuration');
            this.isAvailable = false;
            return false;
        }
        try {
            const response = await this.sendCommand('PING');
            this.isAvailable = response.trim() === 'PONG';
            this.lastHealthCheck = new Date();
            if (this.isAvailable) {
                logger.info('[VirusScanner] ClamAV daemon is available', {
                    host: CLAMD_HOST,
                    port: CLAMD_PORT,
                });
            }
            else {
                logger.warn('[VirusScanner] ClamAV daemon responded but not ready');
            }
            return this.isAvailable;
        }
        catch (error) {
            logger.warn('[VirusScanner] ClamAV daemon not available', {
                host: CLAMD_HOST,
                port: CLAMD_PORT,
                error: error instanceof Error ? error.message : 'Unknown error',
            });
            this.isAvailable = false;
            return false;
        }
    }
    getStatus() {
        return {
            available: this.isAvailable,
            lastCheck: this.lastHealthCheck,
            enabled: VIRUS_SCAN_ENABLED,
        };
    }
    async scanBuffer(buffer, fileName) {
        const startTime = Date.now();
        const result = {
            clean: true,
            scannedAt: new Date(),
            scanDurationMs: 0,
            fileSize: buffer.length,
            fileName,
        };
        try {
            if (buffer.length > MAX_FILE_SIZE) {
                result.clean = false;
                result.error = `File too large for virus scanning (max ${MAX_FILE_SIZE / 1024 / 1024}MB)`;
                result.scanDurationMs = Date.now() - startTime;
                return result;
            }
            const signatureResult = this.checkSignatures(buffer);
            if (signatureResult) {
                result.clean = false;
                result.virus = signatureResult;
                result.scanDurationMs = Date.now() - startTime;
                logger.warn('[VirusScanner] Malicious signature detected', {
                    fileName,
                    virus: signatureResult,
                });
                return result;
            }
            if (!this.isAvailable) {
                await this.checkAvailability();
                if (!this.isAvailable) {
                    logger.warn('[VirusScanner] ClamAV unavailable, skipping deep scan', {
                        fileName,
                        fileSize: buffer.length,
                    });
                    result.scanDurationMs = Date.now() - startTime;
                    return result;
                }
            }
            const scanResponse = await this.streamScan(buffer);
            result.scanDurationMs = Date.now() - startTime;
            if (scanResponse.includes('FOUND')) {
                const match = scanResponse.match(/stream:\s*(.+)\s+FOUND/);
                result.clean = false;
                result.virus = match ? match[1].trim() : 'Unknown';
                logger.warn('[VirusScanner] Virus detected', {
                    fileName,
                    virus: result.virus,
                    scanDurationMs: result.scanDurationMs,
                });
            }
            else if (scanResponse.includes('OK')) {
                result.clean = true;
                logger.debug('[VirusScanner] File clean', {
                    fileName,
                    scanDurationMs: result.scanDurationMs,
                });
            }
            else if (scanResponse.includes('ERROR')) {
                result.error = scanResponse;
                logger.error('[VirusScanner] Scan error', {
                    fileName,
                    response: scanResponse,
                });
            }
            return result;
        }
        catch (error) {
            result.scanDurationMs = Date.now() - startTime;
            result.error = error instanceof Error ? error.message : 'Scan failed';
            logger.error('[VirusScanner] Scan failed', {
                fileName,
                error: result.error,
            });
            return result;
        }
    }
    async scanStream(stream, fileName) {
        const chunks = [];
        let totalSize = 0;
        return new Promise((resolve, reject) => {
            stream.on('data', (chunk) => {
                totalSize += chunk.length;
                if (totalSize > MAX_FILE_SIZE) {
                    stream.destroy();
                    resolve({
                        clean: false,
                        error: `File too large for virus scanning (max ${MAX_FILE_SIZE / 1024 / 1024}MB)`,
                        scannedAt: new Date(),
                        scanDurationMs: 0,
                        fileSize: totalSize,
                        fileName,
                    });
                    return;
                }
                chunks.push(chunk);
            });
            stream.on('end', async () => {
                const buffer = Buffer.concat(chunks);
                const result = await this.scanBuffer(buffer, fileName);
                resolve(result);
            });
            stream.on('error', (error) => {
                reject(error);
            });
        });
    }
    checkSignatures(buffer) {
        for (const sig of MALICIOUS_SIGNATURES) {
            const offset = sig.offset || 0;
            if (buffer.length >= offset + sig.signature.length) {
                const slice = buffer.subarray(offset, offset + sig.signature.length);
                if (slice.equals(sig.signature)) {
                    return sig.name;
                }
            }
        }
        return null;
    }
    sendCommand(command) {
        return new Promise((resolve, reject) => {
            const socket = new Socket();
            let response = '';
            socket.setTimeout(CLAMD_TIMEOUT);
            socket.on('connect', () => {
                socket.write(`n${command}\n`);
            });
            socket.on('data', (data) => {
                response += data.toString();
            });
            socket.on('end', () => {
                resolve(response);
            });
            socket.on('error', (error) => {
                reject(error);
            });
            socket.on('timeout', () => {
                socket.destroy();
                reject(new Error('ClamAV connection timeout'));
            });
            socket.connect(CLAMD_PORT, CLAMD_HOST);
        });
    }
    streamScan(buffer) {
        return new Promise((resolve, reject) => {
            const socket = new Socket();
            let response = '';
            socket.setTimeout(CLAMD_TIMEOUT);
            socket.on('connect', () => {
                socket.write('nINSTREAM\n');
                const chunkSize = 8192;
                for (let i = 0; i < buffer.length; i += chunkSize) {
                    const chunk = buffer.subarray(i, Math.min(i + chunkSize, buffer.length));
                    const lengthBuffer = Buffer.alloc(4);
                    lengthBuffer.writeUInt32BE(chunk.length, 0);
                    socket.write(lengthBuffer);
                    socket.write(chunk);
                }
                const endBuffer = Buffer.alloc(4);
                endBuffer.writeUInt32BE(0, 0);
                socket.write(endBuffer);
            });
            socket.on('data', (data) => {
                response += data.toString();
            });
            socket.on('end', () => {
                resolve(response);
            });
            socket.on('error', (error) => {
                reject(error);
            });
            socket.on('timeout', () => {
                socket.destroy();
                reject(new Error('ClamAV scan timeout'));
            });
            socket.connect(CLAMD_PORT, CLAMD_HOST);
        });
    }
    async getVersion() {
        try {
            const response = await this.sendCommand('VERSION');
            return response.trim();
        }
        catch {
            return null;
        }
    }
    async reloadDefinitions() {
        try {
            const response = await this.sendCommand('RELOAD');
            return response.includes('RELOADING');
        }
        catch {
            return false;
        }
    }
}
export const virusScanner = VirusScanner.getInstance();
export function virusScanMiddleware(options = {}) {
    const { rejectOnVirus = true, rejectOnError = false, skipIfUnavailable = true, } = options;
    return async (req, res, next) => {
        if (!req.file && !req.files) {
            return next();
        }
        const scanner = VirusScanner.getInstance();
        const status = scanner.getStatus();
        if (!status.enabled || (!status.available && skipIfUnavailable)) {
            logger.debug('[VirusScanMiddleware] Skipping scan - scanner unavailable');
            return next();
        }
        try {
            if (req.file) {
                const result = await scanner.scanBuffer(req.file.buffer, req.file.originalname);
                if (!result.clean && rejectOnVirus) {
                    logger.warn('[VirusScanMiddleware] Rejecting infected file', {
                        fileName: req.file.originalname,
                        virus: result.virus,
                    });
                    return res.status(400).json({
                        error: {
                            code: 'VIRUS_DETECTED',
                            message: 'The uploaded file contains malware and has been rejected',
                            virus: result.virus,
                        },
                    });
                }
                if (result.error && rejectOnError) {
                    return res.status(500).json({
                        error: {
                            code: 'SCAN_ERROR',
                            message: 'Failed to scan uploaded file',
                        },
                    });
                }
                req.file.scanResult = result;
            }
            if (req.files) {
                const files = Array.isArray(req.files) ? req.files : Object.values(req.files).flat();
                for (const file of files) {
                    const result = await scanner.scanBuffer(file.buffer, file.originalname);
                    if (!result.clean && rejectOnVirus) {
                        logger.warn('[VirusScanMiddleware] Rejecting infected file', {
                            fileName: file.originalname,
                            virus: result.virus,
                        });
                        return res.status(400).json({
                            error: {
                                code: 'VIRUS_DETECTED',
                                message: `The uploaded file "${file.originalname}" contains malware and has been rejected`,
                                virus: result.virus,
                            },
                        });
                    }
                    file.scanResult = result;
                }
            }
            next();
        }
        catch (error) {
            logger.error('[VirusScanMiddleware] Scan error', {
                error: error instanceof Error ? error.message : 'Unknown error',
            });
            if (rejectOnError) {
                return res.status(500).json({
                    error: {
                        code: 'SCAN_ERROR',
                        message: 'Failed to scan uploaded files',
                    },
                });
            }
            next();
        }
    };
}
export default virusScanner;
