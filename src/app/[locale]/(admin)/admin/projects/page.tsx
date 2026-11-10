import { getLocale, getTranslations } from "next-intl/server";
import { requirePlatformAdmin } from "@/features/admin/guard";
import { Table } from "@/components/admin/table";
import { StatusBadge } from "@/components/app/status-badge";
import { formatDate } from "@/lib/utils";
import { Link } from "@/i18n/navigation";

export default async function AdminProjects() {
  const t = await getTranslations("admin");
  const locale = await getLocale();
  const { db } = await requirePlatformAdmin();
  const [{ data: projects }, { data: usage }, { data: payments }, { data: convs }] = await Promise.all([
    db.from("projects").select("*, organizations(name)").order("updated_at", { ascending: false }).limit(300),
    db.from("ai_usage").select("project_id,cost_usd,input_tokens,output_tokens"),
    db.from("payments").select("project_id,amount,status").eq("status", "paid"),
    db.from("conversations").select("id,project_id"),
  ]);
  // Primera instrucción de cada cliente (el prompt con el que empezó su proyecto).
  const convIds = (convs ?? []).map((c) => c.id);
  const { data: firstMsgs } = convIds.length
    ? await db.from("messages").select("conversation_id,content,created_at").in("conversation_id", convIds).eq("role", "user").order("created_at", { ascending: true }).limit(5000)
    : { data: [] as { conversation_id: string; content: string; created_at: string }[] };
  const firstByConv = new Map<string, string>();
  for (const m of firstMsgs ?? []) if (!firstByConv.has(m.conversation_id)) firstByConv.set(m.conversation_id, m.content);
  const idea = (id: string) => { const c = (convs ?? []).find((x) => x.project_id === id); return (c && firstByConv.get(c.id)) || ""; };
  const cost = (id: string) => (usage ?? []).filter((u) => u.project_id === id).reduce((n, u) => n + Number(u.cost_usd), 0);
  const rev = (id: string) => (payments ?? []).filter((p) => p.project_id === id).reduce((n, p) => n + Number(p.amount), 0);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("nav.projects")}</h1>
        <p className="mt-1 text-[13px] text-fg-muted">{t("projects.openHelp")}</p>
      </div>
      <Table head={[t("projects.name"), t("projects.client"), t("projects.idea"), t("projects.kind"), t("projects.status"), t("projects.revenue"), t("projects.aiCost"), t("projects.margin"), t("projects.updated")]}
        rows={(projects ?? []).map((p) => { const c = cost(p.id); const r = rev(p.id); return [<span key={p.id} className="flex flex-col gap-0.5"><b>{p.name}</b><Link href={`/projects/${p.id}`} className="text-[12px] text-accent hover:underline">{t("projects.open")} →</Link></span>, (p.organizations as unknown as { name: string } | null)?.name ?? "—",
          <span key={p.id + "i"} className="block max-w-[320px] text-[12.5px] text-fg-muted line-clamp-3" title={idea(p.id)}>{idea(p.id) || "—"}</span>, p.kind, <StatusBadge key={p.id + "s"} status={p.status} />, `$${r.toFixed(0)}`, `$${c.toFixed(2)}`, <span key={p.id + "m"} className={r - c < 0 ? "text-danger" : ""}>{`$${(r - c).toFixed(2)}`}</span>, formatDate(p.updated_at, locale)]; })}
        empty={t("projects.empty")} />
    </div>
  );
}
