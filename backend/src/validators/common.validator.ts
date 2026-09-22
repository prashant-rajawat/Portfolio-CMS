import { z } from 'zod';

/**
 * Reusable schema for validating UUID format in path parameters (e.g. /:id).
 * Accepts any standard 36-character hexadecimal UUID (v1-v5, nil, etc.).
 * Rejects non-UUID strings before reaching database queries.
 */
export const uuidParamSchema = z.object({
  id: z
    .string()
    .trim()
    .regex(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      'Invalid ID format. Must be a valid UUID.'
    ),
});

export type UuidParam = z.infer<typeof uuidParamSchema>;
