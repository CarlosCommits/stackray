import { z } from "zod";

export const savedSearchSchema = z.object({
  id: z.string(),
  name: z.string(),
  pinned: z.boolean(),
  queryDescription: z.string(),
});

export type SavedSearch = z.infer<typeof savedSearchSchema>;
