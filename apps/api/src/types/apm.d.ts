/**
 * Type declarations for optional APM packages
 * These are declared as optional dependencies to prevent TypeScript errors
 * when the packages are not installed.
 */

declare module 'dd-trace' {
  interface TracerOptions {
    service?: string;
    env?: string;
    version?: string;
    sampleRate?: number;
    runtimeMetrics?: boolean;
    logInjection?: boolean;
    startupLogs?: boolean;
  }

  interface Span {
    finish(): void;
    setTag(key: string, value: string | number | boolean): void;
  }

  interface Scope {
    active(): Span | null;
  }

  interface Tracer {
    init(options?: TracerOptions): Tracer;
    scope(): Scope;
  }

  const tracer: Tracer;
  export default tracer;
}

declare module 'newrelic' {
  interface NewRelic {
    recordMetric(name: string, value: number): void;
    addCustomAttributes(attributes: Record<string, string | number | boolean>): void;
    startWebTransaction(name: string, callback: () => void): void;
    endTransaction(): void;
    noticeError(error: Error): void;
  }

  const newrelic: NewRelic;
  export default newrelic;
}

declare module 'aws-xray-sdk' {
  interface Segment {
    addNewSubsegment(name: string): Subsegment;
    addAnnotation(key: string, value: string | number | boolean): void;
    addMetadata(key: string, value: any): void;
    close(): void;
  }

  interface Subsegment {
    close(): void;
    addAnnotation(key: string, value: string | number | boolean): void;
    addMetadata(key: string, value: any): void;
    addError(error: Error): void;
  }

  interface AWSXRay {
    setDaemonAddress(address: string): void;
    setContextMissingStrategy(strategy: string): void;
    getSegment(): Segment | null;
    captureAWS<T>(client: T): T;
    captureHTTPs(module: any): any;
  }

  const AWSXRay: AWSXRay;
  export default AWSXRay;
}
