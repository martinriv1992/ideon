import createIntlMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { routing } from "@/i18n/routing";
import { updateSession } from "@/lib/supabase/middleware";

const intlMiddleware = createIntlMiddleware(routing);

/** Rutas (sin prefijo de idioma) que requieren sesión. */
const PROTECTED_PREFIXES = ["/dashboard", "/projects", "/billing", "/settings", "/support"];
/** Rutas de auth: si ya hay sesión, redirigir al dashboard. */
const AUTH_PREFIXES = ["/login", "/register", "/forgot-password"];

function stripLocale(pathname: string) {
  const match = pathname.match(/^\/(es|en)(?=\/|$)/);
  const locale = match ? match[1] : routing.defaultLocale;
  const rest = match ? pathname.slice(match[0].length) || "/" : pathname;
  return { locale, rest };
}

export default async function middleware(request: NextRequest) {
  const intlResponse = intlMiddleware(request);

  // Si next-intl redirige (p. ej. "/" → "/es"), devolvemos esa respuesta tal cual.
  if (intlResponse.headers.get("location")) return intlResponse;

  const { response, user } = await updateSession(request, intlResponse);
  const { locale, rest } = stripLocale(request.nextUrl.pathname);

  const isProtected = PROTECTED_PREFIXES.some(
    (p) => rest === p || rest.startsWith(`${p}/`),
  );
  const isAuthRoute = AUTH_PREFIXES.some(
    (p) => rest === p || rest.startsWith(`${p}/`),
  );

  if (isProtected && !user) {
    const url = request.nextUrl.clone();
    url.pathname = `/${locale}/login`;
    url.searchParams.set("next", rest);
    return NextResponse.redirect(url);
  }

  if (isAuthRoute && user) {
    const url = request.nextUrl.clone();
    url.pathname = `/${locale}/dashboard`;
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  // Todo excepto API, estáticos de Next y archivos con extensión.
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
