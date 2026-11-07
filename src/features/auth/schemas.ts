import { z } from "zod";

export const emailSchema = z.string().trim().email("invalidEmail").max(254);
export const passwordSchema = z.string().min(8, "shortPassword").max(128);

export const loginSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  next: z.string().optional(),
});

export const registerSchema = z.object({
  fullName: z.string().trim().min(2, "shortName").max(120),
  email: emailSchema,
  password: passwordSchema,
  locale: z.enum(["es", "en"]).default("es"),
  next: z.string().optional(),
});

export const forgotSchema = z.object({ email: emailSchema });
export const resetSchema = z.object({ password: passwordSchema });

/** Solo permitimos redirecciones internas (evita open redirect). */
export function safeNext(next: string | undefined, fallback = "/dashboard") {
  if (!next) return fallback;
  if (!next.startsWith("/") || next.startsWith("//")) return fallback;
  return next;
}
