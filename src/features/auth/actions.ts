"use server";

import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { checkAndRecordSignup, isDisposableEmail } from "./abuse";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured, publicEnv } from "@/lib/env";
import {
  forgotSchema,
  loginSchema,
  registerSchema,
  resetSchema,
  safeNext,
} from "./schemas";

/** Estado devuelto a los formularios (useActionState). */
export interface AuthState {
  error?: string; // clave de traducción en auth.errors.* o texto literal
  fieldErrors?: Record<string, string>;
  success?: "checkEmail" | "resetSent";
  email?: string;
}

function mapSupabaseError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials")) return "invalidCredentials";
  if (m.includes("already registered") || m.includes("already exists")) return "emailTaken";
  if (m.includes("rate limit") || m.includes("too many")) return "rateLimited";
  return "generic";
}

function fieldErrorsFrom(error: { issues: { path: PropertyKey[]; message: string }[] }) {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

export async function loginAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  if (!isSupabaseConfigured) return { error: "notConfigured" };
  const parsed = loginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: fieldErrorsFrom(parsed.error) };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });
  if (error) return { error: mapSupabaseError(error.message) };

  const locale = await getLocale();
  redirect({ href: safeNext(parsed.data.next), locale });
  return {};
}

export async function registerAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  if (!isSupabaseConfigured) return { error: "notConfigured" };
  const parsed = registerSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: fieldErrorsFrom(parsed.error) };

  const { fullName, email, password, locale, next } = parsed.data;
  if (await isDisposableEmail(email)) return { fieldErrors: { email: "disposableEmail" } };
  if ((await checkAndRecordSignup()) === "too_many") return { error: "tooManySignups" };
  const supabase = await createClient();
  const nextPath = safeNext(next, "/projects/new");
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName, locale },
      emailRedirectTo: `${publicEnv.NEXT_PUBLIC_APP_URL}/api/auth/callback?next=${encodeURIComponent(`/${locale}${nextPath}`)}`,
    },
  });
  if (error) return { error: mapSupabaseError(error.message) };

  // Si la confirmación por correo está desactivada en Supabase, ya hay sesión.
  if (data.session) {
    redirect({ href: nextPath, locale });
  }
  return { success: "checkEmail", email };
}

export async function forgotPasswordAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  if (!isSupabaseConfigured) return { error: "notConfigured" };
  const parsed = forgotSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: fieldErrorsFrom(parsed.error) };

  const locale = await getLocale();
  const supabase = await createClient();
  // No revelamos si el correo existe: la respuesta es la misma en ambos casos.
  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${publicEnv.NEXT_PUBLIC_APP_URL}/api/auth/callback?next=${encodeURIComponent(`/${locale}/reset-password`)}`,
  });
  return { success: "resetSent" };
}

export async function resetPasswordAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  if (!isSupabaseConfigured) return { error: "notConfigured" };
  const parsed = resetSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: fieldErrorsFrom(parsed.error) };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { error: mapSupabaseError(error.message) };

  const locale = await getLocale();
  redirect({ href: "/dashboard", locale });
  return {};
}

export async function logoutAction() {
  if (isSupabaseConfigured) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }
  const locale = await getLocale();
  redirect({ href: "/", locale });
}
