/**
 * BusinessContext CRUD Validation Script
 *
 * Exercises the CRUD API endpoints for business context entries.
 * Requires: running API server + seeded database + valid session token.
 *
 * Usage:
 *   TOKEN=$(pnpm --filter @ice/api generate-token 2>/dev/null)
 *   pnpm --filter @ice/api prove:crud
 *
 * Or set API_BASE_URL and TOKEN env vars directly.
 *
 * Seed agent ID: c0000000-0000-0000-0000-000000000001
 */

import { config as dotenvConfig } from "dotenv";
import { resolve } from "node:path";

dotenvConfig({ path: resolve(import.meta.dirname, "../../../.env") });

const BASE = process.env["API_BASE_URL"] ?? "http://localhost:3001";
const TOKEN = process.env["TOKEN"] ?? "";
const AGENT_ID = "c0000000-0000-0000-0000-000000000001";
const FAKE_AGENT_ID = "00000000-0000-0000-0000-000000000000";

if (!TOKEN) {
  console.error("ERROR: TOKEN env var is required.");
  console.error("  TOKEN=$(pnpm --filter @ice/api generate-token 2>/dev/null) pnpm --filter @ice/api prove:crud");
  process.exit(1);
}

const headers = {
  "Authorization": `Bearer ${TOKEN}`,
  "Content-Type": "application/json",
};

let passed = 0;
let failed = 0;
let createdId: string | null = null;

async function api(method: string, path: string, body?: unknown): Promise<{ status: number; data: unknown }> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => null);
  return { status: res.status, data };
}

