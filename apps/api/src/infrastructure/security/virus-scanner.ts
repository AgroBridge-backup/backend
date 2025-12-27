/**
 * @file Virus Scanner Service
 * @description ClamAV integration for file upload scanning
 *
 * Provides malware detection for uploaded files using:
 * - ClamAV daemon (clamd) in production
 * - Mock scanning in development (configurable)
 *
 * @author AgroBridge Engineering Team
 */

import { Socket } from "net";
import { Readable } from "stream";
import logger from "../../shared/utils/logger.js";

// ClamAV configuration
const CLAMD_HOST = process.env.CLAMD_HOST || "localhost";
const CLAMD_PORT = parseInt(process.env.CLAMD_PORT || "3310", 10);
const CLAMD_TIMEOUT = parseInt(process.env.CLAMD_TIMEOUT || "30000", 10); // 30 seconds
const VIRUS_SCAN_ENABLED = process.env.VIRUS_SCAN_ENABLED !== "false";
const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB max for virus scanning

/**
 * Scan result interface
 */
export interface ScanResult {
  clean: boolean;
  virus?: string;
  error?: string;
  scannedAt: Date;
  scanDurationMs: number;
  fileSize: number;
  fileName?: string;
}

/**
 * Known malicious file signatures (magic bytes)
 * Basic check before sending to ClamAV
 */
const MALICIOUS_SIGNATURES = [
  // EICAR test file (for testing AV software)
  {
    signature: Buffer.from("X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR"),
    name: "EICAR-Test-File",
  },
  // Common executable headers that shouldn't be in uploads
  {
    signature: Buffer.from([0x4d, 0x5a]),
    name: "Windows-Executable",
    offset: 0,
  }, // MZ header
];

/**
 * Virus Scanner Service
 * Integrates with ClamAV for malware detection
 */
export class VirusScanner {
  private static instance: VirusScanner | null = null;
  private isAvailable: boolean = false;
  private lastHealthCheck: Date | null = null;

  private constructor() {
    // Check ClamAV availability on startup
    this.checkAvailability();
  }

  /**
   * Get singleton instance
   */
  static getInstance(): VirusScanner {
    if (!VirusScanner.instance) {
      VirusScanner.instance = new VirusScanner();
    }
    return VirusScanner.instance;
  }

