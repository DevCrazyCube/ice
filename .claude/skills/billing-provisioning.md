# Skill: Billing & Provisioning

## Phase: 3 — Revenue-Ready Acquisition

Do not implement billing until Phase 3. Read `docs/07-roadmap/current-phase.md` first.
Phase 2 (Agent Capabilities) must be complete before Phase 3 begins.

## Billing Model

ICE bills organisations based on usage:
- Conversations handled per month
- LLM tokens consumed (tracked per model for cost attribution)
- Active agent seats

## Stripe Integration Pattern

- Stripe Checkout for initial subscription
- Stripe webhooks for subscription lifecycle: `customer.subscription.created`, `updated`, `deleted`, `invoice.payment_failed`
- All Stripe webhooks must use `express.raw()` and `stripe.webhooks.constructEvent()` (see `webhook-security.md`)
- Subscription status stored locally — do not call Stripe on every request

```typescript
// Webhook handler: subscription lifecycle
import Stripe from "stripe";

export async function handleStripeWebhook(rawBody: Buffer, sigHeader: string) {
  const event = stripe.webhooks.constructEvent(
    rawBody,
    sigHeader,
    process.env.STRIPE_WEBHOOK_SECRET!
  );
  switch (event.type) {
    case "customer.subscription.created":
    case "customer.subscription.updated":
      await orgService.updateSubscription(event.data.object);
      break;
    case "invoice.payment_failed":
      await orgService.enterGracePeriod(event.data.object.customer as string);
      break;
  }
}
```

## Provisioning Rules

- Creating an organisation sets up a default free tier
- Feature access is gated by `organisation.plan` field
- Plan checks done in service layer, not in route handlers
- Degraded plan (payment failed) → grace period, not immediate lockout; read-only access preserved
- Provisioning operations must be idempotent (duplicate Stripe webhook delivery safe)

## Cost Attribution

- Track LLM token usage per organisation per conversation
- Track by model so cost can be calculated at billing time
- Store raw usage counts — compute dollar amounts at invoice time using current pricing
- Attribute embedding costs separately from inference costs

## Rules

- Never store card numbers or payment data — Stripe tokens only
- Failed payments must trigger grace period, not immediate lockout
- Stripe webhook handlers must be idempotent
- Subscription events must propagate to audit log (action: `subscription.updated`)
