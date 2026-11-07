import { getLocale, getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentContext } from "@/features/organizations/queries";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { Badge, Card } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";

export default async function SubscriptionsPage() {
  const t = await getTranslations("app.pages");
  const locale = await getLocale();
  const ctx = (await getCurrentContext())!;
  const supabase = await createClient();
  const [{ data: subs }, { data: sites }] = await Promise.all([
    supabase.from("subscriptions").select("*").eq("organization_id", ctx.organization.id).order("created_at", { ascending: false }),
    supabase.from("published_sites").select("*, projects!inner(id, name, organization_id)").eq("projects.organization_id", ctx.organization.id),
  ]);
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
        <div className="mt-3 space-y-2">{subs.map((s) => (<Card key={s.id} className="p-4 flex items-center gap-3"><span className="flex-1">{s.plan}</span><span>{s.amount} {s.currency}/{s.period}</span><Badge tone={s.status === "active" ? "success" : "warning"}>{s.status}</Badge></Card>))}</div>
      )}
    </PageBody>
  );
}
