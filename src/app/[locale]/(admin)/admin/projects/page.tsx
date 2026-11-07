import { getLocale, getTranslations } from "next-intl/server";
import { requirePlatformAdmin } from "@/features/admin/guard";
import { Table } from "@/components/admin/table";
import { StatusBadge } from "@/components/app/status-badge";
import { formatDate } from "@/lib/utils";

export default async function AdminProjects() {
  const t = await getTranslations("admin");
  const locale = await getLocale();
  const { db } = await requirePlatformAdmin();
  const [{ data: projects }, { data: usage }, { data: payments }] = await Promise.all([
    db.from("projects").select("*, organizations(name)").order("updated_at", { ascending: false }).limit(300),
    db.from("ai_usage").select("project_id,cost_usd,input_tokens,output_tokens"),
    db.from("payments").select("project_id,amount,status").eq("status", "paid"),
  ]);
  const cost = (id: string) => (usage ?? []).filter((u) => u.project_id === id).reduce((n, u) => n + Number(u.cost_usd), 0);
  const rev = (id: string) => (payments ?? []).filter((p) => p.project_id === id).reduce((n, p) => n + Number(p.amount), 0);
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">{t("nav.projects")}</h1>
      <Table head={[t("projects.name"), t("projects.client"), t("projects.kind"), t("projects.status"), t("projects.revenue"), t("projects.aiCost"), t("projects.margin"), t("projects.updated")]}
        rows={(projects ?? []).map((p) => { const c = cost(p.id); const r = rev(p.id); return [<b key={p.id}>{p.name}</b>, (p.organizations as unknown as { name: string } | null)?.name ?? "—", p.kind, <StatusBadge key={p.id + "s"} status={p.status} />, `$${r.toFixed(0)}`, `$${c.toFixed(2)}`, <span key={p.id + "m"} className={r - c < 0 ? "text-danger" : ""}>{`$${(r - c).toFixed(2)}`}</span>, formatDate(p.updated_at, locale)]; })}
        empty={t("projects.empty")} />
    </div>
  );
}
