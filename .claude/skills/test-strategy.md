# Skill: Test Strategy

## Status: Not Implemented (Foundation Phase)

Testing infrastructure is not set up in the foundation phase. This doc describes the intended approach.

## Test Levels

### Unit Tests
- Test service layer logic in isolation
- Mock repository calls
- Fast, no I/O
- Framework: Vitest

### Integration Tests
- Test API routes end-to-end (HTTP → DB → response)
- Use a real test database (separate schema or DB)
- Framework: Vitest + supertest

### No E2E Tests in Early Phases
E2E tests (Playwright, Cypress) are expensive to maintain. Defer until the product is stable.

## Rules

- Tests live next to the code they test: `service.test.ts` beside `service.ts`
- No test files in `src/` — use `*.test.ts` convention
- Tests must not share state — each test is fully isolated
- Never mock the module under test — mock its dependencies
- Test the behavior, not the implementation

## What to Test

| Layer | Test? | Notes |
|-------|-------|-------|
| Repository (SQL) | Integration | Test against real DB |
| Service (logic) | Unit | Mock repository |
| Routes (HTTP) | Integration | Use supertest |
| Utilities | Unit | Straightforward |
| Components (React) | Defer | Not yet |

## Cost Awareness

- Fast unit tests should dominate the test suite
- Integration tests run in CI but not on every file save
- No flaky tests — a flaky test is worse than no test
