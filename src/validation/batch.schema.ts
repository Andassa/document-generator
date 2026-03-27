import { z } from 'zod';
import { config } from '../config';

export const createBatchSchema = z.object({
  documents: z
    .array(
      z.object({
        title: z.string().min(1).max(500),
        content: z.string().min(1).max(200_000),
      }),
    )
    .min(1)
    .max(config.BATCH_MAX_DOCUMENTS),
});


export const createBatchUserIdsSchema = z.object({
  userIds: z
    .array(z.string().min(1).max(256))
    .min(1)
    .max(config.BATCH_MAX_DOCUMENTS),
});

export type CreateBatchBody = z.infer<typeof createBatchSchema>;
export type CreateBatchUserIdsBody = z.infer<typeof createBatchUserIdsSchema>;
