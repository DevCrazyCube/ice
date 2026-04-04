import { z } from "zod";

/**
 * BusinessContext v1 — structured business environment data that drives
 * environment-aware agent behaviour.
 *
 * Entered manually by org admins in Phase 2. Future phases add ingestion
 * from websites, documents, and social profiles (with human review).
 *
 * This data forms the DEVELOPER layer of the three-layer prompt architecture:
 *   Layer 1 (SYSTEM): core behaviour — shared, not business-configurable
 *   Layer 2 (DEVELOPER): business context — per-tenant, from this schema
 *   Layer 3 (CHANNEL): formatting, length limits — per-channel
 */

export const businessContextCategorySchema = z.enum([
  "profile",
  "services",
  "faq",
  "tone",
  "knowledge",
]);
export type BusinessContextCategory = z.infer<
  typeof businessContextCategorySchema
>;

export const businessContextSourceSchema = z.enum([
  "manual",
  "website",
  "document",
  "social",
]);
export type BusinessContextSource = z.infer<
  typeof businessContextSourceSchema
>;

/**
 * A single business context entry — one piece of the business's environment.
 * Multiple entries per agent, categorised and ordered.
 */
export const businessContextEntrySchema = z.object({
  id: z.string().uuid(),
  organisationId: z.string().uuid(),
  agentId: z.string().uuid(),

  /** Category of this context entry */
  category: businessContextCategorySchema,

  /** Human-readable title (e.g. "Business Hours", "Return Policy") */
  title: z.string().min(1).max(200),

  /** Structured text content — validated and sanitised at write time */
  content: z.string().min(1).max(10000),

  /** Display/assembly order within the category */
  sortOrder: z.number().int().min(0).default(0),

  /** Whether this entry is included in the live prompt */
  active: z.boolean().default(true),

  /**
   * Provenance of this entry.
   * Phase 2: always "manual".
   * Phase 3+: "website", "document", "social" (requires reviewedAt).
   */
  source: businessContextSourceSchema.default("manual"),

  /**
   * When this entry was reviewed by a human.
   * NULL for manual entries (implicitly reviewed by the person entering them).
   * Required non-NULL for ingested content before it becomes active (Phase 3+).
   */
  reviewedAt: z.string().datetime().nullable().optional(),

  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type BusinessContextEntry = z.infer<typeof businessContextEntrySchema>;

/**
 * Schema for creating a new business context entry (POST).
 * Server generates id, timestamps, and defaults.
 */
export const createBusinessContextSchema = z.object({
  agentId: z.string().uuid(),
  category: businessContextCategorySchema,
  title: z.string().min(1).max(200),
  content: z.string().min(1).max(10000),
  sortOrder: z.number().int().min(0).default(0),
  active: z.boolean().default(true),
});

export type CreateBusinessContext = z.infer<typeof createBusinessContextSchema>;

/**
 * Schema for updating an existing business context entry (PATCH).
 * All fields optional — only provided fields are updated.
 */
export const updateBusinessContextSchema = z.object({
  category: businessContextCategorySchema.optional(),
  title: z.string().min(1).max(200).optional(),
  content: z.string().min(1).max(10000).optional(),
  sortOrder: z.number().int().min(0).optional(),
  active: z.boolean().optional(),
});

export type UpdateBusinessContext = z.infer<typeof updateBusinessContextSchema>;

/**
 * Assembled business context for runtime prompt injection.
 * This is the aggregated view loaded by the worker before building the
 * DEVELOPER layer prompt. Contains all active entries for an agent,
 * grouped by category.
 */
export const assembledBusinessContextSchema = z.object({
  organisationId: z.string().uuid(),
  agentId: z.string().uuid(),
  entries: z.array(businessContextEntrySchema),
  assembledAt: z.string().datetime(),
});

export type AssembledBusinessContext = z.infer<
  typeof assembledBusinessContextSchema
>;
