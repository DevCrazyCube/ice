/**
 * Inbound Agent Runtime — handles inbound conversations for client businesses.
 *
 * Uses business context (the business's environment) to answer, qualify,
 * route, or escalate. Powered by the shared three-layer prompt architecture.
 *
 * Decision engine modes (selected via RunInboundOptions):
 *
 *   STUB (default, no API key required):
 *     Deterministic keyword-based responder. Works offline. Always returns a
 *     meaningful, context-aware reply based on the business context entries.
 *     This is the normal operating mode for local development and testing.
 *
 *   LLM (opt-in, requires ANTHROPIC_API_KEY):
 *     Routes the assembled three-layer prompt through Claude. Output is
 *     validated against a strict Zod schema before use. On any LLM failure
 *     (timeout, API error, invalid output), the stub runs instead so the
 *     engine always produces a usable response.
 *
 * The three-layer prompt architecture (systemPrompt / developerPrompt /
 * channelRules) and all runtime contracts are unchanged by mode selection.
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
// Stub decision engine — default mode, no external dependencies
// ---------------------------------------------------------------------------

/**
 * Deterministic, keyword-based responder.
 *
 * This is the default decision engine. It requires no API key, no network,
 * and no external services. It searches the assembled business context for
 * relevant entries and constructs a context-aware reply.
 *
 * Also serves as the safety net when the LLM path is enabled but fails.
 */
function stubDecision(context: RuntimeContext, input: RuntimeInput): RuntimeDecision {
  const userMsg = context.userMessage.toLowerCase().trim();

  // Escalation check — user explicitly requests a human
  if (
    userMsg.includes("human") ||
    userMsg.includes("agent") ||
    userMsg.includes("person") ||
    userMsg.includes("speak to someone")
  ) {
    return {
      type: "escalate",
      replyText: "I'll connect you with a human now. One moment please.",
      escalationReason: "User requested human agent",
      confidence: "high",
    };
  }

  // Search business context entries for keyword matches
  const entries = input.businessContext.entries;
  const matchedEntries = entries.filter((entry) => {
    const titleLower = entry.title.toLowerCase();
    const contentLower = entry.content.toLowerCase();
    const words = userMsg.split(/\s+/).filter((w) => w.length > 2);
    return words.some((w) => titleLower.includes(w) || contentLower.includes(w));
  });

  if (matchedEntries.length > 0) {
    const best = matchedEntries[0]!;
    return {
      type: "reply",
      replyText: `Based on our ${best.category} information: ${best.content}`,
      escalationReason: null,
      confidence: "medium",
    };
  }

  // No match — summarize what the business offers
  const profileEntry = entries.find((e) => e.category === "profile");
  const serviceEntries = entries.filter((e) => e.category === "services");
  const businessName = profileEntry?.content.split(".")[0] ?? "our business";

  if (serviceEntries.length > 0) {
    const serviceList = serviceEntries
      .slice(0, 2)
      .map((e) => e.title)
      .join(", ");
    return {
      type: "reply",
      replyText: `We offer ${serviceList}. For more information, please contact us directly. Is there something specific I can help with?`,
      escalationReason: null,
      confidence: "low",
    };
  }

  return {
    type: "reply",
    replyText: `Thank you for contacting ${businessName}. I don't have specific information about that topic yet. Would you like me to connect you with someone who can help?`,
    escalationReason: null,
    confidence: "low",
  };
}

// ---------------------------------------------------------------------------
// Decision routing — stub by default, LLM when configured
// ---------------------------------------------------------------------------

/**
 * Route the decision to the appropriate engine.
 *
 * - No llmConfig → stub (deterministic, always succeeds)
 * - llmConfig present → attempt LLM; on null return → stub
 *
 * Returns the decision and which engine produced it.
 */
async function makeDecision(
  runtimeContext: RuntimeContext,
  input: RuntimeInput,
  llmConfig: LlmConfig | null
): Promise<{ decision: RuntimeDecision; engine: "stub" | "llm" | "llm-stub-fallback" }> {
  if (!llmConfig) {
    return { decision: stubDecision(runtimeContext, input), engine: "stub" };
  }

  const llmDecision = await callLlm(runtimeContext, llmConfig);

  if (llmDecision !== null) {
    return { decision: llmDecision, engine: "llm" };
  }

  // LLM returned null (timeout, API error, validation failure) — use stub
  return { decision: stubDecision(runtimeContext, input), engine: "llm-stub-fallback" };
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
  /**
   * Hosted LLM configuration. Optional.
   *
   * When provided with a valid apiKey, the engine routes decisions through
   * Claude. When omitted (or apiKey is empty), the deterministic stub runs.
   *
   * The stub is the correct default for local development and test
   * environments where no API key is present.
   */
  llmConfig?: LlmConfig;
}

/**
 * Run the inbound agent engine for a single message turn.
 *
 * Default mode (no options): deterministic stub, no external dependencies.
 * LLM mode (options.llmConfig set): hosted Claude call with stub fallback.
 *
 * success is true in both modes. It is only false if an uncaught exception
 * prevents any decision from being produced.
 */
export async function runInbound(
  input: RuntimeInput,
  options?: RunInboundOptions
): Promise<RuntimeOutput> {
  const start = Date.now();

  const contextEntryCount = input.businessContext.entries.length;

  try {
    // Step 1: Assemble three-layer context
    const runtimeContext = assembleContext(input);

    // Step 2: Route to stub (default) or LLM (opt-in)
    const llmConfig =
      options?.llmConfig?.apiKey ? options.llmConfig : null;

    const { decision, engine } = await makeDecision(runtimeContext, input, llmConfig);

    // Step 3: Format reply for channel
    const formattedReply = formatReply(
      decision.replyText,
      input.message.channelType
    );
    const channelFormatted = formattedReply !== decision.replyText;

    return {
      success: true,
      decision,
      formattedReply,
      durationMs: Date.now() - start,
      // error is reserved for actual failures — engine routing is in the engine field
      error: engine === "llm-stub-fallback" ? "LLM call failed, stub used" : null,
      engine,
      contextEntryCount,
      channelFormatted,
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
      engine: "stub",
      contextEntryCount,
      channelFormatted: false,
    };
  }
}
