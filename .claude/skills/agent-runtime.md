# Skill: Agent Runtime

## Phase: 2 — Agent Capabilities

Do not implement agent runtime logic until Phase 2. Read `docs/07-roadmap/current-phase.md` first.
Phase 1 (Foundations) must be complete: tenancy, auth, audit, webhook ingest, outbox, worker skeleton, OTel.

## Architecture

Each conversation is handled by one agent — either `AcquisitionAgent` or `InboundAgent`.
No generic agent framework. No multi-agent coordination.

```
Outbox job (message.process)
  → Worker picks up job
    → ConversationService.processInbound(orgId, convId)
      → Load AgentSpec for this conversation's agent
      → Load conversation history (last N turns, bounded)
      → Build three-layer prompt: SYSTEM (safety) + DEVELOPER (persona) + USER (message)
      → Call LLM provider
      → Validate and parse response
      → Store agent reply
      → Trigger configured side effects (escalation, webhook)
      → Enqueue outbound send job
```

## Three-Layer Prompt Structure

Safety rules must be in the SYSTEM role. Never in USER role.

| Layer | Role | Content |
|-------|------|---------|
| 1 | SYSTEM | Safety constraints, guardrails — cannot be overridden |
| 2 | DEVELOPER | Agent persona, knowledge, behaviour policy |
| 3 | USER | End-user message |

```typescript
const messages = [
  { role: "system", content: safetyRules },       // hardcoded, not configurable
  { role: "developer", content: agentPersona },   // from AgentSpec
  { role: "user", content: userMessage },
];
```

## AgentSpec v1

Agent configuration is stored per-organisation in the database.
See `packages/schemas/src/agent-spec.ts` for the machine-readable contract.

Loaded at conversation start, not on every message.

## Tool Gateway

Tools available to agents are defined in `ToolSpec`. Each tool call:
- Must be authorised against the agent's allowed tool list
- Must be logged as a `tool.exec` span (see `observability-tracing.md`)
- Must be idempotent or compensatable

## OTel Spans (Phase 2 additions)

| Span | Attributes |
|------|-----------|
| `llm.call` | `model`, `prompt_tokens`, `completion_tokens`, `latency_ms` |
| `tool.exec` | `tool_name`, `tool_sensitivity`, `result_status` |
| `guardrail.check` | `check_type` (input/output), `passed` (bool) |

## Rules

- No LLM calls inside webhook route handlers — always via worker
- All LLM calls must include `organisation_id` and `conversation_id` in metadata
- Conversation history must be bounded — do not send unbounded history to LLM
- Agent responses must be validated before sending to users
- Escalation must always be possible — handle "I need a human" in every agent
- Never pass raw user input directly into prompt — structure it
- Use cheapest model that meets quality requirements; log token usage per conversation
