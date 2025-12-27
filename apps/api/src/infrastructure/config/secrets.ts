/**
 * AWS Secrets Manager Integration
 *
 * Loads secrets from AWS Secrets Manager at application startup.
 * Provides SOC2-ready secrets management with no hardcoded credentials.
 *
 * Environment Variables:
 * - AWS_SECRET_NAME: The name of the secret in AWS Secrets Manager
 * - AWS_REGION: AWS region (defaults to us-east-1)
 * - NODE_ENV: When 'production', fails loudly if secrets can't be loaded
 */

import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from "@aws-sdk/client-secrets-manager";
import logger from "../../shared/utils/logger.js";

export interface SecretsConfig {
  secretName: string;
  region: string;
  failOnError: boolean;
}

/**
 * Default configuration for secrets loading
 */
const defaultConfig: SecretsConfig = {
  secretName: process.env.AWS_SECRET_NAME || "agrobridge/production",
  region: process.env.AWS_REGION || "us-east-1",
  failOnError: process.env.NODE_ENV === "production",
};

/**
 * Load secrets from AWS Secrets Manager
 *
 * @param config - Optional configuration overrides
 * @throws Error in production if secrets cannot be loaded
 */
export async function loadSecrets(
  config: Partial<SecretsConfig> = {},
): Promise<void> {
  const { secretName, region, failOnError } = { ...defaultConfig, ...config };

  // Skip if no secret name configured
  if (!process.env.AWS_SECRET_NAME && process.env.NODE_ENV !== "production") {
    logger.info(
      "[Secrets] AWS_SECRET_NAME not set, skipping AWS Secrets Manager",
    );
    return;
  }

  const client = new SecretsManagerClient({ region });

  try {
    logger.info(
      `[Secrets] Loading secrets from AWS Secrets Manager: ${secretName}`,
    );

    const response = await client.send(
      new GetSecretValueCommand({ SecretId: secretName }),
    );

    if (!response.SecretString) {
      throw new Error("Secret value is empty");
    }

    const secrets = JSON.parse(response.SecretString);
    let loadedCount = 0;

    // Merge secrets into process.env (don't override existing values)
    Object.keys(secrets).forEach((key) => {
      if (!process.env[key]) {
        process.env[key] = secrets[key];
        loadedCount++;
      }
    });

    logger.info(
      `[Secrets] Successfully loaded ${loadedCount} secrets from AWS`,
    );
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";

    if (failOnError) {
      logger.error(
        `[Secrets] FATAL: Failed to load secrets in production: ${errorMessage}`,
      );
      throw new Error(
        `Failed to load secrets from AWS Secrets Manager: ${errorMessage}`,
      );
    }

    logger.warn(
      `[Secrets] AWS Secrets Manager unavailable, using .env file: ${errorMessage}`,
    );
  }
}

/**
 * Validate required secrets are present
 * Call after loadSecrets() to ensure critical values exist
 */
export function validateRequiredSecrets(requiredKeys: string[]): void {
  const missing: string[] = [];

  for (const key of requiredKeys) {
    if (!process.env[key]) {
      missing.push(key);
    }
  }

  if (missing.length > 0) {
    const message = `Missing required secrets: ${missing.join(", ")}`;
    if (process.env.NODE_ENV === "production") {
      throw new Error(message);
    }
    logger.warn(`[Secrets] ${message}`);
  }
}

/**
 * Required secrets for production deployment
 */
export const REQUIRED_PRODUCTION_SECRETS = [
  "DATABASE_URL",
  "JWT_SECRET",
  "REDIS_URL",
];

export default {
  loadSecrets,
  validateRequiredSecrets,
  REQUIRED_PRODUCTION_SECRETS,
};
