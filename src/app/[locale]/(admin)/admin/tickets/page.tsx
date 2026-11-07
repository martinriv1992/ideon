import { getLocale, getTranslations } from "next-intl/server";
import { requirePlatformAdmin } from "@/features/admin/guard";
import { Table } from "@/components/admin/table";
import { TicketStatus } from "@/components/admin/ticket-status";

export default async function AdminTickets() {
  const t = await getTranslations("admin");
  const locale = await getLocale();
  const { db } = await requirePlatformAdmin();
  const { data: tickets } = await db.from("support_tickets").select("*, organizations(name, billing_email), projects(name)").order("created_at", { ascending: false }).limit(200);
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">{t("nav.tickets")}</h1>
      <Table head={[t("tickets.date"), t("tickets.client"), t("tickets.project"), t("tickets.subject"), t("tickets.body"), t("tickets.status")]}
        rows={(tickets ?? []).map((k) => [new Date(k.created_at).toLocaleString(locale), `${(k.organizations as unknown as { name: string; billing_email: string | null } | null)?.name ?? "—"} (${(k.organizations as unknown as { billing_email: string | null } | null)?.billing_email ?? ""})`, (k.projects as unknown as { name: string } | null)?.name ?? "—", <b key={k.id}>{k.subject}</b>, <span key={k.id + "b"} className="text-fg-muted">{k.body.slice(0, 160)}</span>, <TicketStatus key={k.id + "s"} id={k.id} status={k.status} />])}
        empty={t("tickets.none")} />
    </div>
  );
}
