import { z } from 'zod';

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

const email = z
  .string()
  .trim()
  .email()
  .max(320)
  .transform((value) => normalizeEmail(value));

export const loginInputSchema = z.object({
  email,
  password: z.string().min(1).max(128),
});

export const registrationInputSchema = z.object({
  displayName: z.string().trim().min(2).max(80),
  email,
  password: z.string().min(12).max(128),
});

export type LoginInput = z.infer<typeof loginInputSchema>;
export type RegistrationInput = z.infer<typeof registrationInputSchema>;
