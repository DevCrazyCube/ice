# Skill: Webhook Security

## Phase: 1 — Foundations

Webhook security is a Phase 1 requirement. Implement before any webhook processing logic.

## The Three Requirements

1. **Preserve raw body** — capture the raw `Buffer` before any JSON parsing
2. **Verify signature** before touching the payload as data
3. **Return 200 immediately** after signature check passes — process asynchronously

## Critical: Raw Body Requirement

Stripe and some Twilio verification methods require the **original unmodified request body** as a `Buffer`. If `express.json()` runs first, the body is mutated and signature verification will fail.

```typescript
// Correct route setup for webhook endpoints
app.post(
  "/webhooks/inbound/:channel",
  express.raw({ type: "*/*" }),   // ← capture raw body as Buffer
  webhookHandler
);

// Wrong — do NOT use express.json() on webhook routes
app.post("/webhooks/inbound/:channel", express.json(), webhookHandler); // breaks Stripe
```

## Twilio Signature Verification

Use the official `twilio` SDK. Do not reimplement the algorithm manually.

```typescript
import { validateRequest } from "twilio";

export function verifyTwilioSignature(req: Request): boolean {
  const sig = req.headers["x-twilio-signature"] as string;
  const url = process.env.PUBLIC_WEBHOOK_URL!;  // must exactly match what Twilio has on file
  const params = req.body as Record<string, string>;  // Twilio sends form-encoded body
  return validateRequest(process.env.TWILIO_AUTH_TOKEN!, sig, url, params);
}
```

URL must match **exactly** — including protocol (`https`), port, and path. Even a trailing slash difference will break verification.

## Stripe Signature Verification

```typescript
import Stripe from "stripe";
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export function verifyStripeSignature(rawBody: Buffer, sigHeader: string): Stripe.Event {
  // rawBody must be the Buffer from express.raw() — not JSON.parse'd
  return stripe.webhooks.constructEvent(
    rawBody,
    sigHeader,
    process.env.STRIPE_WEBHOOK_SECRET!
  );
  // Throws if invalid — catch and return 400
}
```

## Idempotency

Store the provider's delivery ID before processing. Return `200` on duplicates.

```typescript
const deliveryId = req.headers["x-twilio-message-sid"] as string; // Twilio
// or: event.id for Stripe

const exists = await webhookRepo.deliveryExists(orgId, deliveryId);
if (exists) return res.status(200).json({ status: "duplicate" });

await webhookRepo.storeDelivery(orgId, deliveryId);
// Now safe to enqueue
```

Return `200` (not `409` or `400`) for duplicates. Providers retry on non-2xx responses — returning `200` stops the retry loop.

## Rate Limiting

Apply per-organisation rate limiting before signature verification:

```typescript
// Redis token bucket (Phase 1 optional — can use in-memory initially)
const key = `rl:webhook:${orgId}:${bucket}`;
const count = await redis.incr(key);
if (count === 1) await redis.expire(key, windowSec);
if (count > limit) return res.status(429).json({ error: { code: "RATE_LIMITED" } });
```

## Audit Logging

Every webhook arrival must produce an audit event:
- `action: "webhook.received"` with `deliveryId`, `channelType`, `orgId`, result
- `action: "webhook.signature_failed"` with `provider`, `ip_address`, no payload content

## Rules Summary

- Raw body → verify signature → 200 ACK → persist → enqueue (in that order)
- Never process payload before verifying signature
- Never log webhook payload content (PII)
- Never return non-2xx on duplicate delivery
- One signing secret per integration (not shared across tenants)
- Secrets are rotatable without code deployment
