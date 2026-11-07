import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";

/**
 * Enlaces de los correos de Auth (confirmar cuenta, recuperar contraseña, cambio
 * de correo, invitación, enlace mágico). Verifica el token_hash en el servidor,
 * así que funciona aunque el correo se abra en otro dispositivo o navegador
 * (el flujo PKCE de /api/auth/callback exige el mismo navegador).
 *
 * Plantilla: {{ .SiteURL }}/api/auth/confirm?token_hash={{ .TokenHash }}&type=<tipo>&redirect_to={{ .RedirectTo }}
 */
const TYPES: EmailOtpType[] = ["signup", "recovery", "email_change", "invite", "magiclink", "email"];

/** Ruta interna de destino: `next` dentro de redirect_to (mismo origen) o una por defecto según el tipo. */
function destination(origin: string, type: EmailOtpType, redirectTo: string | null) {
  const fallback = type === "recovery" ? "/es/reset-password" : "/es/dashboard";
  if (!redirectTo) return fallback;
  try {
    const url = new URL(redirectTo, origin);
    const next = url.searchParams.get("next");
    if (next && next.startsWith("/") && !next.startsWith("//")) return next;
    if (url.origin === origin && url.pathname.startsWith("/") && !url.pathname.startsWith("/api/")) return url.pathname;
  } catch { /* redirect_to inválido: destino por defecto */ }
  return fallback;
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  if (!isSupabaseConfigured) return NextResponse.redirect(`${origin}/es/login?error=not_configured`);
  if (tokenHash && type && TYPES.includes(type)) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) return NextResponse.redirect(`${origin}${destination(origin, type, searchParams.get("redirect_to"))}`);
  }
  return NextResponse.redirect(`${origin}/es/login?error=auth_link`);
}
