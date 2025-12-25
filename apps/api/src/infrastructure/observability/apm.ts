/**
 * @file APM (Application Performance Monitoring) Integration
 * @description Pluggable APM tracer for Datadog, New Relic, or AWS X-Ray
 *
 * This module provides a unified interface for APM integration.
 * It auto-initializes based on environment variables.
 *
 * Supported Providers:
 * - Datadog: Set DD_AGENT_HOST and optionally DD_TRACE_AGENT_PORT
 * - New Relic: Set NEW_RELIC_LICENSE_KEY and NEW_RELIC_APP_NAME
 * - AWS X-Ray: Set AWS_XRAY_DAEMON_ADDRESS
 *
 * If no APM is configured, the module gracefully no-ops.
 *
 * @author AgroBridge Engineering Team
 */

import logger from '../../shared/utils/logger.js';

export type APMProvider = 'datadog' | 'newrelic' | 'xray' | 'none';

export interface APMConfig {
  provider: APMProvider;
  serviceName: string;
  environment: string;
  version: string;
  sampleRate?: number;
}

export interface APMSpan {
  finish(): void;
  setTag(key: string, value: string | number | boolean): void;
  setError(error: Error): void;
}

/**
 * APM Tracer Singleton
 *
 * Initializes the appropriate APM provider based on environment variables.
 * All methods gracefully no-op if APM is not configured.
 */
class APMTracer {
  private provider: APMProvider = 'none';
  private initialized: boolean = false;
  private tracer: any = null;

  /**
   * Initialize APM based on environment variables
   * Should be called early in application startup (before Express app creation)
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    const config: APMConfig = {
      provider: this.detectProvider(),
      serviceName: process.env.SERVICE_NAME || 'agrobridge-api',
      environment: process.env.NODE_ENV || 'development',
      version: process.env.API_VERSION || '2.0.0',
      sampleRate: parseFloat(process.env.APM_SAMPLE_RATE || '0.1'),
    };

    this.provider = config.provider;

    if (config.provider === 'none') {
      logger.info('[APM] No APM provider configured - running without tracing');
      this.initialized = true;
      return;
    }

    try {
      switch (config.provider) {
        case 'datadog':
          await this.initDatadog(config);
          break;
        case 'newrelic':
          await this.initNewRelic(config);
          break;
        case 'xray':
          await this.initXRay(config);
          break;
      }

      logger.info(`[APM] ${config.provider} tracer initialized`, {
        serviceName: config.serviceName,
        environment: config.environment,
        sampleRate: config.sampleRate,
      });
    } catch (error) {
      logger.error('[APM] Failed to initialize APM tracer', {
        provider: config.provider,
        error: (error as Error).message,
      });
      this.provider = 'none';
    }

    this.initialized = true;
  }

  /**
   * Detect which APM provider to use based on environment variables
   */
  private detectProvider(): APMProvider {
    if (process.env.DD_AGENT_HOST || process.env.DD_TRACE_ENABLED === 'true') {
      return 'datadog';
    }
    if (process.env.NEW_RELIC_LICENSE_KEY) {
      return 'newrelic';
    }
    if (process.env.AWS_XRAY_DAEMON_ADDRESS) {
      return 'xray';
    }
    return 'none';
  }

  /**
   * Initialize Datadog tracer
   */
  private async initDatadog(config: APMConfig): Promise<void> {
    try {
      // Dynamic import to avoid loading if not needed
      // @ts-ignore - dd-trace is an optional dependency
      const ddTrace = await import('dd-trace');
      this.tracer = ddTrace.default.init({
        service: config.serviceName,
        env: config.environment,
        version: config.version,
        sampleRate: config.sampleRate,
        runtimeMetrics: true,
        logInjection: true,
        startupLogs: false,
      });
    } catch (error) {
      throw new Error(`Datadog tracer not available: ${(error as Error).message}. Install with: npm install dd-trace`);
    }
  }

  /**
   * Initialize New Relic tracer
   * Note: New Relic should be required before any other modules
   */
  private async initNewRelic(config: APMConfig): Promise<void> {
    // New Relic must be required before other modules
    // This is typically done at the very start of the application
    logger.warn('[APM] New Relic should be initialized at application start. Add require("newrelic") to the first line of your entry file.');

    try {
      // @ts-ignore - newrelic is an optional dependency
      const newrelic = await import('newrelic');
      this.tracer = newrelic.default;
    } catch (error) {
      throw new Error(`New Relic not available: ${(error as Error).message}. Install with: npm install newrelic`);
    }
  }

  /**
   * Initialize AWS X-Ray tracer
   */
  private async initXRay(config: APMConfig): Promise<void> {
    try {
      // @ts-ignore - aws-xray-sdk is an optional dependency
      const AWSXRay = await import('aws-xray-sdk');
      AWSXRay.default.setDaemonAddress(process.env.AWS_XRAY_DAEMON_ADDRESS || '127.0.0.1:2000');
      AWSXRay.default.setContextMissingStrategy('LOG_ERROR');
      this.tracer = AWSXRay.default;
    } catch (error) {
      throw new Error(`AWS X-Ray not available: ${(error as Error).message}. Install with: npm install aws-xray-sdk`);
    }
  }

