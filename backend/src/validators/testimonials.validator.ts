import { z } from 'zod';

export const createTestimonialSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Name is required')
    .max(255, 'Name must not exceed 255 characters'),
  role: z
    .string()
    .trim()
    .min(1, 'Role is required')
    .max(255, 'Role must not exceed 255 characters'),
  company: z
    .string()
    .trim()
    .max(255, 'Company must not exceed 255 characters')
    .optional()
    .nullable(),
  content: z
    .string()
    .trim()
    .min(1, 'Content is required'),
  profile_image_url: z
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

export const updateTestimonialSchema = createTestimonialSchema.partial();

export type CreateTestimonialInput = z.input<typeof createTestimonialSchema>;
export type UpdateTestimonialInput = z.input<typeof updateTestimonialSchema>;
