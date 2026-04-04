import { z } from "zod";

/**
 * AgentSpec v1 — machine-readable configuration for an ICE agent.
 *
 * Stored per-organisation in the database. Loaded at conversation start,
 * not on every message. Defines behaviour for AcquisitionAgent or InboundAgent.
 *
 * Phase: 2 (Agent Capabilities). Placeholder shape defined in Phase 1.
 */

export const agentTypeSchema = z.enum(["acquisition", "inbound"]);
export type AgentType = z.infer<typeof agentTypeSchema>;

export const escalationTriggerSchema = z.object({
  /** Plain-language condition that triggers escalation */
  condition: z.string(),
  /** Message sent to user when escalating */
  message: z.string(),
});

export const agentSpecV1Schema = z.object({
  /** Schema version — must be "1" */
  specVersion: z.literal("1"),

  /** Which product this agent implements */
  type: agentTypeSchema,

  /** Display name for this agent */
  name: z.string().min(1).max(100),

  /**
   * Agent persona — injected as the DEVELOPER-layer prompt.
   * Must not contain safety rules (those are hardcoded in SYSTEM layer).
   */
  persona: z.string().min(1).max(8000),

  /**
   * Goal statement — what the agent is trying to achieve per conversation.
   * Example: "Qualify the lead and book a discovery call."
   */
  goal: z.string().min(1).max(500),

  /**
   * IDs of tools this agent is permitted to call.
   * Validated against ToolSpec registry at runtime.
   * Empty array means no tools (LLM-only).
   */
  allowedToolIds: z.array(z.string()).default([]),

  /** Escalation conditions — when to hand off to a human */
  escalationTriggers: z.array(escalationTriggerSchema).default([
    {
      condition: "User explicitly requests a human agent",
      message: "I'll connect you with a human now. One moment please.",
    },
  ]),

  /**
   * Maximum conversation turns before suggesting escalation.
   * Prevents unbounded LLM cost per conversation.
   */
  maxTurns: z.number().int().positive().max(100).default(20),

  /** ISO-8601 datetime of last update */
  updatedAt: z.string().datetime().optional(),
});

export type AgentSpecV1 = z.infer<typeof agentSpecV1Schema>;
