import { z } from "zod";

/**
 * ToolSpec v1 — machine-readable definition of a tool available to agents.
 *
 * Tools are registered in the tool gateway and authorised per-agent via AgentSpec.allowedToolIds.
 * Every tool call is logged as a `tool.exec` OTel span.
 *
 * Phase: 2 (Agent Capabilities). Placeholder shape defined in Phase 1.
 */

export const toolSensitivitySchema = z.enum([
  "low",    // read-only, no external side effects (e.g. KB lookup)
  "medium", // external read (e.g. CRM lookup)
  "high",   // write or financial side effect (e.g. send email, book calendar)
]);
export type ToolSensitivity = z.infer<typeof toolSensitivitySchema>;

export const toolParameterSchema = z.object({
  name: z.string(),
  type: z.enum(["string", "number", "boolean", "object", "array"]),
  description: z.string(),
  required: z.boolean().default(false),
});

export const toolSpecV1Schema = z.object({
  /** Schema version — must be "1" */
  specVersion: z.literal("1"),

  /** Unique stable ID — used in AgentSpec.allowedToolIds */
  id: z.string().regex(/^[a-z][a-z0-9_.-]*$/),

  /** Human-readable name */
  name: z.string().min(1).max(100),

  /** Description shown in LLM tool-calling context */
  description: z.string().min(1).max(500),

  /**
   * Sensitivity level — determines audit logging and approval requirements.
   * High-sensitivity tools may require human approval (Phase 4).
   */
  sensitivity: toolSensitivitySchema,

  /** Input parameters for this tool */
  parameters: z.array(toolParameterSchema).default([]),

  /**
   * Whether this tool can be retried on failure without side effects.
   * Non-idempotent tools (e.g. send email) must not be retried automatically.
   */
  idempotent: z.boolean().default(true),
});

export type ToolSpecV1 = z.infer<typeof toolSpecV1Schema>;
