# Skill: Observability and Tracing

## Phase: 1 — Foundations

OpenTelemetry + OTLP is a Phase 1 requirement. It must be set up before Phase 2 agent work begins, because agent runs, tool calls, and LLM costs all need to be traceable end-to-end.

## Standard

- **Transport:** OTLP (OpenTelemetry Protocol) — the stable standard for traces, metrics, and logs
- **Semantic conventions:** use OpenTelemetry semantic conventions for attribute naming to ensure consistency across services

## Core Semantic Attributes (All Spans)

These attributes must be present on every span:

| Attribute | Value | Phase |
|-----------|-------|-------|
| `tenant_id` | organisation UUID | 1 |
| `conversation_id` | conversation UUID | 1 |
| `channel_type` | sms \| web \| voice | 1 |
| `run_id` | agent run UUID | 2+ |

## Required Spans (Phase 1)

| Span name | Created by | Attributes |
|-----------|-----------|------------|
| `http.ingest` | Webhook route handler | `tenant_id`, `channel_type`, `delivery_id` |
| `outbox.enqueue` | After DB insert | `tenant_id`, `conversation_id`, `job_id` |
| `worker.process` | Worker loop | `tenant_id`, `conversation_id`, `job_id`, `attempts` |
| `outbound.send` | Outbound sender | `tenant_id`, `conversation_id`, `channel_type` |

## Required Metrics (Phase 1)

| Metric | Type | Description |
|--------|------|-------------|
| `webhooks.received` | Counter | All inbound webhooks |
| `webhooks.signature_failed` | Counter | Signature verification failures |
| `outbox.queue_depth` | Gauge | Pending jobs in outbox |
| `worker.job_duration` | Histogram | Time to process a job |
| `worker.failures` | Counter | Failed jobs |
| `outbound.send_failures` | Counter | Outbound delivery failures |

## Setup Pattern (Node.js)

```typescript
// apps/api/src/lib/telemetry.ts — initialise before anything else
import { NodeSDK } from "@opentelemetry/sdk-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-http";
import { PeriodicExportingMetricReader } from "@opentelemetry/sdk-metrics";
import { Resource } from "@opentelemetry/resources";
import { ATTR_SERVICE_NAME } from "@opentelemetry/semantic-conventions";

export function initTelemetry() {
  const sdk = new NodeSDK({
    resource: new Resource({ [ATTR_SERVICE_NAME]: "ice-api" }),
    traceExporter: new OTLPTraceExporter({
      url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? "http://localhost:4318/v1/traces",
    }),
    metricReader: new PeriodicExportingMetricReader({
      exporter: new OTLPMetricExporter({
        url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? "http://localhost:4318/v1/metrics",
      }),
      exportIntervalMillis: 10_000,
    }),
  });
  sdk.start();
}
```

Call `initTelemetry()` at the very start of `main.ts`, before imports that create spans.

## Span Example (Webhook Handler)

```typescript
import { trace, SpanStatusCode } from "@opentelemetry/api";

const tracer = trace.getTracer("ice-api");

export async function webhookHandler(req, res) {
  const span = tracer.startSpan("http.ingest", {
    attributes: {
      "tenant_id": req.orgId,
      "channel_type": req.params.channelType,
    },
  });
  try {
    // ... process ...
    span.setStatus({ code: SpanStatusCode.OK });
  } catch (err) {
    span.recordException(err as Error);
    span.setStatus({ code: SpanStatusCode.ERROR });
    throw err;
  } finally {
    span.end();
  }
}
```

## Trace Propagation

Trace context must propagate from the webhook ingest span through to the worker span. Pass the trace context via the outbox job payload:

```typescript
import { propagation, context } from "@opentelemetry/api";

// In webhook handler — capture trace context
const carrier: Record<string, string> = {};
propagation.inject(context.active(), carrier);

await db.query(
  `INSERT INTO outbox_jobs (organisation_id, type, payload) VALUES ($1, $2, $3)`,
  [orgId, "message.process", { conversationId, traceContext: carrier }]
);
```

```typescript
// In worker — restore trace context
const ctx = propagation.extract(context.active(), job.payload.traceContext);
context.with(ctx, async () => {
  const span = tracer.startSpan("worker.process");
  // ...
});
```

## Phase 2+ Additions

When Phase 2 begins, add spans for:
- `llm.call` — model, token counts, latency
- `kb.retrieve` — query, top_k, latency
- `tool.exec` — tool name, sensitivity, result status
- `guardrail.check` — type (input/output), passed/blocked

## Rules

- `initTelemetry()` must be called before any other app code in `main.ts`
- All spans must include `tenant_id`
- Never log PII in span attributes
- Use semantic convention attribute names where they exist
