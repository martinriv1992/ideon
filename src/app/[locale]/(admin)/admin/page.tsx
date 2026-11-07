import { getLocale, getTranslations } from "next-intl/server";
import { requirePlatformAdmin } from "@/features/admin/guard";
import { Stat, Table } from "@/components/admin/table";
import { formatDate } from "@/lib/utils";

export default async function AdminOverview() {
  const t = await getTranslations("admin");
  const locale = await getLocale();
  const { db } = await requirePlatformAdmin();
  const since30 = new Date(Date.now() - 30 * 86400e3).toISOString();
  const [orgs, projects, payments, subs, usage, runs, proposals, versions, recentRuns] = await Promise.all([
    db.from("organizations").select("id", { count: "exact", head: true }),
    db.from("projects").select("status"),
    db.from("payments").select("amount,currency,status,paid_at").eq("status", "paid"),
    db.from("subscriptions").select("amount,currency,period,status").eq("status", "active"),
    db.from("ai_usage").select("input_tokens,output_tokens,cost_usd,model"),
    db.from("agent_runs").select("status,step,cost_usd,created_at").gte("created_at", since30),
    db.from("proposals").select("status"),
    db.from("project_versions").select("id", { count: "exact", head: true }),
    db.from("agent_runs").select("*, projects(name)").eq("status", "failed").order("created_at", { ascending: false }).limit(8),
  ]);
  const money = (n: number, c = "USD") => new Intl.NumberFormat(locale, { style: "currency", currency: c, maximumFractionDigits: 0 }).format(n);
  const revenue = (payments.data ?? []).reduce((n, p) => n + Number(p.amount), 0);
  const revenue30 = (payments.data ?? []).filter((p) => p.paid_at && p.paid_at >= since30).reduce((n, p) => n + Number(p.amount), 0);
  const mrr = (subs.data ?? []).reduce((n, s) => n + Number(s.amount) * (s.period === "year" ? 1 / 12 : 1), 0);
  const st = (projects.data ?? []).reduce<Record<string, number>>((m, p) => ((m[p.status] = (m[p.status] ?? 0) + 1), m), {});
  const running = (st.in_development ?? 0) + (st.review ?? 0) + (st.approved ?? 0);
  const finished = (st.live ?? 0) + (st.maintenance ?? 0);
  const tokens = (usage.data ?? []).reduce((n, u) => n + u.input_tokens + u.output_tokens, 0);
  const aiCost = (usage.data ?? []).reduce((n, u) => n + Number(u.cost_usd), 0);
  const byModel = (usage.data ?? []).reduce<Record<string, number>>((m, u) => ((m[u.model] = (m[u.model] ?? 0) + Number(u.cost_usd)), m), {});
  const sent = (proposals.data ?? []).length; const approved = (proposals.data ?? []).filter((p) => p.status === "approved").length;
  const failed = (runs.data ?? []).filter((r) => r.status === "failed").length;
  const margin = revenue - aiCost;
  return (
    <div className="space-y-8">
      <div><h1 className="text-2xl font-semibold tracking-tight">{t("overview.title")}</h1><p className="text-fg-muted text-[14px] mt-1">{t("overview.subtitle")}</p></div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label={t("overview.revenue")} value={money(revenue)} sub={`${t("overview.last30")}: ${money(revenue30)}`} />
        <Stat label={t("overview.mrr")} value={money(mrr)} sub={`${subs.data?.length ?? 0} ${t("overview.activeSubs")}`} />
        <Stat label={t("overview.clients")} value={orgs.count ?? 0} />
        <Stat label={t("overview.projectsRunning")} value={running} sub={`${finished} ${t("overview.finished")} · ${versions.count ?? 0} ${t("overview.versions")}`} />
        <Stat label={t("overview.aiCost")} value={money(aiCost)} sub={`${(tokens / 1000).toFixed(0)}k tokens`} />
        <Stat label={t("overview.margin")} value={money(margin)} sub={t("overview.marginNote")} />
        <Stat label={t("overview.conversion")} value={sent ? `${Math.round((approved / sent) * 100)}%` : "—"} sub={`${approved}/${sent} ${t("overview.proposalsApproved")}`} />
        <Stat label={t("overview.failedRuns")} value={failed} sub={t("overview.last30")} />
      </div>
      <section>
        <h2 className="text-base font-semibold mb-3">{t("overview.costByModel")}</h2>
        <Table head={[t("overview.model"), t("overview.cost")]} rows={Object.entries(byModel).sort((a, b) => b[1] - a[1]).map(([m, c]) => [m, money(c)])} empty={t("overview.noUsage")} />
      </section>
      <section>
        <h2 className="text-base font-semibold mb-3">{t("overview.recentErrors")}</h2>
        <Table head={[t("overview.date"), t("overview.project"), t("overview.step"), t("overview.error")]} rows={(recentRuns.data ?? []).map((r) => [formatDate(r.created_at, locale), (r.projects as unknown as { name: string } | null)?.name ?? "—", r.step, <span key={r.id} className="text-danger">{r.error?.slice(0, 120)}</span>])} empty={t("overview.noErrors")} />
      </section>
    </div>
  );
}
