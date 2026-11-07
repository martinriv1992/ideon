import { getTranslations } from "next-intl/server";
import { requirePlatformAdmin } from "@/features/admin/guard";
import { PolicyForm } from "@/components/admin/forms";
import { Table } from "@/components/admin/table";
import { DEFAULT_POLICIES, aiProviderName } from "@/lib/ai/provider";
import { billingFromSettings } from "@/features/billing/pricing";

export default async function AdminAi() {
  const t = await getTranslations("admin");
  const { db } = await requirePlatformAdmin();
  const [{ data: policies }, { data: usage }] = await Promise.all([db.from("model_policies").select("*"), db.from("ai_usage").select("model,input_tokens,output_tokens,cost_usd,created_at").order("created_at", { ascending: false }).limit(5000)]);
  const tasks = ["consultant", "architect", "developer_preview", "modify_preview", "developer", "modify"] as const;
  const rows = tasks.map((task) => (policies ?? []).find((p) => p.task === task) ?? { ...DEFAULT_POLICIES[task], max_output_tokens: DEFAULT_POLICIES[task].maxOutputTokens, input_cost_per_mtok: DEFAULT_POLICIES[task].inputCostPerMtok, output_cost_per_mtok: DEFAULT_POLICIES[task].outputCostPerMtok });
  const byModel = (usage ?? []).reduce<Record<string, { calls: number; tokens: number; cost: number }>>((m, u) => { const x = (m[u.model] ??= { calls: 0, tokens: 0, cost: 0 }); x.calls++; x.tokens += u.input_tokens + u.output_tokens; x.cost += Number(u.cost_usd); return m; }, {});
  const provider = aiProviderName();

  // Vistas previas gratuitas: gasto de hoy frente al tope y evolución de 14 días (hora de Colombia).
  const since = new Date(Date.now() - 14 * 86_400_000).toISOString();
  const [{ data: spendToday }, { data: settings }, { data: recentUsage }, { data: recentProjects }] = await Promise.all([
    db.rpc("free_preview_spend_today"),
    db.from("platform_settings").select("key,value"),
    db.from("ai_usage").select("project_id,cost_usd,created_at").gte("created_at", since).limit(20000),
    db.from("projects").select("id,created_at,paid_at").or(`created_at.gte.${since},paid_at.gte.${since}`).limit(20000),
  ]);
  const budget = billingFromSettings(settings ?? []).previewDailyBudgetUsd;
  const day = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { timeZone: "America/Bogota" });
  const paidAt = new Map<string, string | null>();
  const usageIds = [...new Set((recentUsage ?? []).map((u) => u.project_id).filter(Boolean) as string[])].slice(0, 1000);
  const { data: usageProjects } = usageIds.length ? await db.from("projects").select("id,paid_at").in("id", usageIds) : { data: [] };
  for (const p of [...(recentProjects ?? []), ...(usageProjects ?? [])]) paidAt.set(p.id, p.paid_at);
  const days = new Map<string, { free: number; paid: number; created: number; activated: number }>();
  for (let i = 13; i >= 0; i--) days.set(day(new Date(Date.now() - i * 86_400_000).toISOString()), { free: 0, paid: 0, created: 0, activated: 0 });
  for (const u of recentUsage ?? []) {
    const d = days.get(day(u.created_at)); if (!d) continue;
    const paid = u.project_id ? paidAt.get(u.project_id) : null;
    if (paid && new Date(u.created_at) >= new Date(paid)) d.paid += Number(u.cost_usd); else d.free += Number(u.cost_usd);
  }
  for (const p of recentProjects ?? []) {
    const c = days.get(day(p.created_at)); if (c) c.created++;
    if (p.paid_at) { const a = days.get(day(p.paid_at)); if (a) a.activated++; }
  }
  const totals = [...days.values()].reduce((t, d) => ({ free: t.free + d.free, paid: t.paid + d.paid, created: t.created + d.created, activated: t.activated + d.activated }), { free: 0, paid: 0, created: 0, activated: 0 });
  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-semibold tracking-tight">{t("nav.ai")}</h1><p className="text-fg-muted text-[14px] mt-1">{t("ai.provider")}: <b>{provider ?? t("ai.none")}</b> · {t("ai.help")}</p></div>
      <div className="grid md:grid-cols-2 gap-3">{rows.map((p) => <PolicyForm key={p.task} policy={{ task: p.task, model: p.model, max_output_tokens: p.max_output_tokens, input_cost_per_mtok: Number(p.input_cost_per_mtok), output_cost_per_mtok: Number(p.output_cost_per_mtok) }} labels={{ model: t("ai.model"), maxTokens: t("ai.maxTokens"), inCost: t("ai.inCost"), outCost: t("ai.outCost"), save: t("save"), saved: t("saved") }} />)}</div>
      <section className="space-y-3">
        <h2 className="text-base font-semibold">{t("ai.previews")}</h2>
        <div className="grid sm:grid-cols-4 gap-3">
          {[
            [t("ai.todayFree"), `$${Number(spendToday ?? 0).toFixed(2)} / $${budget.toFixed(2)}`],
            [t("ai.freeCost14"), `$${totals.free.toFixed(2)}`],
            [t("ai.paidCost14"), `$${totals.paid.toFixed(2)}`],
            [t("ai.conversion14"), totals.created ? `${totals.activated}/${totals.created} · ${Math.round((totals.activated / totals.created) * 100)}%` : "—"],
          ].map(([k, v]) => <div key={k} className="bg-surface border border-border rounded-[14px] p-4"><p className="text-[12px] text-fg-muted">{k}</p><p className="mt-1 text-xl font-semibold tabular-nums">{v}</p></div>)}
        </div>
        <p className="text-[12px] text-fg-subtle">{t("ai.previewsHelp")}</p>
        <Table head={[t("ai.day"), t("ai.freeCost"), t("ai.paidCost"), t("ai.created"), t("ai.activated"), t("ai.costPerActivation")]}
          rows={[...days.entries()].reverse().map(([d, x]) => [d, `$${x.free.toFixed(2)}`, `$${x.paid.toFixed(2)}`, x.created, x.activated, x.activated ? `$${(x.free / x.activated).toFixed(2)}` : "—"])} empty="—" />
      </section>
      <section><h2 className="text-base font-semibold mb-3">{t("ai.usage")}</h2>
        <Table head={[t("ai.model"), t("ai.calls"), "Tokens", t("ai.cost")]} rows={Object.entries(byModel).map(([m, x]) => [m, x.calls, x.tokens.toLocaleString(), `$${x.cost.toFixed(2)}`])} empty={t("ai.noUsage")} /></section>
    </div>
  );
}
