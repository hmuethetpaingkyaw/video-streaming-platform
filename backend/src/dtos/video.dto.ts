import { z } from "zod";

export const createVideoSchema = z.object({
  title: z.string().trim().optional(),
});

export type CreateVideoRequestDto = z.infer<typeof createVideoSchema>;
