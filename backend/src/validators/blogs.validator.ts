import { z } from 'zod';

export const createBlogSchema = z.object({
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
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must consist of lowercase letters, numbers, and hyphens (e.g. "my-first-post")'),
  excerpt: z
    .string()
    .trim()
    .min(1, 'Excerpt is required'),
  content: z
    .string()
    .trim()
    .min(1, 'Content is required'),
  featured_image_url: z
    .string()
    .trim()
    .optional()
    .nullable(),
  author_id: z
    .string()
    .uuid('Invalid author ID format')
    .optional()
    .nullable(),
  published: z
    .boolean()
    .optional()
    .default(false),
  published_at: z
    .string()
    .optional()
    .nullable(),
});

export const updateBlogSchema = createBlogSchema.partial();

export type CreateBlogInput = z.input<typeof createBlogSchema>;
export type UpdateBlogInput = z.input<typeof updateBlogSchema>;
