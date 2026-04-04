/**
 * Hosted LLM caller for the inbound agent runtime.
 *
 * This module is opt-in. The runtime uses the deterministic stub by default.
 * Provide an LlmConfig with a valid apiKey to route decisions through Claude.
 *
 * Sends the assembled three-layer prompt, parses the structured JSON response
 * with Zod, and returns a validated RuntimeDecision — or null on any failure
 * (timeout, API error, malformed output, validation failure).
 *
 * Returning null tells the caller to fall back to the stub. The LLM layer
 * has no opinion about what happens when it cannot respond.
 */

import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import type { RuntimeContext, RuntimeDecision } from "../shared/index.js";

// ---------------------------------------------------------------------------
// Structured output schema — what the model must return as JSON
// ---------------------------------------------------------------------------

export const llmResponseSchema = z.object({
  decision: z.enum(["reply", "escalate", "no_response"]),
  replyText: z.string().nullable(),
  escalationReason: z.string().nullable(),
  confidence: z.enum(["high", "medium", "low"]),
});

export type LlmResponse = z.infer<typeof llmResponseSchema>;

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export interface LlmConfig {
  /** Anthropic API key. Required to enable hosted LLM path. */
  apiKey: string;
  /** Model ID — defaults to claude-sonnet-4-20250514 */
  model?: string;
  /** Request timeout in ms — defaults to 30_000 */
  timeoutMs?: number;
  /** Max tokens for the response — defaults to 1024 */
  maxTokens?: number;
}

const DEFAULT_MODEL = "claude-sonnet-4-20250514";
const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_TOKENS = 1024;

// ---------------------------------------------------------------------------
// Singleton client (reused across calls within a process)
// ---------------------------------------------------------------------------

let cachedClient: Anthropic | null = null;
let cachedApiKey: string | null = null;

function getClient(apiKey: string): Anthropic {
  if (cachedClient && cachedApiKey === apiKey) return cachedClient;
  cachedClient = new Anthropic({ apiKey });
  cachedApiKey = apiKey;
  return cachedClient;
}

// ---------------------------------------------------------------------------
// Structured JSON instruction appended to the system prompt
// ---------------------------------------------------------------------------

const JSON_INSTRUCTION = `

IMPORTANT: You must respond with ONLY a JSON object matching this exact schema:
{
  "decision": "reply" | "escalate" | "no_response",
  "replyText": "<your reply text or null>",
  "escalationReason": "<reason if escalating, otherwise null>",
  "confidence": "high" | "medium" | "low"
}

Rules for the JSON response:
- "reply": provide replyText with your answer, escalationReason must be null
- "escalate": provide replyText with a brief message to the user AND escalationReason explaining why
- "no_response": set replyText and escalationReason to null (use only when you truly cannot respond)
- Do NOT wrap the JSON in markdown code fences or add any text outside the JSON object`;

// ---------------------------------------------------------------------------
// Core LLM call
// ---------------------------------------------------------------------------

/**
 * Call Claude with the three-layer prompt and return a validated RuntimeDecision.
 *
 * Returns null on any failure: timeout, API error, malformed output, or Zod
 * validation failure. The caller is responsible for deciding what to do with null
 * (typically: run the stub instead).
 */
export async function callLlm(
  runtimeContext: RuntimeContext,
  config: LlmConfig
): Promise<RuntimeDecision | null> {
  const model = config.model ?? DEFAULT_MODEL;
  const timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxTokens = config.maxTokens ?? DEFAULT_MAX_TOKENS;

  const client = getClient(config.apiKey);

  // Build the system prompt: Layer 1 (core) + JSON instruction
  const systemPrompt = runtimeContext.systemPrompt + JSON_INSTRUCTION;

  // Build messages: Layer 2 (business context) + Layer 3 (channel rules) + user message
  const developerBlock = `<business_context>\n${runtimeContext.developerPrompt}\n</business_context>`;
  const channelBlock = `<channel_rules>\n${runtimeContext.channelRules}\n</channel_rules>`;

  try {
    const response = await Promise.race([
      client.messages.create({
        model,
        max_tokens: maxTokens,
        system: systemPrompt,
        messages: [
          {
            role: "user",
            content: `${developerBlock}\n\n${channelBlock}\n\nCustomer message: ${runtimeContext.userMessage}`,
          },
        ],
      }),
      timeoutPromise(timeoutMs),
    ]);

    // Extract text content from the response
    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return null;
    }

    // Parse and validate the JSON response
    return parseAndValidate(textBlock.text);
  } catch {
    // Timeout, network error, API error — return null, caller uses stub
    return null;
  }
}

// ---------------------------------------------------------------------------
// JSON parsing + Zod validation
// ---------------------------------------------------------------------------

function parseAndValidate(raw: string): RuntimeDecision | null {
  // Strip markdown code fences if the model wrapped its response
  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    return null;
  }

  const result = llmResponseSchema.safeParse(parsed);
  if (!result.success) {
    return null;
  }

  const data = result.data;

  // Map validated LLM response to RuntimeDecision
  return {
    type: data.decision,
    replyText: data.replyText,
    escalationReason: data.escalationReason,
    confidence: data.confidence,
  };
}

// ---------------------------------------------------------------------------
// Timeout helper
// ---------------------------------------------------------------------------

function timeoutPromise(ms: number): Promise<never> {
  return new Promise((_, reject) =>
    setTimeout(() => reject(new Error(`LLM call timed out after ${ms}ms`)), ms)
  );
}
