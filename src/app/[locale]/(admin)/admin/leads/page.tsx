import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { requirePlatformAdmin } from "@/features/admin/guard";
import { Stat, Table } from "@/components/admin/table";
import { LeadForm } from "@/components/admin/lead-form";
import { Badge, Card } from "@/components/ui/card";
import { STAGES, isOverdue } from "@/features/leads/schema";
import { emailConfigured } from "@/features/leads/notify";
import { cn } from "@/lib/utils";
import type { Lead } from "@/types/database.types";

const STAGE_TONE: Record<string, "neutral" | "accent" | "success" | "warning" | "danger" | "info"> = {
  new: "accent", researched: "neutral", contacted: "info", interested: "info", meeting: "warning", proposal: "warning", negotiation: "warning", won: "success", lost: "danger",
};

/** Embudo comercial del fundador: leads de la web, etapas, seguimientos y origen. */
export default async function AdminLeads({ searchParams }: { searchParams: Promise<{ stage?: string; id?: string }> }) {
  const { stage, id } = await searchParams;
  const t = await getTranslations("admin.leads");
  const ts = await getTranslations("site.lead");
  const locale = await getLocale();
  const { db } = await requirePlatformAdmin();
  const { data, error } = await db.from("leads").select("*").order("created_at", { ascending: false }).limit(500);
  if (error) return <div className="space-y-4"><h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1><p className="text-danger text-[13px]">{t("tableMissing")}</p></div>;
  const leads = (data ?? []) as Lead[];
  const selected = id ? leads.find((l) => l.id === id) ?? null : null;
  const shown = stage ? leads.filter((l) => l.stage === stage) : leads;
  const count = (s: string) => leads.filter((l) => l.stage === s).length;
  const open = leads.filter((l) => l.stage !== "won" && l.stage !== "lost");
  const overdue = leads.filter((l) => isOverdue(l));
  const bySource = Object.entries(leads.reduce<Record<string, { n: number; won: number }>>((m, l) => {
    const k = [l.source || t("direct"), l.medium, l.campaign].filter(Boolean).join(" / ");
    m[k] ??= { n: 0, won: 0 }; m[k].n++; if (l.stage === "won") m[k].won++; return m;
  }, {})).sort((a, b) => b[1].n - a[1].n);
  const valueBy = open.reduce<Record<string, number>>((m, l) => { if (l.estimated_value) m[l.estimated_currency || "COP"] = (m[l.estimated_currency || "COP"] ?? 0) + Number(l.estimated_value); return m; }, {});
  const fmt = (n: number, c: string) => new Intl.NumberFormat(locale, { style: "currency", currency: c, maximumFractionDigits: 0 }).format(n);
  const date = (iso: string | null) => (iso ? new Date(iso).toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" }) : "—");
  const stageLabels = Object.fromEntries(STAGES.map((s) => [s, t(`stages.${s}`)]));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <a href="/api/admin/leads/export" download className="inline-flex items-center h-9 px-3.5 rounded-[10px] border border-border text-[13px] font-medium hover:border-border-strong">{t("export")}</a>
      </div>
      {!emailConfigured() && <p className="text-[13px] text-warning">{t("emailNotConfigured")}</p>}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label={t("total")} value={leads.length} sub={t("newCount", { n: count("new") })} />
        <Stat label={t("open")} value={open.length} sub={Object.entries(valueBy).map(([c, v]) => fmt(v, c)).join(" · ") || t("noValue")} />
        <Stat label={t("overdue")} value={overdue.length} />
        <Stat label={t("won")} value={count("won")} sub={leads.length ? t("rate", { pct: Math.round((count("won") / leads.length) * 100) }) : undefined} />
      </div>

      <div className="flex flex-wrap gap-1.5">
        <Link href="/admin/leads" className={cn("h-8 px-3 rounded-full border text-[12.5px] inline-flex items-center", !stage ? "bg-accent-soft text-accent border-accent/40" : "border-border text-fg-muted")}>{t("all")} · {leads.length}</Link>
        {STAGES.map((s) => (
          <Link key={s} href={`/admin/leads?stage=${s}`} className={cn("h-8 px-3 rounded-full border text-[12.5px] inline-flex items-center", stage === s ? "bg-accent-soft text-accent border-accent/40" : "border-border text-fg-muted")}>{stageLabels[s]} · {count(s)}</Link>
        ))}
      </div>

      {selected && (
        <Card className="p-5 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold">{selected.company}</h2>
            <Badge tone={STAGE_TONE[selected.stage]}>{stageLabels[selected.stage]}</Badge>
            <span className="flex-1" />
            <a className="text-accent text-[13px] hover:underline" href={`mailto:${selected.email}`}>{t("writeEmail")}</a>
          </div>
          <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-1.5 text-[13px]">
            {([
              [t("contact"), `${selected.full_name} · ${selected.email}`], [t("country"), selected.country], [t("website"), selected.website],
              [t("solution"), ts(`solutions.${selected.solution}`)], [t("budget"), selected.budget ? ts(`budgets.${selected.budget}`) : null], [t("timeframe"), ts(`timeframes.${selected.timeframe}`)],
              [t("meeting"), selected.wants_meeting ? t("yes") : t("no")], [t("source"), [selected.source, selected.medium, selected.campaign, selected.term, selected.content].filter(Boolean).join(" / ") || t("direct")],
              [t("landing"), selected.landing_page], [t("referrer"), selected.referrer], [t("received"), date(selected.created_at)], [t("language"), selected.locale.toUpperCase()],
            ] as [string, string | null][]).filter(([, v]) => v).map(([k, v]) => <div key={k} className="flex gap-2"><dt className="text-fg-subtle w-28 shrink-0">{k}</dt><dd className="min-w-0 break-words">{v}</dd></div>)}
          </dl>
          <p className="text-[14px] whitespace-pre-wrap rounded-[10px] bg-surface-2 p-3">{selected.problem}</p>
          <LeadForm lead={selected} stageLabels={stageLabels}
            labels={{ stage: t("stage"), value: t("value"), currency: t("currency"), lastContact: t("lastContact"), nextFollowUp: t("nextFollowUp"), notes: t("notes"), save: t("save"), saved: t("saved") }} />
        </Card>
      )}

      <Table head={[t("received"), t("company"), t("country"), t("solution"), t("source"), t("stage"), t("nextFollowUp"), ""]}
        rows={shown.map((l) => [
          date(l.created_at),
          <span key="c"><b>{l.company}</b><br /><span className="text-fg-muted">{l.full_name}</span></span>,
          l.country, ts(`solutions.${l.solution}`), [l.source, l.campaign].filter(Boolean).join(" / ") || t("direct"),
          <Badge key="s" tone={STAGE_TONE[l.stage]}>{stageLabels[l.stage]}</Badge>,
          <span key="f" className={cn(isOverdue(l) && "text-danger font-medium")}>{date(l.next_follow_up_at)}</span>,
          <Link key="o" href={`/admin/leads?id=${l.id}${stage ? `&stage=${stage}` : ""}`} className="text-accent hover:underline">{t("manage")}</Link>,
        ])}
        empty={t("none")} />

      <div>
        <h2 className="font-semibold mb-2">{t("bySource")}</h2>
        <Table head={[t("source"), t("leadsCol"), t("won")]} rows={bySource.map(([k, v]) => [k, v.n, v.won])} empty={t("none")} />
      </div>
    </div>
  );
}
