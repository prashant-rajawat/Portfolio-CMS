import { z } from 'zod';

export const createContactSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Name is required and cannot be empty.')
    .max(255, 'Name must not exceed 255 characters.'),

  email: z
    .string()
    .trim()
    .email('Please provide a valid email address.')
    .max(255, 'Email must not exceed 255 characters.'),

  subject: z
    .string()
    .trim()
    .min(1, 'Subject is required and cannot be empty.')
    .max(255, 'Subject must not exceed 255 characters.'),

  message: z
    .string()
    .trim()
    .min(1, 'Message is required and cannot be empty.')
    .max(5000, 'Message must not exceed 5,000 characters.'),
});

export const updateReadStatusSchema = z.object({
  is_read: z.boolean().optional(),
});

export type CreateContactDTO = z.infer<typeof createContactSchema>;
export type UpdateReadStatusDTO = z.infer<typeof updateReadStatusSchema>;
