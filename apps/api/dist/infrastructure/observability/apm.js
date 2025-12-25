import logger from '../../shared/utils/logger.js';
class APMTracer {
    provider = 'none';
    initialized = false;
    tracer = null;
    async initialize() {
        if (this.initialized) {
            return;
        }
        const config = {
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
        }
        catch (error) {
            logger.error('[APM] Failed to initialize APM tracer', {
                provider: config.provider,
                error: error.message,
            });
            this.provider = 'none';
        }
        this.initialized = true;
    }
    detectProvider() {
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
    async initDatadog(config) {
        try {
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
        }
        catch (error) {
            throw new Error(`Datadog tracer not available: ${error.message}. Install with: npm install dd-trace`);
        }
    }
    async initNewRelic(config) {
        logger.warn('[APM] New Relic should be initialized at application start. Add require("newrelic") to the first line of your entry file.');
        try {
            const newrelic = await import('newrelic');
            this.tracer = newrelic.default;
        }
        catch (error) {
            throw new Error(`New Relic not available: ${error.message}. Install with: npm install newrelic`);
        }
    }
    async initXRay(config) {
        try {
            const AWSXRay = await import('aws-xray-sdk');
            AWSXRay.default.setDaemonAddress(process.env.AWS_XRAY_DAEMON_ADDRESS || '127.0.0.1:2000');
            AWSXRay.default.setContextMissingStrategy('LOG_ERROR');
            this.tracer = AWSXRay.default;
        }
        catch (error) {
            throw new Error(`AWS X-Ray not available: ${error.message}. Install with: npm install aws-xray-sdk`);
        }
    }
    startSpan(operationName, options) {
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
                    return this.createNoopSpan();
                case 'xray':
                    const segment = this.tracer.getSegment();
                    const subsegment = segment?.addNewSubsegment(operationName);
                    return this.wrapXRaySubsegment(subsegment);
                default:
                    return this.createNoopSpan();
            }
        }
        catch (error) {
            logger.debug('[APM] Failed to create span', { error: error.message });
            return this.createNoopSpan();
        }
    }
    recordMetric(name, value, tags) {
        if (this.provider === 'none') {
            return;
        }
        try {
            switch (this.provider) {
                case 'datadog':
                    logger.debug('[APM] Datadog metric', { name, value, tags });
                    break;
                case 'newrelic':
                    if (this.tracer?.recordMetric) {
                        this.tracer.recordMetric(name, value);
                    }
                    break;
                case 'xray':
                    const segment = this.tracer?.getSegment();
                    if (segment) {
                        segment.addAnnotation(name, value);
                    }
                    break;
            }
        }
        catch (error) {
            logger.debug('[APM] Failed to record metric', { error: error.message });
        }
    }
    addTags(tags) {
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
                            }
                            else if (typeof value === 'number') {
                                segment.addAnnotation(key, value);
                            }
                            else {
                                segment.addMetadata(key, value);
                            }
                        });
                    }
                    break;
            }
        }
        catch (error) {
            logger.debug('[APM] Failed to add tags', { error: error.message });
        }
    }
    getProvider() {
        return this.provider;
    }
    isActive() {
        return this.provider !== 'none' && this.tracer !== null;
    }
    createNoopSpan() {
        return {
            finish: () => { },
            setTag: () => { },
            setError: () => { },
        };
    }
    wrapDatadogSpan(span) {
        return {
            finish: () => span?.finish(),
            setTag: (key, value) => span?.setTag(key, value),
            setError: (error) => {
                span?.setTag('error', true);
                span?.setTag('error.message', error.message);
                span?.setTag('error.stack', error.stack || '');
            },
        };
    }
    wrapXRaySubsegment(subsegment) {
        return {
            finish: () => subsegment?.close(),
            setTag: (key, value) => {
                if (typeof value === 'boolean' || typeof value === 'number') {
                    subsegment?.addAnnotation(key, value);
                }
                else {
                    subsegment?.addMetadata(key, value);
                }
            },
            setError: (error) => {
                subsegment?.addError(error);
            },
        };
    }
}
export const apmTracer = new APMTracer();
export async function initAPM() {
    return apmTracer.initialize();
}
export default apmTracer;
