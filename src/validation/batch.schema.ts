import { z } from 'zod';

export const createBatchSchema = z.object({
  documents: z
    .array(
      z.object({
        title: z.string().min(1).max(500),
        content: z.string().min(1).max(200_000),
      }),
    )
    .min(1)
    .max(50),
});

export type CreateBatchBody = z.infer<typeof createBatchSchema>;
