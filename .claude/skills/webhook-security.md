# Skill: Webhook Security

## Status: Not Implemented (Foundation Phase)

Webhooks are a future feature. Do not implement until the relevant integration phase.

## Required Pattern

Every inbound webhook endpoint must:

1. **Read the raw body** (do not parse JSON first)
2. **Verify the signature** before any processing
3. **Reject early** with `401` if signature is invalid
4. **Process idempotently** — duplicate webhook delivery must be a no-op

## Signature Verification

```typescript
import { createHmac, timingSafeEqual } from "crypto";

function verifyWebhookSignature(
  rawBody: Buffer,
  signature: string,
  secret: string
): boolean {
  const expected = createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex");
  const sigBuffer = Buffer.from(signature);
  const expBuffer = Buffer.from(expected);
  if (sigBuffer.length !== expBuffer.length) return false;
  return timingSafeEqual(sigBuffer, expBuffer);
}
```

**Always use `timingSafeEqual`** — never `===` for signature comparison (timing attack vulnerability).

## Idempotency

Store a `webhook_delivery_id` (from the webhook provider's headers) and check for duplicates before processing:

```typescript
// Check if already processed
const exists = await webhookRepository.findDelivery(orgId, deliveryId);
if (exists) return res.status(200).json({ status: "duplicate" });
```

## Rules

- One secret per integration (not shared across tenants)
- Secrets rotatable without code deployment
- Log `delivery_id` and result, never log the payload content
- Return `200` for duplicates (so the provider doesn't retry forever)