  /**
   * Start a new span for tracing a specific operation
   *
   * @param operationName - Name of the operation being traced
   * @param options - Optional span configuration
   * @returns APM Span wrapper
   */
  startSpan(operationName: string, options?: { tags?: Record<string, string | number | boolean> }): APMSpan {
    if (this.provider === 'none' || !this.tracer) {
      return this.createNoopSpan();
    }

    try {
      switch (this.provider) {
        case 'datadog':
          const ddSpan = this.tracer.scope().active();
          if (ddSpan && options?.tags) {
            Object.entries(options.tags).forEach(([key, value]) => {
              ddSpan.setTag(key, value);
            });
          }
          return this.wrapDatadogSpan(ddSpan);

        case 'newrelic':
          // New Relic uses segments
          return this.createNoopSpan(); // Simplified for now

        case 'xray':
          const segment = this.tracer.getSegment();
          const subsegment = segment?.addNewSubsegment(operationName);
          return this.wrapXRaySubsegment(subsegment);

        default:
          return this.createNoopSpan();
      }
    } catch (error) {
      logger.debug('[APM] Failed to create span', { error: (error as Error).message });
      return this.createNoopSpan();
    }
  }

  /**
   * Record a custom metric
   *
   * @param name - Metric name
   * @param value - Metric value
   * @param tags - Optional metric tags
   */
  recordMetric(name: string, value: number, tags?: Record<string, string>): void {
    if (this.provider === 'none') {
      return;
    }

    try {
      switch (this.provider) {
        case 'datadog':
          // Datadog metrics via dogstatsd
          // Requires dd-trace to be configured with runtime metrics
          logger.debug('[APM] Datadog metric', { name, value, tags });
          break;

        case 'newrelic':
          if (this.tracer?.recordMetric) {
            this.tracer.recordMetric(name, value);
          }
          break;

        case 'xray':
          // X-Ray uses annotations for custom data
          const segment = this.tracer?.getSegment();
          if (segment) {
            segment.addAnnotation(name, value);
          }
          break;
      }
    } catch (error) {
      logger.debug('[APM] Failed to record metric', { error: (error as Error).message });
    }
  }

  /**
   * Add tags/annotations to the current transaction
   *
   * @param tags - Key-value pairs to add
   */
  addTags(tags: Record<string, string | number | boolean>): void {
    if (this.provider === 'none' || !this.tracer) {
      return;
    }

    try {
      switch (this.provider) {
        case 'datadog':
          const span = this.tracer.scope().active();
          if (span) {
            Object.entries(tags).forEach(([key, value]) => {
              span.setTag(key, value);
            });
          }
          break;

        case 'newrelic':
          if (this.tracer?.addCustomAttributes) {
            this.tracer.addCustomAttributes(tags);
          }
          break;

        case 'xray':
          const segment = this.tracer?.getSegment();
          if (segment) {
            Object.entries(tags).forEach(([key, value]) => {
              if (typeof value === 'boolean') {
                segment.addAnnotation(key, value);
              } else if (typeof value === 'number') {
                segment.addAnnotation(key, value);
              } else {
                segment.addMetadata(key, value);
              }
            });
          }
          break;
      }
    } catch (error) {
      logger.debug('[APM] Failed to add tags', { error: (error as Error).message });
    }
  }

  /**
   * Get the current active provider
   */
  getProvider(): APMProvider {
    return this.provider;
  }

  /**
   * Check if APM is active
   */
  isActive(): boolean {
    return this.provider !== 'none' && this.tracer !== null;
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // PRIVATE HELPERS
  // ═══════════════════════════════════════════════════════════════════════════════

  private createNoopSpan(): APMSpan {
    return {
      finish: () => {},
      setTag: () => {},
      setError: () => {},
    };
  }

  private wrapDatadogSpan(span: any): APMSpan {
    return {
      finish: () => span?.finish(),
      setTag: (key: string, value: string | number | boolean) => span?.setTag(key, value),
      setError: (error: Error) => {
        span?.setTag('error', true);
        span?.setTag('error.message', error.message);
        span?.setTag('error.stack', error.stack || '');
      },
    };
  }

  private wrapXRaySubsegment(subsegment: any): APMSpan {
    return {
      finish: () => subsegment?.close(),
      setTag: (key: string, value: string | number | boolean) => {
        if (typeof value === 'boolean' || typeof value === 'number') {
          subsegment?.addAnnotation(key, value);
        } else {
          subsegment?.addMetadata(key, value);
        }
      },
      setError: (error: Error) => {
        subsegment?.addError(error);
      },
    };
  }
}

/**
 * Singleton APM tracer instance
 */
export const apmTracer = new APMTracer();

/**
 * Initialize APM (call early in application startup)
 */
export async function initAPM(): Promise<void> {
  return apmTracer.initialize();
}

export default apmTracer;
