/**
 * Type declarations for winston-datadog
 * This package doesn't have official TypeScript types.
 */

declare module "winston-datadog" {
  import Transport from "winston-transport";

  interface DatadogTransportOptions {
    /** Datadog API key */
    apiKey: string;
    /** Source identifier for logs */
    ddsource?: string;
    /** Service name */
    service?: string;
    /** Hostname */
    hostname?: string;
    /** Tags to attach to all logs */
    tags?: string[];
  }

  class DatadogTransport extends Transport {
    constructor(options: DatadogTransportOptions);
  }

  export = DatadogTransport;
}
