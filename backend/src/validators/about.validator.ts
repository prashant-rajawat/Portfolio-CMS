import { z } from 'zod';

export const updateAboutSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'Title is required')
    .max(255, 'Title must not exceed 255 characters'),
  short_description: z
    .string()
    .trim()
    .min(1, 'Short description is required'),
  full_description: z
    .string()
    .trim()
    .min(1, 'Full description is required'),
  profile_image_url: z
    .string()
    .trim()
    .optional()
    .nullable(),
  resume_url: z
    .string()
    .trim()
    .optional()
    .nullable(),
});

export type UpdateAboutInput = z.infer<typeof updateAboutSchema>;
