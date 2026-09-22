import { z } from 'zod';

export const createSkillSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Name is required')
    .max(100, 'Name must not exceed 100 characters'),
  category: z
    .string()
    .trim()
    .min(1, 'Category is required')
    .max(100, 'Category must not exceed 100 characters'),
  proficiency: z
    .number()
    .int('Proficiency must be an integer')
    .min(0, 'Proficiency must be at least 0')
    .max(100, 'Proficiency must not exceed 100')
    .optional()
    .nullable(),
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

export const updateSkillSchema = createSkillSchema.partial();

export type CreateSkillInput = z.input<typeof createSkillSchema>;
export type UpdateSkillInput = z.input<typeof updateSkillSchema>;
