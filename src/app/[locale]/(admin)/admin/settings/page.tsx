import { getTranslations } from "next-intl/server";
import { requirePlatformAdmin } from "@/features/admin/guard";
import { SettingForm } from "@/components/admin/forms";

export default async function AdminSettings() {
  const t = await getTranslations("admin");
  const { db } = await requirePlatformAdmin();
  const { data: rows } = await db.from("platform_settings").select("*").order("key");
  // Ajustes con valor por defecto en el código: se muestran aunque aún no tengan fila.
  const defaults: { key: string; value: unknown }[] = [{ key: "prospect_plan_price", value: 80000 }, { key: "prospect_plan_searches", value: 20 }, { key: "prospect_plan_days", value: 30 }, { key: "prospect_single_price", value: 12000 }, { key: "prospect_trial_searches", value: 3 }, { key: "app_ai_daily_limit", value: 100 }, { key: "max_projects_per_ip_day", value: 3 }, { key: "publish_review_required", value: true }];
  const settings = [...(rows ?? []), ...defaults.filter((d) => !(rows ?? []).some((r) => r.key === d.key))].sort((a, b) => a.key.localeCompare(b.key));
  const help: Record<string, string> = { require_proposal_approval: t("settings.requireApproval"), require_payment_before_build: t("settings.requirePayment"), default_currency: t("settings.currency"), site_base_url: t("settings.siteBase"), billing_currency: t("settings.billingCurrency"), usd_to_billing_rate: t("settings.usdRate"), hosting_price_year: t("settings.hostingYear"), domain_markup_pct: t("settings.domainMarkup"), domain_tlds: t("settings.domainTlds"), free_preview_changes: t("settings.freeChanges"), renewal_grace_days: t("settings.graceDays"), free_preview_daily_budget_usd: t("settings.previewBudget"), max_signups_per_ip_day: t("settings.maxSignups"), included_changes_year: t("settings.includedChanges"), change_packs: t("settings.changePacks"), prospect_plan_price: t("settings.prospectPlanPrice"), prospect_plan_searches: t("settings.prospectPlanSearches"), prospect_plan_days: t("settings.prospectPlanDays"), prospect_single_price: t("settings.prospectSinglePrice"), prospect_trial_searches: t("settings.prospectTrial"), app_ai_daily_limit: t("settings.appAiLimit"), max_projects_per_ip_day: t("settings.maxProjectsIp"), publish_review_required: t("settings.publishReview") };
  const env = [["ANTHROPIC_API_KEY", Boolean(process.env.ANTHROPIC_API_KEY)], ["AI_PROVIDER", process.env.AI_PROVIDER ?? "anthropic"], ["STRIPE_SECRET_KEY", Boolean(process.env.STRIPE_SECRET_KEY)], ["STRIPE_WEBHOOK_SECRET", Boolean(process.env.STRIPE_WEBHOOK_SECRET)], ["EPAYCO_PUBLIC_KEY", Boolean(process.env.EPAYCO_PUBLIC_KEY)], ["EPAYCO_P_CUST_ID_CLIENTE", Boolean(process.env.EPAYCO_P_CUST_ID_CLIENTE)], ["EPAYCO_P_KEY", Boolean(process.env.EPAYCO_P_KEY)], ["EPAYCO_TEST", process.env.EPAYCO_TEST ?? "false"], ["VERCEL_TOKEN", Boolean(process.env.VERCEL_TOKEN)], ["VERCEL_TEAM_ID", Boolean(process.env.VERCEL_TEAM_ID)], ["VERCEL_PROJECT_ID", Boolean(process.env.VERCEL_PROJECT_ID)], ["NEXT_PUBLIC_SITE_BASE_URL", process.env.NEXT_PUBLIC_SITE_BASE_URL ?? "—"]] as const;
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
