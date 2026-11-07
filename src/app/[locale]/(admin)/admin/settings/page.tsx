import { getTranslations } from "next-intl/server";
import { requirePlatformAdmin } from "@/features/admin/guard";
import { SettingForm } from "@/components/admin/forms";

export default async function AdminSettings() {
  const t = await getTranslations("admin");
  const { db } = await requirePlatformAdmin();
  const { data: settings } = await db.from("platform_settings").select("*").order("key");
  const help: Record<string, string> = { require_proposal_approval: t("settings.requireApproval"), require_payment_before_build: t("settings.requirePayment"), default_currency: t("settings.currency"), site_base_url: t("settings.siteBase") };
  const env = [["ANTHROPIC_API_KEY", Boolean(process.env.ANTHROPIC_API_KEY)], ["AI_PROVIDER", process.env.AI_PROVIDER ?? "anthropic"], ["STRIPE_SECRET_KEY", Boolean(process.env.STRIPE_SECRET_KEY)], ["STRIPE_WEBHOOK_SECRET", Boolean(process.env.STRIPE_WEBHOOK_SECRET)], ["WOMPI_PUBLIC_KEY", Boolean(process.env.WOMPI_PUBLIC_KEY)], ["VERCEL_TOKEN", Boolean(process.env.VERCEL_TOKEN)], ["NEXT_PUBLIC_SITE_BASE_URL", process.env.NEXT_PUBLIC_SITE_BASE_URL ?? "—"]] as const;
  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold tracking-tight">{t("nav.settings")}</h1>
      <section className="space-y-3"><h2 className="text-base font-semibold">{t("settings.commercial")}</h2>{(settings ?? []).map((s) => <SettingForm key={s.key} setting={{ key: s.key, value: s.value }} help={help[s.key] ?? ""} labels={{ save: t("save"), saved: t("saved") }} />)}</section>
      <section><h2 className="text-base font-semibold mb-3">{t("settings.integrations")}</h2>
        <div className="bg-surface border border-border rounded-[14px] divide-y divide-border">{env.map(([k, v]) => <div key={k} className="flex items-center justify-between px-4 py-2.5 text-[13px]"><span className="font-mono">{k}</span><span className={typeof v === "boolean" ? (v ? "text-success" : "text-fg-subtle") : "text-fg-muted"}>{typeof v === "boolean" ? (v ? t("settings.configured") : t("settings.missing")) : v}</span></div>)}</div>
        <p className="text-[12px] text-fg-subtle mt-2">{t("settings.envNote")}</p></section>
    </div>
  );
}
