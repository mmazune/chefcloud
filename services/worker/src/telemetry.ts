import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { ConsoleSpanExporter } from '@opentelemetry/sdk-trace-node';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions';
import * as Sentry from '@sentry/node';

export function initTelemetry() {
  // Initialize Sentry
  if (process.env.SENTRY_DSN) {
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.2 : 1.0,
      environment: process.env.NODE_ENV || 'development',
    });
  }

  // Initialize OpenTelemetry
  const otlpEndpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
  const traceExporter = otlpEndpoint
    ? new OTLPTraceExporter({ url: otlpEndpoint })
    : new ConsoleSpanExporter();

  const sdk = new NodeSDK({
    resource: resourceFromAttributes({
      [ATTR_SERVICE_NAME]: 'chefcloud-worker',
    }),
    traceExporter,
    instrumentations: [
      getNodeAutoInstrumentations({
        '@opentelemetry/instrumentation-fs': { enabled: false },
      }),
    ],
  });

  sdk.start();

  // Graceful shutdown
  process.on('SIGTERM', () => {
    sdk
      .shutdown()
      .then(() => console.log('Telemetry shut down successfully'))
      .catch((error) => console.error('Error shutting down telemetry', error))
      .finally(() => process.exit(0));
  });
}
