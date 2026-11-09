import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";

/**
 * Callback de Supabase Auth (confirmación de correo, recuperación de contraseña,
 * OAuth). Intercambia el `code` por una sesión y redirige a `next` (solo rutas internas).
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const nextParam = searchParams.get("next") ?? "/es/dashboard";
  const next = nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/es/dashboard";

  if (!isSupabaseConfigured) {
    return NextResponse.redirect(`${origin}/es/login?error=not_configured`);
  }

  const locale = /^\/en(\/|$)/.test(next) ? "en" : "es";
  // OAuth cancelado o rechazado por el proveedor (p. ej. la persona cerró la ventana de Google).
  if (!code && searchParams.get("error")) {
    return NextResponse.redirect(`${origin}/${locale}/login?error=oauth&next=${encodeURIComponent(next.replace(/^\/(es|en)/, ""))}`);
  }

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  }

  return NextResponse.redirect(`${origin}/${locale}/login?error=auth_callback`);
}
