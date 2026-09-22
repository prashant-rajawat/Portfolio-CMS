import { z } from 'zod';

export const createProjectSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'Title is required')
    .max(255, 'Title must not exceed 255 characters'),
  slug: z
    .string()
    .trim()
    .min(1, 'Slug is required')
    .max(255, 'Slug must not exceed 255 characters')
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must consist of lowercase letters, numbers, and hyphens (e.g. "my-project-1")'),
  short_description: z
    .string()
    .trim()
    .min(1, 'Short description is required'),
  full_description: z
    .string()
    .trim()
    .min(1, 'Full description is required'),
  image_url: z
    .string()
    .trim()
    .optional()
    .nullable(),
  technologies: z
    .array(z.string().trim().min(1, 'Technology item cannot be empty'))
    .optional()
    .default([]),
  live_url: z
    .string()
    .trim()
    .optional()
    .nullable(),
  github_url: z
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

export const updateProjectSchema = createProjectSchema.partial();

export type CreateProjectInput = z.input<typeof createProjectSchema>;
export type UpdateProjectInput = z.input<typeof updateProjectSchema>;
