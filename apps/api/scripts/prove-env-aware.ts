/**
 * Environment-Aware Proof Script
 *
 * Proves the runtime is truly environment-aware by sending the exact same
 * inbound message through two different business contexts and showing
 * the outputs differ appropriately.
 *
 * Run: pnpm --filter @ice/api prove:env-aware
 *
 * No database required. Exercises the real runInbound() engine.
 */

import { runInbound } from "@ice/agents";
import type { RuntimeInput } from "@ice/agents";
import type { AssembledBusinessContext, AgentSpecV1 } from "@ice/schemas";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const SPEC: AgentSpecV1 = {
  specVersion: "1",
  type: "inbound",
  name: "Test Agent",
  persona: "Helpful assistant",
  goal: "Assist customers",
  allowedToolIds: [],
  updatedAt: new Date().toISOString(),
};

const DENTIST_CTX: AssembledBusinessContext = {
  organisationId: "org-dentist",
  agentId: "agent-dentist",
  assembledAt: new Date().toISOString(),
  entries: [
    {
      id: "d1", organisationId: "org-dentist", agentId: "agent-dentist",
      category: "profile", title: "About Us",
      content: "Bright Smile Dental is a family dentistry practice in Austin, TX specializing in cosmetic and preventive care.",
      sortOrder: 0, active: true, source: "manual",
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    },
    {
      id: "d2", organisationId: "org-dentist", agentId: "agent-dentist",
      category: "services", title: "Teeth Cleaning",
      content: "Professional dental cleaning removes plaque and tartar buildup. Recommended twice yearly. $150 per visit.",
      sortOrder: 0, active: true, source: "manual",
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    },
    {
      id: "d3", organisationId: "org-dentist", agentId: "agent-dentist",
      category: "services", title: "Teeth Whitening",
      content: "Professional whitening in one session. Results visible immediately. $250 per session.",
      sortOrder: 1, active: true, source: "manual",
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    },
    {
      id: "d4", organisationId: "org-dentist", agentId: "agent-dentist",
      category: "faq", title: "Insurance accepted?",
      content: "We accept Delta Dental, Cigna, and Aetna. Out-of-network patients receive a 10% courtesy discount.",
      sortOrder: 0, active: true, source: "manual",
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    },
    {
      id: "d5", organisationId: "org-dentist", agentId: "agent-dentist",
      category: "tone", title: "Voice",
      content: "Warm, reassuring, and professional. Use simple language. Avoid clinical jargon.",
      sortOrder: 0, active: true, source: "manual",
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    },
  ],
};

const PLUMBER_CTX: AssembledBusinessContext = {
  organisationId: "org-plumber",
  agentId: "agent-plumber",
  assembledAt: new Date().toISOString(),
  entries: [
    {
      id: "p1", organisationId: "org-plumber", agentId: "agent-plumber",
      category: "profile", title: "About Us",
      content: "QuickFix Plumbing provides 24/7 emergency plumbing, drain cleaning, and water heater services in the Denver metro area.",
      sortOrder: 0, active: true, source: "manual",
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    },
    {
      id: "p2", organisationId: "org-plumber", agentId: "agent-plumber",
      category: "services", title: "Emergency Repair",
      content: "24/7 emergency service for burst pipes, major leaks, and sewer backups. $150 service call fee. Same-day response guaranteed.",
      sortOrder: 0, active: true, source: "manual",
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    },
    {
      id: "p3", organisationId: "org-plumber", agentId: "agent-plumber",
      category: "services", title: "Drain Cleaning",
      content: "Professional drain cleaning using hydro-jetting. Clears roots, grease, and buildup. $200 flat rate for most residential drains.",
      sortOrder: 1, active: true, source: "manual",
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    },
    {
      id: "p4", organisationId: "org-plumber", agentId: "agent-plumber",
      category: "faq", title: "Do you offer free estimates?",
      content: "Yes, we provide free estimates for non-emergency work. For emergencies, the $150 service call fee applies and is credited toward the repair.",
      sortOrder: 0, active: true, source: "manual",
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    },
    {
      id: "p5", organisationId: "org-plumber", agentId: "agent-plumber",
      category: "tone", title: "Voice",
      content: "Direct, practical, and confident. Use everyday language. Emphasize speed and reliability.",
      sortOrder: 0, active: true, source: "manual",
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    },
  ],
};

// ---------------------------------------------------------------------------
// Build input for a given context
// ---------------------------------------------------------------------------

function buildInput(
  messageBody: string,
  ctx: AssembledBusinessContext,
  channelType: "sms" | "web" = "sms"
): RuntimeInput {
  return {
    jobId: "proof-job",
    organisationId: ctx.organisationId,
    agentId: ctx.agentId,
    channelId: "proof-channel",
    message: {
      deliveryId: "proof-delivery",
      body: messageBody,
      from: "+15551234567",
      to: "+15559876543",
      channelType,
      rawParams: {},
    },
    agentSpec: SPEC,
    businessContext: ctx,
  };
}

// ---------------------------------------------------------------------------
// Run proof
// ---------------------------------------------------------------------------

interface Scenario {
  name: string;
  message: string;
}

const SCENARIOS: Scenario[] = [
  { name: "General inquiry", message: "What services do you offer?" },
  { name: "Pricing question", message: "How much does it cost?" },
  { name: "Insurance/estimate", message: "Do you accept insurance or offer estimates?" },
  { name: "Escalation request", message: "Can I speak to a human please?" },
];

async function main() {
  console.log("=".repeat(72));
  console.log("  ENVIRONMENT-AWARE PROOF: Same messages, different contexts");
  console.log("=".repeat(72));

  for (const scenario of SCENARIOS) {
    console.log(`\n--- ${scenario.name} ---`);
    console.log(`Input: "${scenario.message}"\n`);

    const dentistOut = await runInbound(buildInput(scenario.message, DENTIST_CTX));
    const plumberOut = await runInbound(buildInput(scenario.message, PLUMBER_CTX));

    console.log("  DENTIST:");
    console.log(`    Decision: ${dentistOut.decision.type} (${dentistOut.decision.confidence})`);
    console.log(`    Reply:    ${dentistOut.formattedReply ?? "(none)"}`);
    if (dentistOut.decision.escalationReason) {
      console.log(`    Escalation: ${dentistOut.decision.escalationReason}`);
    }

    console.log("");

    console.log("  PLUMBER:");
    console.log(`    Decision: ${plumberOut.decision.type} (${plumberOut.decision.confidence})`);
    console.log(`    Reply:    ${plumberOut.formattedReply ?? "(none)"}`);
    if (plumberOut.decision.escalationReason) {
      console.log(`    Escalation: ${plumberOut.decision.escalationReason}`);
    }

    console.log("");

    const same = dentistOut.formattedReply === plumberOut.formattedReply;
    if (dentistOut.decision.type === "escalate" && plumberOut.decision.type === "escalate") {
      console.log("  Result: Both escalated (expected for human-request messages)");
    } else if (same) {
      console.log("  Result: ⚠ SAME OUTPUT — not environment-aware for this input");
    } else {
      console.log("  Result: ✓ DIFFERENT — engine is environment-aware");
    }
  }

  console.log("\n" + "=".repeat(72));
  console.log("  PROOF COMPLETE");
  console.log("=".repeat(72));
}

main();
