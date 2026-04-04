/**
 * Inbound Agent Runtime — handles inbound conversations for client businesses.
 *
 * Uses business context (the business's environment) to answer, qualify,
 * route, or escalate. Powered by the shared three-layer prompt architecture.
 *
 * Phase 2: assembles the three-layer prompt, calls Claude for a structured
 * decision, validates output with Zod, falls back safely on any failure.
 */

import type {
  RuntimeInput,
  RuntimeContext,
  RuntimeDecision,
  RuntimeOutput,
} from "../shared/index.js";
import type { AssembledBusinessContext } from "@ice/schemas";
import { callLlm } from "./llm.js";
import type { LlmConfig } from "./llm.js";

// ---------------------------------------------------------------------------
// Prompt assembly — three-layer architecture
// ---------------------------------------------------------------------------

const CORE_SYSTEM_PROMPT = `You are an environment-aware inbound agent for ICE.

Rules:
- Answer questions using ONLY the business context provided below.
- If you don't know the answer, say so honestly and offer to escalate.
- Never make up information not present in the business context.
- Be helpful, concise, and professional.
- Follow the tone guidelines from the business context.
- If the user explicitly requests a human, escalate immediately.`;

function buildDeveloperPrompt(context: AssembledBusinessContext): string {
  if (context.entries.length === 0) {
    return "No business context has been configured for this agent yet.";
  }

  const sections: string[] = [];

  // Group entries by category, maintaining sort_order within each
  const byCategory = new Map<string, typeof context.entries>();
  for (const entry of context.entries) {
    const existing = byCategory.get(entry.category) ?? [];
    existing.push(entry);
    byCategory.set(entry.category, existing);
  }

  // Emit categories in a stable order
  const categoryOrder = ["profile", "services", "faq", "tone", "knowledge"];
  for (const cat of categoryOrder) {
    const entries = byCategory.get(cat);
    if (!entries || entries.length === 0) continue;

    // Sort by sortOrder within category
    entries.sort((a, b) => a.sortOrder - b.sortOrder);

    sections.push(`## ${cat.charAt(0).toUpperCase() + cat.slice(1)}`);
    for (const entry of entries) {
      sections.push(`### ${entry.title}`);
      sections.push(entry.content);
      sections.push("");
    }
  }

  return sections.join("\n");
}

function buildChannelRules(channelType: string): string {
  switch (channelType) {
    case "sms":
      return "Channel: SMS. Keep replies under 160 characters when possible. No markdown formatting.";
    case "web":
      return "Channel: Web chat. Markdown formatting is allowed. Keep replies concise but complete.";
    case "voice":
      return "Channel: Voice. Use short, spoken-language sentences. No formatting.";
    default:
      return "Channel: Unknown. Keep replies concise.";
  }
}

function assembleContext(input: RuntimeInput): RuntimeContext {
  return {
    systemPrompt: CORE_SYSTEM_PROMPT,
    developerPrompt: buildDeveloperPrompt(input.businessContext),
    channelRules: buildChannelRules(input.message.channelType),
    userMessage: input.message.body,
  };
}

// ---------------------------------------------------------------------------
// Decision engine — real LLM call with structured output validation
// ---------------------------------------------------------------------------

/**
 * Call Claude to make a decision based on the three-layer prompt context.
 *
 * Falls back to a safe no_response decision on any failure (timeout, API
 * error, malformed output, validation failure).
 */
async function makeDecision(
  runtimeContext: RuntimeContext,
  llmConfig: LlmConfig | null
): Promise<{ decision: RuntimeDecision; fallback: boolean }> {
  // No API key configured — return safe fallback
  if (!llmConfig || !llmConfig.apiKey) {
    return {
      decision: {
        type: "no_response",
        replyText: "I'm sorry, I'm unable to process your request right now. Please try again shortly.",
        escalationReason: null,
        confidence: "low",
      },
      fallback: true,
    };
  }

  return callLlm(runtimeContext, llmConfig);
}

/**
 * Apply channel-specific formatting to the reply text.
 */
function formatReply(
  replyText: string | null,
  channelType: string
): string | null {
  if (!replyText) return null;

  if (channelType === "sms" && replyText.length > 320) {
    // Truncate for SMS with ellipsis indicator
    return replyText.slice(0, 317) + "...";
  }

  return replyText;
}

// ---------------------------------------------------------------------------
// Public API — the entry point called by the worker
// ---------------------------------------------------------------------------

/** Options for the inbound engine */
export interface RunInboundOptions {
  /** LLM configuration. If omitted or apiKey is empty, returns a safe fallback. */
  llmConfig?: LlmConfig;
}

/**
 * Run the inbound agent engine for a single message turn.
 *
 * Assembles the three-layer prompt, calls Claude for a structured decision,
 * validates the output, formats the reply, and returns a RuntimeOutput.
 */
export async function runInbound(
  input: RuntimeInput,
  options?: RunInboundOptions
): Promise<RuntimeOutput> {
  const start = Date.now();

  try {
    // Step 1: Assemble three-layer context
    const runtimeContext = assembleContext(input);

    // Step 2: Make a decision via LLM (falls back safely on any failure)
    const { decision, fallback } = await makeDecision(
      runtimeContext,
      options?.llmConfig ?? null
    );

    // Step 3: Format reply for channel
    const formattedReply = formatReply(
      decision.replyText,
      input.message.channelType
    );

    return {
      success: !fallback,
      decision,
      formattedReply,
      durationMs: Date.now() - start,
      error: fallback ? "LLM call failed — returned fallback response" : null,
    };
  } catch (err) {
    return {
      success: false,
      decision: {
        type: "no_response",
        replyText: null,
        escalationReason: null,
        confidence: "low",
      },
      formattedReply: null,
      durationMs: Date.now() - start,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
