# Skill: Billing & Provisioning

## Status: Not Implemented (Phase 5)

Do not implement billing until Phase 5. Read `docs/07-roadmap/current-phase.md` first.

## Planned Model

ICE bills organizations based on usage. Likely dimensions:
- Conversations handled per month
- LLM tokens consumed
- Active agent seats

## Stripe Integration Pattern (Future)

- Stripe Checkout for initial subscription
- Stripe webhooks for subscription lifecycle events (created, updated, cancelled, payment failed)
- All Stripe webhooks must verify signature (see `webhook-security.md`)
- Subscription status stored locally — do not call Stripe on every request

## Provisioning Rules

- Creating an organization sets up a default free tier
- Feature access is gated by `organization.plan` field
- Plan checks are done in service layer, not in route handlers
- Degraded plan (e.g., payment failed) still allows read-only access

## Cost Attribution

- Track LLM token usage per organization per conversation
- Track by model so cost can be calculated at billing time
- Store raw usage counts — compute $ amounts at invoice time using current pricing

## Rules

- Never store card numbers or sensitive payment data — use Stripe tokens only
- Subscription events must be idempotent (duplicate webhook delivery safe)
- Failed payments must trigger a grace period, not immediate lockout