function assert(condition: boolean, name: string, detail?: string) {
  if (condition) {
    console.log(`  ✓ ${name}`);
    passed++;
  } else {
    console.log(`  ✗ FAIL: ${name}${detail ? ` — ${detail}` : ""}`);
    failed++;
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

async function testCreate() {
  console.log("\n[1] POST /agents/:agentId/context — create entry");

  const { status, data } = await api("POST", `/api/v1/agents/${AGENT_ID}/context`, {
    category: "profile",
    title: "About Us",
    content: "Seed Corp is a demo business for testing ICE.",
    sortOrder: 0,
  });

  assert(status === 201, "Returns 201");
  const entry = (data as Record<string, unknown>)?.["data"] as Record<string, unknown> | undefined;
  assert(!!entry?.["id"], "Response includes id");
  assert(entry?.["category"] === "profile", "Category matches");
  assert(entry?.["title"] === "About Us", "Title matches");
  assert(entry?.["source"] === "manual", "Source is manual");
  assert(entry?.["active"] === true, "Active defaults to true");
  assert(entry?.["agentId"] === AGENT_ID, "agentId matches");

  if (entry?.["id"]) {
    createdId = entry["id"] as string;
  }
}

async function testCreateValidation() {
  console.log("\n[2] POST validation — invalid payloads rejected");

  // Missing required fields
  const { status: s1 } = await api("POST", `/api/v1/agents/${AGENT_ID}/context`, {});
  assert(s1 === 400, "Empty body → 400");

  // Invalid category
  const { status: s2 } = await api("POST", `/api/v1/agents/${AGENT_ID}/context`, {
    category: "invalid",
    title: "Test",
    content: "Test content",
  });
  assert(s2 === 400, "Invalid category → 400");

  // Title too long
  const { status: s3 } = await api("POST", `/api/v1/agents/${AGENT_ID}/context`, {
    category: "services",
    title: "x".repeat(201),
    content: "Test content",
  });
  assert(s3 === 400, "Title >200 chars → 400");

  // Invalid agentId format
  const { status: s4 } = await api("POST", `/api/v1/agents/not-a-uuid/context`, {
    category: "services",
    title: "Test",
    content: "Test content",
  });
  assert(s4 === 400, "Invalid agentId → 400");
}

async function testCrossOrgBlocked() {
  console.log("\n[3] Cross-org access blocked");

  // Agent that doesn't exist or belongs to another org → 404
  const { status } = await api("POST", `/api/v1/agents/${FAKE_AGENT_ID}/context`, {
    category: "profile",
    title: "Test",
    content: "Should not work",
  });
  assert(status === 404, "Non-existent agent → 404 (not 403)");

  const { status: s2 } = await api("GET", `/api/v1/agents/${FAKE_AGENT_ID}/context`);
  assert(s2 === 404, "GET non-existent agent → 404");
}

async function testList() {
  console.log("\n[4] GET /agents/:agentId/context — list entries");

  const { status, data } = await api("GET", `/api/v1/agents/${AGENT_ID}/context`);
  assert(status === 200, "Returns 200");

  const entries = (data as Record<string, unknown>)?.["data"] as unknown[];
  assert(Array.isArray(entries), "Response data is array");
  assert(entries.length > 0, "At least one entry exists");

  // All entries should belong to this agent
  const allCorrectAgent = entries.every(
    (e) => (e as Record<string, unknown>)["agentId"] === AGENT_ID
  );
  assert(allCorrectAgent, "All entries belong to the correct agent");
}

async function testListFilters() {
  console.log("\n[5] GET with query filters");

  // Create a second entry in a different category
  await api("POST", `/api/v1/agents/${AGENT_ID}/context`, {
    category: "services",
    title: "Test Service",
    content: "A test service entry.",
  });

  const { status, data } = await api("GET", `/api/v1/agents/${AGENT_ID}/context?category=profile`);
  assert(status === 200, "Category filter returns 200");
  const entries = (data as Record<string, unknown>)?.["data"] as unknown[];
  assert(Array.isArray(entries), "Filtered data is array");
  const allProfile = entries.every(
    (e) => (e as Record<string, unknown>)["category"] === "profile"
  );
  assert(allProfile, "All entries match category filter");
}

async function testUpdate() {
  console.log("\n[6] PATCH /agents/:agentId/context/:contextId — update entry");

  if (!createdId) {
    console.log("  SKIP: no entry created in test 1");
    return;
  }

  const { status, data } = await api("PATCH", `/api/v1/agents/${AGENT_ID}/context/${createdId}`, {
    title: "About Us (Updated)",
    content: "Seed Corp is a demo business for testing ICE. Updated.",
  });

  assert(status === 200, "Returns 200");
  const entry = (data as Record<string, unknown>)?.["data"] as Record<string, unknown> | undefined;
  assert(entry?.["title"] === "About Us (Updated)", "Title updated");
  assert((entry?.["content"] as string)?.includes("Updated"), "Content updated");
}

async function testDeactivate() {
  console.log("\n[7] DELETE (soft) — deactivate entry");

  if (!createdId) {
    console.log("  SKIP: no entry created in test 1");
    return;
  }

  const { status, data } = await api("DELETE", `/api/v1/agents/${AGENT_ID}/context/${createdId}`);
  assert(status === 200, "Returns 200");
  const entry = (data as Record<string, unknown>)?.["data"] as Record<string, unknown> | undefined;
  assert(entry?.["active"] === false, "Entry is now inactive");
}

async function testReactivate() {
  console.log("\n[8] PATCH to reactivate — set active: true");

  if (!createdId) {
    console.log("  SKIP: no entry created in test 1");
    return;
  }

  const { status, data } = await api("PATCH", `/api/v1/agents/${AGENT_ID}/context/${createdId}`, {
    active: true,
  });

  assert(status === 200, "Returns 200");
  const entry = (data as Record<string, unknown>)?.["data"] as Record<string, unknown> | undefined;
  assert(entry?.["active"] === true, "Entry is reactivated");
}

async function testUpdateNonExistent() {
  console.log("\n[9] PATCH/DELETE non-existent entry → 404");

  const fakeId = "00000000-0000-0000-0000-000000000099";

  const { status: s1 } = await api("PATCH", `/api/v1/agents/${AGENT_ID}/context/${fakeId}`, {
    title: "Should fail",
  });
  assert(s1 === 404, "PATCH non-existent → 404");

  const { status: s2 } = await api("DELETE", `/api/v1/agents/${AGENT_ID}/context/${fakeId}`);
  assert(s2 === 404, "DELETE non-existent → 404");
}

async function testEmptyUpdate() {
  console.log("\n[10] PATCH with empty body → 400");

  if (!createdId) {
    console.log("  SKIP: no entry created in test 1");
    return;
  }

  const { status } = await api("PATCH", `/api/v1/agents/${AGENT_ID}/context/${createdId}`, {});
  assert(status === 400, "Empty update body → 400");
}

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

async function main() {
  console.log("=".repeat(70));
  console.log("BUSINESSCONTEXT CRUD VALIDATION");
  console.log(`Base: ${BASE}  Agent: ${AGENT_ID}`);
  console.log("=".repeat(70));

  await testCreate();
  await testCreateValidation();
  await testCrossOrgBlocked();
  await testList();
  await testListFilters();
  await testUpdate();
  await testDeactivate();
  await testReactivate();
  await testUpdateNonExistent();
  await testEmptyUpdate();

  console.log("\n" + "=".repeat(70));
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log("=".repeat(70));

  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
