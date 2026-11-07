import { createClient } from "@/lib/supabase/server";
import { json, fail } from "@/lib/api";
import { getBilling } from "@/features/billing/fulfil";
import { domainCandidates, domainCostUsd, domainSalePrice } from "@/features/billing/pricing";
import * as registrar from "@/features/domains/registrar";

export const dynamic = "force-dynamic";

/** Busca un nombre en las extensiones ofrecidas y devuelve disponibilidad y precio de venta anual. */
export async function GET(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return fail("unauthenticated", "Inicia sesión", 401);
  if (!process.env.VERCEL_TOKEN) return fail("not_configured", "La compra de dominios no está configurada todavía.", 503);
  const q = new URL(req.url).searchParams.get("q") ?? "";
  const s = await getBilling();
  const candidates = domainCandidates(q, s.tlds).slice(0, 8);
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
