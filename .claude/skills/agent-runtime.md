# Skill: Agent Runtime

## Status: Not Implemented (Foundation Phase)

Do not implement agent runtime logic until Phase 3. Read `docs/07-roadmap/current-phase.md` first.

## Planned Architecture

Each conversation is handled by one agent — either `AcquisitionAgent` or `InboundAgent`.

```
Inbound message
  → ConversationService.handleMessage(orgId, convId, message)
    → Load agent config for this conversation
    → Load conversation history (last N turns)
    → Build prompt from config + history + message
    → Call LLM provider
    → Parse and validate response
    → Store message + agent reply
    → Trigger any configured side effects (webhook, escalation)
    → Return reply
```

## Rules

- No generic agent abstraction — implement what the two products need
- All LLM calls must include `organization_id` and `conversation_id` in metadata for auditability
- Conversation history must be truncated to fit context window — do not send unbounded history
- Agent responses must be validated before sending to users
- Escalation must always be possible — every agent must handle "I need to speak to a human"
- No direct prompt injection from user input — sanitize and structure before including in prompt

## Configuration

Agent configuration (persona, knowledge, escalation rules) is stored per-organization in the database. It is loaded at conversation start, not on every message.

## Cost Awareness

- Use the cheapest model that meets quality requirements
- Cache system prompts where possible
- Log token usage per conversation for cost attribution per organization
