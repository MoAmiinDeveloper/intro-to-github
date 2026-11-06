import { z } from "zod";

export const passwordSchema = z
  .string()
  .min(10, "Use at least 10 characters.")
  .max(200, "That password is too long.")
  .refine((p) => /[A-Za-z]/.test(p) && /[0-9]/.test(p), "Use both letters and numbers.");

export const emailSchema = z.string().trim().toLowerCase().email("Enter a valid email address.");

export const optionalEmail = z
  .string()
  .trim()
  .toLowerCase()
  .email("Enter a valid email address.")
  .nullable()
  .or(z.literal("").transform(() => null));
