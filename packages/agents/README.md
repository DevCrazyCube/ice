# @ice/agents

Agent runtime package for the ICE platform.

## Products

### Acquisition Agent (`src/acquisition/`)
Handles new lead conversations. Qualifies interest, answers basic product questions, moves leads toward a next step.

### Client Inbound Agent (`src/inbound/`)
Handles inbound conversations for client businesses. Uses business knowledge and policy to answer, qualify, route, or escalate.

### Shared (`src/shared/`)
Types and utilities shared between agent implementations.

## Rules

- No generic "agent framework" — implement only what these two products need
- All agent operations must include `organisationId` in context
- Do not implement agent runtime logic until the corresponding phase is started
- Read `docs/05-agents/agents-overview.md` and `docs/07-roadmap/current-phase.md` before adding code here
