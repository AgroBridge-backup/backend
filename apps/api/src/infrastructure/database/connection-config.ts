/**
 * Database Connection Configuration
 *
 * Production-optimized connection settings for PostgreSQL with pgBouncer.
 * Supports connection pooling, retries, and monitoring.
 *
 * @module DatabaseConnectionConfig
 */

export interface DatabaseConfig {
  connectionUrl: string;
  poolSize: number;
  connectionTimeout: number;
  queryTimeout: number;
  retries: number;
  retryDelay: number;
}

const isProduction = process.env.NODE_ENV === "production";
const isStaging = process.env.NODE_ENV === "staging";

/**
 * Get optimized database configuration based on environment
 */
export function getDatabaseConfig(): DatabaseConfig {
  // Use pgBouncer URL in production (port 6432), direct connection in dev (port 5432)
  const connectionUrl =
    process.env.DATABASE_URL || "postgresql://localhost:5432/agrobridge";

  // Production: Smaller pool size since pgBouncer handles pooling
  // Development: Larger pool size for parallel test runs
  const poolSize =
    isProduction || isStaging
      ? parseInt(process.env.DB_POOL_SIZE || "10", 10)
      : parseInt(process.env.DB_POOL_SIZE || "20", 10);

  return {
    connectionUrl,
    poolSize,
    connectionTimeout: parseInt(process.env.DB_CONNECT_TIMEOUT || "10000", 10), // 10s
    queryTimeout: parseInt(process.env.DB_QUERY_TIMEOUT || "30000", 10), // 30s
    retries: parseInt(process.env.DB_RETRIES || "3", 10),
    retryDelay: parseInt(process.env.DB_RETRY_DELAY || "1000", 10), // 1s
  };
}

/**
 * Build Prisma connection URL with pooling options
 *
 * When using pgBouncer in transaction mode, add these parameters:
 * - pgbouncer=true: Tells Prisma to use pgBouncer-compatible mode
 * - connection_limit: Limits connections per Prisma client instance
 *
 * @see https://www.prisma.io/docs/guides/performance-and-optimization/connection-management/configure-pg-bouncer
 */
export function buildConnectionUrl(): string {
  const config = getDatabaseConfig();
  let url = config.connectionUrl;

  // Add pgBouncer parameters in production
  if (isProduction || isStaging) {
    const separator = url.includes("?") ? "&" : "?";
    url += `${separator}pgbouncer=true&connection_limit=${config.poolSize}`;
  }

  return url;
}

/**
 * Prisma connection options for optimal performance
 */
export function getPrismaConnectionOptions() {
  const config = getDatabaseConfig();

  return {
    datasources: {
      db: {
        url: buildConnectionUrl(),
      },
    },
    log: isProduction ? ["error", "warn"] : ["query", "info", "warn", "error"],
  };
}

/**
 * Health check query to verify database connectivity
 */
export const HEALTH_CHECK_QUERY = "SELECT 1 as healthy";

/**
 * Database connection retry wrapper
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  options?: Partial<Pick<DatabaseConfig, "retries" | "retryDelay">>,
): Promise<T> {
  const config = getDatabaseConfig();
  const maxRetries = options?.retries ?? config.retries;
  const retryDelay = options?.retryDelay ?? config.retryDelay;

  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;

      // Check if error is retryable
      const isRetryable = isRetryableError(error);
      if (!isRetryable || attempt === maxRetries) {
        throw error;
      }

      // Wait before retry with exponential backoff
      const delay = retryDelay * Math.pow(2, attempt - 1);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

/**
 * Check if error is retryable (connection issues, deadlocks)
 */
function isRetryableError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;

  const retryableCodes = [
    "P2024", // Prisma: Connection pool timeout
    "P2034", // Prisma: Transaction deadlock
    "ECONNRESET",
    "ECONNREFUSED",
    "ETIMEDOUT",
    "40001", // PostgreSQL: Serialization failure
    "40P01", // PostgreSQL: Deadlock detected
  ];

  const errorCode = (error as any).code;
  return retryableCodes.some((code) => errorCode?.includes(code));
}

/**
 * Environment variables documentation
 */
export const ENV_VARS = {
  DATABASE_URL:
    "PostgreSQL connection string (with pgBouncer port in production)",
  DB_POOL_SIZE:
    "Number of connections per Prisma client (default: 10 prod, 20 dev)",
  DB_CONNECT_TIMEOUT: "Connection timeout in ms (default: 10000)",
  DB_QUERY_TIMEOUT: "Query timeout in ms (default: 30000)",
  DB_RETRIES: "Number of retries on connection failure (default: 3)",
  DB_RETRY_DELAY: "Delay between retries in ms (default: 1000)",
} as const;
