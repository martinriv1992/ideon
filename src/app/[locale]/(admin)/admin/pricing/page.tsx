import { getTranslations } from "next-intl/server";
import { requirePlatformAdmin } from "@/features/admin/guard";
import { PlanForm } from "@/components/admin/forms";

export default async function AdminPricing() {
  const t = await getTranslations("admin");
  const { db } = await requirePlatformAdmin();
  const { data: plans } = await db.from("pricing_plans").select("*").order("sort_order");
  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-semibold tracking-tight">{t("nav.pricing")}</h1><p className="text-fg-muted text-[14px] mt-1">{t("pricing.help")}</p></div>
      <div className="grid md:grid-cols-3 gap-3">{(plans ?? []).map((p) => <PlanForm key={p.key} plan={{ key: p.key, name_es: p.name_es, price_from: p.price_from == null ? null : Number(p.price_from), currency: p.currency, is_active: p.is_active }} labels={{ price: t("pricing.price"), currency: t("pricing.currency"), active: t("pricing.active"), save: t("save"), saved: t("saved") }} />)}</div>
    </div>
  );
}
