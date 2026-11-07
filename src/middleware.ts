import createIntlMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { routing } from "@/i18n/routing";
import { updateSession } from "@/lib/supabase/middleware";

const intlMiddleware = createIntlMiddleware(routing);

/** Rutas (sin prefijo de idioma) que requieren sesión. */
const PROTECTED_PREFIXES = ["/dashboard", "/projects", "/billing", "/settings", "/support", "/proposals", "/files", "/subscriptions", "/admin"];
/** Rutas de auth: si ya hay sesión, redirigir al dashboard. */
const AUTH_PREFIXES = ["/login", "/register", "/forgot-password"];

function stripLocale(pathname: string) {
  const match = pathname.match(/^\/(es|en)(?=\/|$)/);
  const locale = match ? match[1] : routing.defaultLocale;
  const rest = match ? pathname.slice(match[0].length) || "/" : pathname;
  return { locale, rest };
}

/** Dominios propios de sitios publicados: host → slug (caché 60 s por instancia). */
const domainCache = new Map<string, { slug: string | null; at: number }>();
async function lookupCustomDomain(host: string): Promise<string | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL; const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  const hit = domainCache.get(host);
  if (hit && Date.now() - hit.at < 60_000) return hit.slug;
  try {
    const res = await fetch(`${url}/rest/v1/published_sites?select=slug&custom_domain=eq.${encodeURIComponent(host)}&domain_status=eq.verified&limit=1`, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
    const rows = (await res.json()) as { slug: string }[];
    const slug = rows?.[0]?.slug ?? null;
    domainCache.set(host, { slug, at: Date.now() });
    return slug;
  } catch { return null; }
}

function isPlatformHost(host: string) {
  const app = (process.env.NEXT_PUBLIC_APP_URL || "").replace(/^https?:\/\//, "").split("/")[0];
  const site = (process.env.NEXT_PUBLIC_SITE_BASE_URL || "").replace(/^https?:\/\//, "").split("/")[0];
  return !host || host.startsWith("localhost") || host.startsWith("127.") || host === app || host === site || host.endsWith(".vercel.app");
}

export default async function middleware(request: NextRequest) {
  // Dominio propio de un sitio publicado → servir /s/<slug>
  const host = request.headers.get("host")?.split(":")[0]?.toLowerCase() ?? "";
  if (!isPlatformHost(host)) {
    const slug = await lookupCustomDomain(host);
    if (slug) { const url = request.nextUrl.clone(); url.pathname = `/s/${slug}`; return NextResponse.rewrite(url); }
  }

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
  matcher: ["/((?!api|s/|_next|_vercel|.*\\..*).*)"],
};
