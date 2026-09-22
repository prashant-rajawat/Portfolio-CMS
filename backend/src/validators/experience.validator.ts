import { z } from 'zod';

export const createExperienceSchema = z
  .object({
    company: z
      .string()
      .trim()
      .min(1, 'Company is required')
      .max(255, 'Company must not exceed 255 characters'),
    position: z
      .string()
      .trim()
      .min(1, 'Position is required')
      .max(255, 'Position must not exceed 255 characters'),
    description: z
      .string()
      .trim()
      .min(1, 'Description is required'),
    start_date: z
      .string()
      .trim()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Start date must be in YYYY-MM-DD format'),
    end_date: z
      .string()
      .trim()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'End date must be in YYYY-MM-DD format')
      .optional()
      .nullable(),
    is_current: z
      .boolean()
      .optional()
      .default(false),
    display_order: z
      .number()
      .int('Display order must be an integer')
      .optional()
      .default(0),
  })
  .refine(
    (data) => {
      if (!data.is_current && data.end_date && data.start_date) {
        return new Date(data.end_date) >= new Date(data.start_date);
      }
      return true;
    },
    {
      message: 'End date must be equal to or after start date',
      path: ['end_date'],
    }
  );

export const updateExperienceSchema = z
  .object({
    company: z
      .string()
      .trim()
      .min(1, 'Company cannot be empty')
      .max(255, 'Company must not exceed 255 characters')
      .optional(),
    position: z
      .string()
      .trim()
      .min(1, 'Position cannot be empty')
      .max(255, 'Position must not exceed 255 characters')
      .optional(),
    description: z
      .string()
      .trim()
      .min(1, 'Description cannot be empty')
      .optional(),
    start_date: z
      .string()
      .trim()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Start date must be in YYYY-MM-DD format')
      .optional(),
    end_date: z
      .string()
      .trim()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'End date must be in YYYY-MM-DD format')
      .optional()
      .nullable(),
    is_current: z
      .boolean()
      .optional(),
    display_order: z
      .number()
      .int('Display order must be an integer')
      .optional(),
  })
  .refine(
    (data) => {
      if (data.is_current === false && data.end_date && data.start_date) {
        return new Date(data.end_date) >= new Date(data.start_date);
      }
      return true;
    },
    {
      message: 'End date must be equal to or after start date',
      path: ['end_date'],
    }
  );

export type CreateExperienceInput = z.input<typeof createExperienceSchema>;
export type UpdateExperienceInput = z.input<typeof updateExperienceSchema>;
