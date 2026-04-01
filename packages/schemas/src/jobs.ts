import { z } from "zod";

// Base job payload — all jobs must include organizationId for tenant isolation
export const baseJobSchema = z.object({
  organizationId: z.string().uuid(),
  jobId: z.string().uuid(),
  createdAt: z.string().datetime(),
});

export type BaseJob = z.infer<typeof baseJobSchema>;

// Placeholder: conversation processing job
export const conversationJobSchema = baseJobSchema.extend({
  type: z.literal("conversation.process"),
  conversationId: z.string().uuid(),
});

export type ConversationJob = z.infer<typeof conversationJobSchema>;
