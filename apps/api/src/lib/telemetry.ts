/**
 * OpenTelemetry SDK bootstrap.
 *
 * This file must be loaded via --import BEFORE the rest of the application:
 *   tsx --import ./src/lib/telemetry.ts watch src/main.ts
 *
 * When OTEL_EXPORTER_OTLP_ENDPOINT is not set, telemetry is skipped silently.
 * This allows local dev without a collector.
 *
 * Phase 1 required spans:
 *   http.ingest    — webhook received
 *   outbox.enqueue — job inserted into outbox
 *   worker.process — job picked up by worker
 *
 * Core semantic attributes on all spans:
 *   tenant_id       — organisation UUID
 *   conversation_id — conversation UUID
 */

import { NodeSDK } from "@opentelemetry/sdk-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { Resource } from "@opentelemetry/resources";
import { ATTR_SERVICE_NAME } from "@opentelemetry/semantic-conventions";

let sdk: NodeSDK | null = null;

function startTelemetry(): void {
  const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
  if (!endpoint) {
    // No collector configured — no-op. Spans are created but not exported.
    return;
  }

  sdk = new NodeSDK({
    resource: new Resource({
      [ATTR_SERVICE_NAME]: "ice-api",
    }),
    traceExporter: new OTLPTraceExporter({
      url: `${endpoint}/v1/traces`,
    }),
  });

  sdk.start();
}

export async function stopTelemetry(): Promise<void> {
  await sdk?.shutdown();
}

// Auto-start when imported (required for --import loader pattern)
startTelemetry();
