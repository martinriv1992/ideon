import { z } from "zod";

/** Datos del titular de un dominio (los exige el registrador). */
export const domainContactSchema = z.object({
  firstName: z.string().trim().min(1).max(60),
  lastName: z.string().trim().min(1).max(60),
  email: z.string().trim().email().max(120),
  phone: z.string().trim().regex(/^\+[1-9]\d{6,14}$/, "Teléfono en formato internacional, p. ej. +573001234567"),
  address1: z.string().trim().min(3).max(120),
  city: z.string().trim().min(1).max(60),
  state: z.string().trim().min(1).max(60),
  zip: z.string().trim().min(1).max(20),
  country: z.string().trim().length(2).transform((c) => c.toUpperCase()),
  companyName: z.string().trim().max(100).optional().transform((v) => v || undefined),
});
export type DomainContact = z.infer<typeof domainContactSchema>;
