import { getLocale, getTranslations } from "next-intl/server";
import { requirePlatformAdmin } from "@/features/admin/guard";
import { Table } from "@/components/admin/table";
import { Badge } from "@/components/ui/card";

export default async function AdminRuns() {
  const t = await getTranslations("admin");
  const locale = await getLocale();
  const { db } = await requirePlatformAdmin();
  const { data: runs } = await db.from("agent_runs").select("*, projects(name)").order("created_at", { ascending: false }).limit(200);
  const tone = (s: string) => (s === "succeeded" ? "success" : s === "failed" ? "danger" : s === "running" ? "warning" : "neutral") as "success" | "danger" | "warning" | "neutral";
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">{t("nav.runs")}</h1>
      <Table head={[t("runs.date"), t("runs.project"), t("runs.step"), t("runs.model"), t("runs.status"), t("runs.tokens"), t("runs.cost"), t("runs.duration"), t("runs.error")]}
        rows={(runs ?? []).map((r) => [new Date(r.created_at).toLocaleString(locale), (r.projects as unknown as { name: string } | null)?.name ?? "—", r.step, r.model ?? r.provider, <Badge key={r.id} tone={tone(r.status)}>{r.status}</Badge>, `${r.input_tokens}/${r.output_tokens}`, `$${Number(r.cost_usd).toFixed(4)}`, r.started_at && r.finished_at ? `${((new Date(r.finished_at).getTime() - new Date(r.started_at).getTime()) / 1000).toFixed(0)}s` : "—", <span key={r.id + "e"} className="text-danger">{r.error?.slice(0, 80) ?? ""}</span>])}
        empty={t("runs.empty")} />
    </div>
  );
}
