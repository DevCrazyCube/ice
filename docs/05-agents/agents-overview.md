# Agents Overview

## ICE Has Exactly Two Agent Products

Do not add agent types outside of these two.

---

## 1. Acquisition Agent

**Purpose:** Handle new lead conversations for a business.

**Responsibilities:**
- Greet and engage inbound leads
- Qualify interest using configured qualification criteria
- Answer basic questions about the business using a configured knowledge base
- Move the lead toward a defined next step (booking a call, signing up, handing off to a human)
- Gracefully end conversations that are out of scope

**What it does NOT do:**
- Deep CRM operations
- Complex multi-step workflows
- Payment processing
- Final decision-making for qualified leads

**Configuration inputs (future):**
- Business name and description
- Qualification questions
- Knowledge base (FAQs, product info)
- Next step action (booking link, CRM webhook, handoff trigger)

---

## 2. Client Inbound Agent

**Purpose:** Handle inbound conversations for an existing client business's customers.

**Responsibilities:**
- Answer questions using the business's knowledge and policy
- Qualify or categorize the conversation topic
- Route to the right resource (human team, department, external link)
- Escalate safely when confidence is low or when policy requires human review

**What it does NOT do:**
- Replace human agents for complex or sensitive situations
- Make binding commitments on behalf of the business
- Access systems outside of configured integrations

**Configuration inputs (future):**
- Business knowledge base
- Escalation policy
- Routing rules
- Tone and persona settings

---

## Shared Principles

- All agent operations must include `organizationId` in context
- Agent responses must be deterministic and auditable (logged)
- No agent may take irreversible side effects without explicit policy configuration
- PII in conversations must not be logged at standard log levels
- Escalation is always a safe fallback — agents must be able to say "I'll connect you with a human"

---

## Foundation Phase Status

The agent runtime is **not implemented** in the foundation phase.

`packages/agents/` contains type placeholders only. Do not implement agent runtime until the agent phase begins.

Read `docs/07-roadmap/current-phase.md` before adding any code to `packages/agents/`.
