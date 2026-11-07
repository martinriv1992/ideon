import { getLocale, getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentContext } from "@/features/organizations/queries";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { Badge, Card } from "@/components/ui/card";
import { TicketForm } from "@/components/app/ticket-form";
import { formatDate } from "@/lib/utils";

export default async function SupportPage() {
  const t = await getTranslations("app.pages.support");
  const locale = await getLocale();
  const ctx = (await getCurrentContext())!;
  const supabase = await createClient();
  const [{ data: tickets }, { data: projects }] = await Promise.all([
    supabase.from("support_tickets").select("*").eq("organization_id", ctx.organization.id).order("created_at", { ascending: false }).limit(50),
    supabase.from("projects").select("id, name").eq("organization_id", ctx.organization.id).is("archived_at", null).order("updated_at", { ascending: false }),
  ]);
  return (
    <PageBody>
      <PageHeader title={t("title")} description={t("subtitle")} />
      <div className="mt-8 grid lg:grid-cols-[1fr_1.2fr] gap-6">
        <Card className="p-6"><h2 className="text-base font-semibold mb-4">{t("newTicket")}</h2><TicketForm projects={projects ?? []} /></Card>
        <div>
          <h2 className="text-base font-semibold mb-3">{t("yourTickets")}</h2>
          {!tickets?.length ? <Card className="p-8 text-center text-fg-muted">{t("none")}</Card> : (
            <div className="space-y-2">{tickets.map((k) => (<Card key={k.id} className="p-4"><div className="flex items-center gap-2"><b className="flex-1 truncate">{k.subject}</b><Badge tone={k.status === "resolved" || k.status === "closed" ? "success" : k.status === "in_progress" ? "info" : "warning"}>{k.status}</Badge></div><p className="mt-1 text-[13px] text-fg-muted line-clamp-2">{k.body}</p><p className="mt-1 text-[12px] text-fg-subtle">{formatDate(k.created_at, locale)}</p></Card>))}</div>
          )}
        </div>
      </div>
    </PageBody>
  );
}
