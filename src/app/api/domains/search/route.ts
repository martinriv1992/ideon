import { createClient } from "@/lib/supabase/server";
import { json, fail } from "@/lib/api";
import { getBilling } from "@/features/billing/fulfil";
import { domainCandidates, domainCostUsd, domainSalePrice } from "@/features/billing/pricing";
import { rateLimit } from "@/features/auth/abuse";
import * as registrar from "@/features/domains/registrar";

export const dynamic = "force-dynamic";

/**
 * Busca un nombre en las extensiones ofrecidas y devuelve disponibilidad y precio de venta anual.
 * Es público (buscador de la portada): sin sesión, cada conexión tiene un cupo por hora.
 */
export async function GET(req: Request) {
  if (!registrar.registrarConfigured()) return fail("not_configured", "La compra de dominios no está configurada todavía.", 503);
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!(await rateLimit(user ? "domain_search_user" : "domain_search", user ? 60 : 15, 3_600_000))) {
    return fail("rate_limited", "Has hecho muchas búsquedas seguidas. Inténtalo de nuevo en un rato.", 429);
  }
  const q = new URL(req.url).searchParams.get("q") ?? "";
  const s = await getBilling();
  const candidates = domainCandidates(q, s.tlds).slice(0, user ? 8 : 5);
  if (!candidates.length) return fail("invalid", "Escribe un nombre válido (letras, números y guiones).");

  const results = await Promise.all(candidates.map(async (domain) => {
    try {
      const [available, p] = await Promise.all([registrar.availability(domain), registrar.price(domain)]);
      if (!available || p.purchasePrice == null) return { domain, available: false };
      const costUsd = domainCostUsd(p);
      return { domain, available: true, price: domainSalePrice(costUsd, s), currency: s.currency };
    } catch {
      return { domain, available: false, unsupported: true };
    }
  }));
  return json({ results, hostingYear: s.hostingYear, currency: s.currency });
}
