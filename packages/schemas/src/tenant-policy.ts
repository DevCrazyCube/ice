import { z } from "zod";

/**
 * TenantPolicy v1 — per-organisation policy constraints applied at the platform level.
 *
 * Policy is loaded by the worker before each agent run and enforced by the guardrail layer.
 * Org admins configure policy; platform admins may set floor values that cannot be overridden.
 *
 * Phase: 2 (Agent Capabilities). Placeholder shape defined in Phase 1.
 */

export const channelTypeSchema = z.enum(["sms", "web", "voice"]);
export type ChannelType = z.infer<typeof channelTypeSchema>;

export const rateLimitPolicySchema = z.object({
  /** Maximum inbound webhooks per organisation per minute */
  webhooksPerMinute: z.number().int().positive().default(60),

  /** Maximum outbound messages per organisation per minute */
  outboundPerMinute: z.number().int().positive().default(30),
});

export const contentPolicySchema = z.object({
  /**
   * Topics the agent must refuse to discuss.
   * Applied as input guardrail before LLM call.
   */
  blockedTopics: z.array(z.string()).default([]),

  /**
   * Whether the agent may discuss competitor products.
   */
  allowCompetitorMentions: z.boolean().default(false),

  /**
   * Required disclaimer appended to all outbound messages if set.
   */
  requiredDisclaimer: z.string().max(500).optional(),
});

export const tenantPolicyV1Schema = z.object({
  /** Schema version — must be "1" */
  specVersion: z.literal("1"),

  /** Organisation this policy applies to */
  organisationId: z.string().uuid(),

  /** Enabled channel types for this organisation */
  enabledChannels: z.array(channelTypeSchema).default(["web"]),

  /**
   * Rate limiting policy.
   * Platform-level minimums apply regardless of org configuration.
   */
  rateLimits: rateLimitPolicySchema.default({}),

  /** Content guardrail policy */
  contentPolicy: contentPolicySchema.default({}),

  /**
   * Maximum LLM tokens per conversation.
   * Prevents runaway cost for a single conversation.
   */
  maxTokensPerConversation: z.number().int().positive().default(50_000),

  /**
   * Whether human approval is required before high-sensitivity tool calls.
   * Phase 4 feature — ignored in earlier phases.
   */
  requireApprovalForHighSensitivityTools: z.boolean().default(false),

  /** ISO-8601 datetime of last policy update */
  updatedAt: z.string().datetime().optional(),
});

export type TenantPolicyV1 = z.infer<typeof tenantPolicyV1Schema>;
