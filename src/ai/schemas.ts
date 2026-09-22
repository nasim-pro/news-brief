import { z } from "zod";
export const selectionSchema = z.object({ selected: z.array(z.object({ articleId: z.string(), important: z.literal(true) })) });
export const storySchema = z.object({ headline: z.string().min(1).max(180), summary: z.string().min(1).max(1_500), whyItMatters: z.string().min(1).max(1_000) });