  /**
   * Check if ClamAV daemon is available
   */
  async checkAvailability(): Promise<boolean> {
    if (!VIRUS_SCAN_ENABLED) {
      logger.info("[VirusScanner] Virus scanning disabled by configuration");
      this.isAvailable = false;
      return false;
    }

    try {
      const response = await this.sendCommand("PING");
      this.isAvailable = response.trim() === "PONG";
      this.lastHealthCheck = new Date();

      if (this.isAvailable) {
        logger.info("[VirusScanner] ClamAV daemon is available", {
          host: CLAMD_HOST,
          port: CLAMD_PORT,
        });
      } else {
        logger.warn("[VirusScanner] ClamAV daemon responded but not ready");
      }

      return this.isAvailable;
    } catch (error) {
      logger.warn("[VirusScanner] ClamAV daemon not available", {
        host: CLAMD_HOST,
        port: CLAMD_PORT,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      this.isAvailable = false;
      return false;
    }
  }

  /**
   * Get scanner status
   */
  getStatus(): {
    available: boolean;
    lastCheck: Date | null;
    enabled: boolean;
  } {
    return {
      available: this.isAvailable,
      lastCheck: this.lastHealthCheck,
      enabled: VIRUS_SCAN_ENABLED,
    };
  }

  /**
   * Scan a file buffer for viruses
   */
  async scanBuffer(buffer: Buffer, fileName?: string): Promise<ScanResult> {
    const startTime = Date.now();
    const result: ScanResult = {
      clean: true,
      scannedAt: new Date(),
      scanDurationMs: 0,
      fileSize: buffer.length,
      fileName,
    };

    try {
      // Check file size
      if (buffer.length > MAX_FILE_SIZE) {
        result.clean = false;
        result.error = `File too large for virus scanning (max ${MAX_FILE_SIZE / 1024 / 1024}MB)`;
        result.scanDurationMs = Date.now() - startTime;
        return result;
      }

      // Quick signature check first
      const signatureResult = this.checkSignatures(buffer);
      if (signatureResult) {
        result.clean = false;
        result.virus = signatureResult;
        result.scanDurationMs = Date.now() - startTime;
        logger.warn("[VirusScanner] Malicious signature detected", {
          fileName,
          virus: signatureResult,
        });
        return result;
      }

      // If ClamAV not available, log warning and allow (fail-open for availability)
      // In strict security mode, you might want to fail-closed instead
      if (!this.isAvailable) {
        // Recheck availability
        await this.checkAvailability();

        if (!this.isAvailable) {
          logger.warn("[VirusScanner] ClamAV unavailable, skipping deep scan", {
            fileName,
            fileSize: buffer.length,
          });
          result.scanDurationMs = Date.now() - startTime;
          // In production, you might want to queue for later scanning
          // or reject the upload entirely
          return result;
        }
      }

      // Send to ClamAV for scanning
      const scanResponse = await this.streamScan(buffer);
      result.scanDurationMs = Date.now() - startTime;

      // Parse ClamAV response
      // Format: "stream: OK" or "stream: VirusName FOUND"
      if (scanResponse.includes("FOUND")) {
        const match = scanResponse.match(/stream:\s*(.+)\s+FOUND/);
        result.clean = false;
        result.virus = match ? match[1].trim() : "Unknown";
        logger.warn("[VirusScanner] Virus detected", {
          fileName,
          virus: result.virus,
          scanDurationMs: result.scanDurationMs,
        });
      } else if (scanResponse.includes("OK")) {
        result.clean = true;
        logger.debug("[VirusScanner] File clean", {
          fileName,
          scanDurationMs: result.scanDurationMs,
        });
      } else if (scanResponse.includes("ERROR")) {
        result.error = scanResponse;
        logger.error("[VirusScanner] Scan error", {
          fileName,
          response: scanResponse,
        });
      }

      return result;
    } catch (error) {
      result.scanDurationMs = Date.now() - startTime;
      result.error = error instanceof Error ? error.message : "Scan failed";
      logger.error("[VirusScanner] Scan failed", {
        fileName,
        error: result.error,
      });
      return result;
    }
  }

  /**
   * Scan a file stream
   */
  async scanStream(stream: Readable, fileName?: string): Promise<ScanResult> {
    // Convert stream to buffer for scanning
    const chunks: Buffer[] = [];
    let totalSize = 0;

    return new Promise((resolve, reject) => {
      stream.on("data", (chunk: Buffer) => {
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

      stream.on("end", async () => {
        const buffer = Buffer.concat(chunks);
        const result = await this.scanBuffer(buffer, fileName);
        resolve(result);
      });

      stream.on("error", (error) => {
        reject(error);
      });
    });
  }

  /**
   * Check for known malicious file signatures
   */
  private checkSignatures(buffer: Buffer): string | null {
    for (const sig of MALICIOUS_SIGNATURES) {
      const offset = (sig as any).offset || 0;
      if (buffer.length >= offset + sig.signature.length) {
        const slice = buffer.subarray(offset, offset + sig.signature.length);
        if (slice.equals(sig.signature)) {
          return sig.name;
        }
      }
    }
    return null;
  }

  /**
   * Send command to ClamAV daemon
   */
  private sendCommand(command: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const socket = new Socket();
      let response = "";

      socket.setTimeout(CLAMD_TIMEOUT);

      socket.on("connect", () => {
        socket.write(`n${command}\n`);
      });

      socket.on("data", (data) => {
        response += data.toString();
      });

      socket.on("end", () => {
        resolve(response);
      });

      socket.on("error", (error) => {
        reject(error);
      });

      socket.on("timeout", () => {
        socket.destroy();
        reject(new Error("ClamAV connection timeout"));
      });

      socket.connect(CLAMD_PORT, CLAMD_HOST);
    });
  }

  /**
   * Stream scan using INSTREAM command
   */
  private streamScan(buffer: Buffer): Promise<string> {
    return new Promise((resolve, reject) => {
      const socket = new Socket();
      let response = "";

      socket.setTimeout(CLAMD_TIMEOUT);

      socket.on("connect", () => {
        // Send INSTREAM command
        socket.write("nINSTREAM\n");

        // Send file data in chunks
        // Format: 4-byte big-endian length + data
        const chunkSize = 8192;
        for (let i = 0; i < buffer.length; i += chunkSize) {
          const chunk = buffer.subarray(
            i,
            Math.min(i + chunkSize, buffer.length),
          );
          const lengthBuffer = Buffer.alloc(4);
          lengthBuffer.writeUInt32BE(chunk.length, 0);
          socket.write(lengthBuffer);
          socket.write(chunk);
        }

        // Send terminating zero-length chunk
        const endBuffer = Buffer.alloc(4);
        endBuffer.writeUInt32BE(0, 0);
        socket.write(endBuffer);
      });

      socket.on("data", (data) => {
        response += data.toString();
      });

      socket.on("end", () => {
        resolve(response);
      });

      socket.on("error", (error) => {
        reject(error);
      });

      socket.on("timeout", () => {
        socket.destroy();
        reject(new Error("ClamAV scan timeout"));
      });

      socket.connect(CLAMD_PORT, CLAMD_HOST);
    });
  }

  /**
   * Get ClamAV version
   */
  async getVersion(): Promise<string | null> {
    try {
      const response = await this.sendCommand("VERSION");
      return response.trim();
    } catch {
      return null;
    }
  }

  /**
   * Reload virus definitions
   */
  async reloadDefinitions(): Promise<boolean> {
    try {
      const response = await this.sendCommand("RELOAD");
      return response.includes("RELOADING");
    } catch {
      return false;
    }
  }
}

// Export singleton instance
export const virusScanner = VirusScanner.getInstance();

/**
 * Express middleware for scanning uploaded files
 */
export function virusScanMiddleware(
  options: {
    rejectOnVirus?: boolean;
    rejectOnError?: boolean;
    skipIfUnavailable?: boolean;
  } = {},
) {
  const {
    rejectOnVirus = true,
    rejectOnError = false,
    skipIfUnavailable = true,
  } = options;

  return async (req: any, res: any, next: any) => {
    // Skip if no files uploaded
    if (!req.file && !req.files) {
      return next();
    }

    const scanner = VirusScanner.getInstance();
    const status = scanner.getStatus();

    // Check if scanning is available
    if (!status.enabled || (!status.available && skipIfUnavailable)) {
      logger.debug("[VirusScanMiddleware] Skipping scan - scanner unavailable");
      return next();
    }

    try {
      // Handle single file upload
      if (req.file) {
        const result = await scanner.scanBuffer(
          req.file.buffer,
          req.file.originalname,
        );

        if (!result.clean && rejectOnVirus) {
          logger.warn("[VirusScanMiddleware] Rejecting infected file", {
            fileName: req.file.originalname,
            virus: result.virus,
          });
          return res.status(400).json({
            error: {
              code: "VIRUS_DETECTED",
              message:
                "The uploaded file contains malware and has been rejected",
              virus: result.virus,
            },
          });
        }

        if (result.error && rejectOnError) {
          return res.status(500).json({
            error: {
              code: "SCAN_ERROR",
              message: "Failed to scan uploaded file",
            },
          });
        }

        // Attach scan result to request
        req.file.scanResult = result;
      }

      // Handle multiple file uploads
      if (req.files) {
        const files = Array.isArray(req.files)
          ? req.files
          : Object.values(req.files).flat();

        for (const file of files as Express.Multer.File[]) {
          const result = await scanner.scanBuffer(
            file.buffer,
            file.originalname,
          );

          if (!result.clean && rejectOnVirus) {
            logger.warn("[VirusScanMiddleware] Rejecting infected file", {
              fileName: file.originalname,
              virus: result.virus,
            });
            return res.status(400).json({
              error: {
                code: "VIRUS_DETECTED",
                message: `The uploaded file "${file.originalname}" contains malware and has been rejected`,
                virus: result.virus,
              },
            });
          }

          // Attach scan result to file
          (file as any).scanResult = result;
        }
      }

      next();
    } catch (error) {
      logger.error("[VirusScanMiddleware] Scan error", {
        error: error instanceof Error ? error.message : "Unknown error",
      });

      if (rejectOnError) {
        return res.status(500).json({
          error: {
            code: "SCAN_ERROR",
            message: "Failed to scan uploaded files",
          },
        });
      }

      next();
    }
  };
}

export default virusScanner;
