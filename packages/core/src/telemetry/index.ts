import {
  trace,
  context,
  propagation,
  SpanStatusCode,
  type Span,
  type Attributes,
} from "@opentelemetry/api";

const TRACER_NAME = "ice";

/**
 * Start a new span with standard ICE semantic attributes.
 * Callers are responsible for calling span.end() — or use withSpan().
 */
export function startSpan(name: string, attributes?: Attributes): Span {
  return trace.getTracer(TRACER_NAME).startSpan(name, { attributes });
}

/**
 * Execute a function inside a span. Automatically ends the span and
 * records any thrown error.
 */
export async function withSpan<T>(
  name: string,
  attributes: Attributes,
  fn: (span: Span) => Promise<T>
): Promise<T> {
  const span = trace.getTracer(TRACER_NAME).startSpan(name, { attributes });
  try {
    const result = await fn(span);
    span.setStatus({ code: SpanStatusCode.OK });
    return result;
  } catch (err) {
    span.recordException(err as Error);
    span.setStatus({ code: SpanStatusCode.ERROR });
    throw err;
  } finally {
    span.end();
  }
}

/**
 * Restore a trace context from a serialised carrier (e.g. outbox job payload).
 * Returns a context that can be used with context.with().
 */
export function extractTraceContext(
  carrier: Record<string, string>
): ReturnType<typeof context.active> {
  return propagation.extract(context.active(), carrier);
}

export { SpanStatusCode };
