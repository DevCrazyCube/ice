# Skill: Retrieval / RAG

## Status: Not Implemented (Phase 4)

Do not implement retrieval or vector DB until Phase 4. Read `docs/07-roadmap/current-phase.md` first.

## Planned Approach

When a user message arrives, relevant knowledge chunks are retrieved and injected into the agent's context.

```
User message
  → Embed message (vector)
  → Retrieve top-K chunks from knowledge base (scoped by org + agent)
  → Inject chunks into prompt as context
  → LLM generates response grounded in retrieved knowledge
```

## Rules

- All knowledge base data must be scoped by `organization_id`
- No cross-tenant retrieval under any circumstances
- Chunk retrieval must be fast — cache embeddings of stable documents
- Retrieved chunks must be cited or traceable (store source doc ID)
- Do not retrieve more chunks than fit in the model's context window minus conversation history

## Vector DB Choice

Not decided. Options: pgvector (preferred for simplicity — same Postgres instance), Pinecone, Qdrant.

Default to `pgvector` first — avoid introducing a new service until proven necessary.

## Cost Awareness

- Embedding calls cost money — batch and cache where possible
- Do not re-embed documents on every retrieval
- Track embedding costs per organization
