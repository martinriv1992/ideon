import { getLocale, getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentContext } from "@/features/organizations/queries";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { Badge, Card } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";
import { RenewButton } from "@/components/app/renew-button";
import { money } from "@/lib/money";
import { billingFromSettings, subscriptionState } from "@/features/billing/pricing";

export default async function SubscriptionsPage() {
  const t = await getTranslations("app.pages");
  const tl = await getTranslations("app.launch");
  const locale = await getLocale();
  const ctx = (await getCurrentContext())!;
  const supabase = await createClient();
  const [{ data: subs }, { data: sites }] = await Promise.all([
    supabase.from("subscriptions").select("*").eq("organization_id", ctx.organization.id).order("created_at", { ascending: false }),
    supabase.from("published_sites").select("*, projects!inner(id, name, organization_id)").eq("projects.organization_id", ctx.organization.id),
  ]);
  const { data: settings } = await supabase.from("platform_settings").select("key,value");
  const billing = billingFromSettings(settings ?? []);
  const names = new Map((sites ?? []).map((x) => [x.project_id, (x.projects as unknown as { name: string }).name]));
  const base = (process.env.NEXT_PUBLIC_SITE_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "");
  return (
    <PageBody>
      <PageHeader title={t("subscriptions.title")} description={t("subscriptions.subtitle")} />
      <h2 className="mt-8 text-lg font-semibold">{t("subscriptions.hosting")}</h2>
      {!sites?.length ? <Card className="mt-3 p-8 text-center text-fg-muted">{t("subscriptions.noSites")}</Card> : (
        <div className="mt-3 space-y-2">{sites.map((s) => { const pr = s.projects as unknown as { name: string }; return (
          <Card key={s.project_id} className="p-4 flex flex-wrap items-center gap-3"><span className="flex-1 min-w-0"><b>{pr.name}</b> · <a className="text-accent hover:underline" href={`${base}/s/${s.slug}`} target="_blank" rel="noreferrer">{base}/s/{s.slug}</a>{s.custom_domain ? ` · ${s.custom_domain}` : ""}</span><Badge tone="success">{t("subscriptions.included")}</Badge><span className="text-[13px] text-fg-muted">{formatDate(s.published_at, locale)}</span></Card>); })}</div>
      )}
      <h2 className="mt-10 text-lg font-semibold">{t("subscriptions.plans")}</h2>
      {!subs?.length ? <Card className="mt-3 p-8 text-center text-fg-muted">{t("subscriptions.none")}</Card> : (
        <div className="mt-3 space-y-2">{subs.map((s) => {
          const state = subscriptionState(s.current_period_end, billing.graceDays);
          const daysLeft = s.current_period_end ? Math.ceil((new Date(s.current_period_end).getTime() - Date.now()) / 86_400_000) : null;
          const project = (s.project_id && names.get(s.project_id)) || "";
          return (
            <Card key={s.id} className="p-4 flex flex-wrap items-center gap-3">
              <span className="flex-1 min-w-0">
                <b>{s.plan === "hosting_domain" ? tl("planName") : s.plan}</b>{project ? ` · ${project}` : ""}{s.domain ? ` · ${s.domain}` : ""}
                <span className="block text-[13px] text-fg-muted">
                  {money(Number(s.renewal_amount ?? s.amount), s.currency, locale)}/{tl("year")}
                  {s.current_period_end ? ` · ${tl(state === "active" ? "activeUntil" : "expiredOn", { date: formatDate(s.current_period_end, locale) })}` : ""}
                </span>
              </span>
              <Badge tone={state === "active" ? "success" : state === "grace" ? "warning" : "danger"}>{tl(`state.${state}`)}</Badge>
              {s.plan === "hosting_domain" && (state !== "active" || (daysLeft ?? 999) <= 60) && <RenewButton subscriptionId={s.id} label={tl("renew")} />}
            </Card>
          );
        })}</div>
      )}
    </PageBody>
  );
}
