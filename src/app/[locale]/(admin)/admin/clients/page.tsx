import { getLocale, getTranslations } from "next-intl/server";
import { requirePlatformAdmin } from "@/features/admin/guard";
import { Table } from "@/components/admin/table";
import { formatDate } from "@/lib/utils";

export default async function AdminClients() {
  const t = await getTranslations("admin");
  const locale = await getLocale();
  const { db } = await requirePlatformAdmin();
  const [{ data: orgs }, { data: members }, { data: projects }, { data: usage }] = await Promise.all([
    db.from("organizations").select("*").order("created_at", { ascending: false }).limit(200),
    db.from("organization_members").select("organization_id,user_id,role, profiles(full_name)"),
    db.from("projects").select("organization_id"),
    db.from("ai_usage").select("organization_id,cost_usd"),
  ]);
  const count = (arr: { organization_id: string }[] | null, id: string) => (arr ?? []).filter((x) => x.organization_id === id).length;
  const cost = (id: string) => (usage ?? []).filter((u) => u.organization_id === id).reduce((n, u) => n + Number(u.cost_usd), 0);
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">{t("nav.clients")}</h1>
      <Table head={[t("clients.name"), t("clients.type"), t("clients.members"), t("clients.projects"), t("clients.aiCost"), t("clients.created")]}
        rows={(orgs ?? []).map((o) => [<b key={o.id}>{o.name}</b>, o.type, (members ?? []).filter((m) => m.organization_id === o.id).map((m) => `${(m.profiles as unknown as { full_name: string | null } | null)?.full_name ?? "?"} (${m.role})`).join(", "), count(projects, o.id), `$${cost(o.id).toFixed(2)}`, formatDate(o.created_at, locale)])}
        empty={t("clients.empty")} />
    </div>
  );
}
