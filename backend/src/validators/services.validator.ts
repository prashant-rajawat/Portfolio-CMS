import { z } from 'zod';

export const createServiceSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'Title is required')
    .max(255, 'Title must not exceed 255 characters'),
  description: z
    .string()
    .trim()
    .min(1, 'Description is required'),
  icon_url: z
    .string()
    .trim()
    .optional()
    .nullable(),
  display_order: z
    .number()
    .int('Display order must be an integer')
    .optional()
    .default(0),
});

export const updateServiceSchema = createServiceSchema.partial();

export type CreateServiceInput = z.input<typeof createServiceSchema>;
export type UpdateServiceInput = z.input<typeof updateServiceSchema>;
