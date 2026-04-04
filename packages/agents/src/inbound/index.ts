/**
 * Inbound Agent Runtime — handles inbound conversations for client businesses.
 *
 * Uses business context (the business's environment) to answer, qualify,
 * route, or escalate. Powered by the shared three-layer prompt architecture.
 *
 * Phase 2 initial slice: assembles the three-layer prompt, runs a simple
 * context-aware responder (no real LLM yet), returns a structured RuntimeOutput.
 */

import type {
  RuntimeInput,
  RuntimeContext,
  RuntimeDecision,
  RuntimeOutput,
} from "../shared/index.js";
import type { AssembledBusinessContext } from "@ice/schemas";

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
// Decision engine — Phase 2 stub (no real LLM call yet)
// ---------------------------------------------------------------------------

/**
 * Simple context-aware responder.
 *
 * Phase 2 initial slice: searches business context for relevant entries
 * and constructs a reply. Will be replaced by a real LLM call once the
 * runtime loop is validated end-to-end.
 */
function makeDecision(context: RuntimeContext, input: RuntimeInput): RuntimeDecision {
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
    // Check if any word from the user message appears in title or content
    const words = userMsg.split(/\s+/).filter((w) => w.length > 2);
    return words.some((w) => titleLower.includes(w) || contentLower.includes(w));
  });

  if (matchedEntries.length > 0) {
    // Use the first matched entry as the basis for the reply
    const best = matchedEntries[0]!;
    return {
      type: "reply",
      replyText: `Based on our ${best.category} information: ${best.content}`,
      escalationReason: null,
      confidence: "medium",
    };
  }

  // No exact match — provide a contextual fallback that summarizes what we know
  // Summarize by category to give a helpful overview
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
      replyText: `We offer ${serviceList}. For more information, please visit our website or contact us. Is there something specific I can help with?`,
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

/**
 * Run the inbound agent engine for a single message turn.
 *
 * Assembles the three-layer prompt, makes a decision, formats the reply,
 * and returns a structured RuntimeOutput.
 */
export async function runInbound(input: RuntimeInput): Promise<RuntimeOutput> {
  const start = Date.now();

  try {
    // Step 1: Assemble three-layer context
    const runtimeContext = assembleContext(input);

    // Step 2: Make a decision (stub responder — no LLM yet)
    const decision = makeDecision(runtimeContext, input);

    // Step 3: Format reply for channel
    const formattedReply = formatReply(
      decision.replyText,
      input.message.channelType
    );

    return {
      success: true,
      decision,
      formattedReply,
      durationMs: Date.now() - start,
      error: null,
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
