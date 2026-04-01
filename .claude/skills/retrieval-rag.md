# Skill: Retrieval / RAG

## Phase: 2 — Agent Capabilities

Do not implement retrieval or vector DB until Phase 2. Read `docs/07-roadmap/current-phase.md` first.
Phase 1 (Foundations) must be complete before Phase 2 begins.

## Planned Approach

When a user message arrives, relevant knowledge chunks are retrieved and injected into the agent's context before the LLM call.

```
User message
  → Embed message (vector)
  → Retrieve top-K chunks from knowledge base (scoped by org + agent)
  → Inject chunks into DEVELOPER-layer prompt as context
  → LLM generates response grounded in retrieved knowledge
```

## Vector DB: pgvector First

Default to `pgvector` — same Postgres instance, no new service.

```sql
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE knowledge_chunks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES organisations(id),
  agent_id        UUID NOT NULL,
  content         TEXT NOT NULL,
  embedding       VECTOR(1536),
  source_doc_id   UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ON knowledge_chunks
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);
```

Only upgrade to Pinecone or Qdrant if pgvector cannot meet latency requirements at scale.

## OTel Span (Phase 2)

| Span | Attributes |
|------|-----------|
| `kb.retrieve` | `query_hash`, `top_k`, `latency_ms`, `chunks_returned` |

## Rules

- All knowledge base data must be scoped by `organisation_id`
- No cross-tenant retrieval under any circumstances
- Chunk retrieval must be fast — cache embeddings of stable documents
- Retrieved chunks must be traceable to source doc (store `source_doc_id`)
- Do not retrieve more chunks than fit in context window minus conversation history
- Embedding calls cost money — batch and cache; do not re-embed on every retrieval
- Track embedding costs per organisation
