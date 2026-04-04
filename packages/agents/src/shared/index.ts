/**
 * Shared runtime contracts for the ICE agent engine.
 *
 * These types define the boundary between the worker (apps/api) and the
 * agent runtime (packages/agents). The worker assembles RuntimeInput,
 * the engine returns RuntimeOutput.
 *
 * Three-layer prompt architecture:
 *   Layer 1 (SYSTEM): core behaviour — safety, validation, conversation flow
 *   Layer 2 (DEVELOPER): business context — per-tenant environment
 *   Layer 3 (CHANNEL): formatting, length limits, provider constraints
 */

import type {
  AgentSpecV1,
  AssembledBusinessContext,
} from "@ice/schemas";

// ---------------------------------------------------------------------------
// RuntimeInput — everything the worker passes into the engine
// ---------------------------------------------------------------------------

/** The inbound message extracted from the webhook payload */
export interface InboundMessage {
  /** Provider message ID (e.g. Twilio MessageSid) */
  deliveryId: string;
  /** Message body text */
  body: string;
  /** Sender identifier (e.g. phone number) */
  from: string;
  /** Recipient identifier */
  to: string;
  /** Channel type */
  channelType: "sms" | "web" | "voice";
  /** Raw provider params — available for channel-specific logic */
  rawParams: Record<string, string>;
}

/** Full input to the agent engine for a single turn */
export interface RuntimeInput {
  /** Outbox job ID — for tracing and logging */
  jobId: string;
  /** Organisation ID — tenant isolation */
  organisationId: string;
  /** Agent ID */
  agentId: string;
  /** Channel ID */
  channelId: string;
  /** The inbound message to process */
  message: InboundMessage;
  /** Agent spec loaded from DB */
  agentSpec: AgentSpecV1;
  /** Assembled business context (all active entries for this agent) */
  businessContext: AssembledBusinessContext;
}

// ---------------------------------------------------------------------------
// RuntimeContext — internal assembled context for the engine
// ---------------------------------------------------------------------------

/** The three-layer prompt structure, assembled from RuntimeInput */
export interface RuntimeContext {
  /** Layer 1: core behaviour prompt (SYSTEM) */
  systemPrompt: string;
  /** Layer 2: business context prompt (DEVELOPER) */
  developerPrompt: string;
  /** Layer 3: channel-specific rules */
  channelRules: string;
  /** The user message text */
  userMessage: string;
}

// ---------------------------------------------------------------------------
// RuntimeDecision — the engine's internal decision before formatting
// ---------------------------------------------------------------------------

export type DecisionType = "reply" | "escalate" | "no_response";

export interface RuntimeDecision {
  /** What the engine decided to do */
  type: DecisionType;
  /** The reply text (populated for "reply" and "escalate") */
  replyText: string | null;
  /** Reason for escalation (populated for "escalate") */
  escalationReason: string | null;
  /** Confidence indicator (for future use — always "high" in stub) */
  confidence: "high" | "medium" | "low";
}

// ---------------------------------------------------------------------------
// RuntimeOutput — what the engine returns to the worker
// ---------------------------------------------------------------------------

export interface RuntimeOutput {
  /** Whether processing succeeded */
  success: boolean;
  /** The decision the engine made */
  decision: RuntimeDecision;
  /** Formatted reply text ready for the channel (may differ from decision.replyText due to channel rules) */
  formattedReply: string | null;
  /** Processing duration in milliseconds */
  durationMs: number;
  /** Error message if success is false */
  error: string | null;
}
