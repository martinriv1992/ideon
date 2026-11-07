import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentContext } from "@/features/organizations/queries";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { Badge, Card } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";

export default async function ProposalsPage() {
  const t = await getTranslations("app.pages");
  const tw = await getTranslations("app.workspace");
  const locale = await getLocale();
  const ctx = (await getCurrentContext())!;
  const supabase = await createClient();
  const { data: rows } = await supabase.from("proposals").select("*, projects!inner(id, name, organization_id)").eq("projects.organization_id", ctx.organization.id).order("created_at", { ascending: false }).limit(100);
  const money = (n: number | null, c: string) => n == null ? tw("priceByScope") : new Intl.NumberFormat(locale, { style: "currency", currency: c, maximumFractionDigits: 0 }).format(n);
  return (
    <PageBody>
      <PageHeader title={t("proposals.title")} description={t("proposals.subtitle")} />
      {!rows?.length ? <Card className="mt-8 p-10 text-center text-fg-muted">{t("proposals.empty")}</Card> : (
        <div className="mt-8 space-y-2">
          {rows.map((p) => { const pr = p.projects as unknown as { id: string; name: string }; return (
            <Link key={p.id} href={`/projects/${pr.id}`} className="block">
              <Card hover className="p-4 flex flex-wrap items-center gap-3">
                <div className="min-w-0 flex-1"><p className="font-medium truncate">{p.title}</p><p className="text-[13px] text-fg-muted truncate">{pr.name} · {formatDate(p.created_at, locale)}</p></div>
                <span className="text-[13px] text-fg-muted">{tw("days", { n: p.estimated_days ?? 0 })}</span>
                <span className="font-semibold">{money(p.price == null ? null : Number(p.price), p.currency)}</span>
                <Badge tone={p.status === "approved" ? "success" : p.status === "sent" ? "info" : "neutral"}>{tw(`proposalStatus.${p.status}`)}</Badge>
              </Card>
            </Link>); })}
        </div>
      )}
    </PageBody>
  );
}
