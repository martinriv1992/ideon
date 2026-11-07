import { getTranslations } from "next-intl/server";
import { requirePlatformAdmin } from "@/features/admin/guard";
import { PolicyForm } from "@/components/admin/forms";
import { Table } from "@/components/admin/table";
import { DEFAULT_POLICIES, aiProviderName } from "@/lib/ai/provider";

export default async function AdminAi() {
  const t = await getTranslations("admin");
  const { db } = await requirePlatformAdmin();
  const [{ data: policies }, { data: usage }] = await Promise.all([db.from("model_policies").select("*"), db.from("ai_usage").select("model,input_tokens,output_tokens,cost_usd,created_at").order("created_at", { ascending: false }).limit(5000)]);
  const tasks = ["consultant", "architect", "developer", "modify"] as const;
  const rows = tasks.map((task) => (policies ?? []).find((p) => p.task === task) ?? { ...DEFAULT_POLICIES[task], max_output_tokens: DEFAULT_POLICIES[task].maxOutputTokens, input_cost_per_mtok: DEFAULT_POLICIES[task].inputCostPerMtok, output_cost_per_mtok: DEFAULT_POLICIES[task].outputCostPerMtok });
  const byModel = (usage ?? []).reduce<Record<string, { calls: number; tokens: number; cost: number }>>((m, u) => { const x = (m[u.model] ??= { calls: 0, tokens: 0, cost: 0 }); x.calls++; x.tokens += u.input_tokens + u.output_tokens; x.cost += Number(u.cost_usd); return m; }, {});
  const provider = aiProviderName();
  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-semibold tracking-tight">{t("nav.ai")}</h1><p className="text-fg-muted text-[14px] mt-1">{t("ai.provider")}: <b>{provider ?? t("ai.none")}</b> · {t("ai.help")}</p></div>
      <div className="grid md:grid-cols-2 gap-3">{rows.map((p) => <PolicyForm key={p.task} policy={{ task: p.task, model: p.model, max_output_tokens: p.max_output_tokens, input_cost_per_mtok: Number(p.input_cost_per_mtok), output_cost_per_mtok: Number(p.output_cost_per_mtok) }} labels={{ model: t("ai.model"), maxTokens: t("ai.maxTokens"), inCost: t("ai.inCost"), outCost: t("ai.outCost"), save: t("save"), saved: t("saved") }} />)}</div>
      <section><h2 className="text-base font-semibold mb-3">{t("ai.usage")}</h2>
        <Table head={[t("ai.model"), t("ai.calls"), "Tokens", t("ai.cost")]} rows={Object.entries(byModel).map(([m, x]) => [m, x.calls, x.tokens.toLocaleString(), `$${x.cost.toFixed(2)}`])} empty={t("ai.noUsage")} /></section>
    </div>
  );
}
