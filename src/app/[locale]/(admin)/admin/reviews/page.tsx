import { getLocale, getTranslations } from "next-intl/server";
import { ExternalLink } from "lucide-react";
import { requirePlatformAdmin } from "@/features/admin/guard";
import { Table } from "@/components/admin/table";
import { SettingForm } from "@/components/admin/forms";
import { ReviewActions } from "@/components/admin/review-actions";
import { Badge, Card } from "@/components/ui/card";
import { siteBaseUrl } from "@/features/deploy/serve";
import type { ReviewPayload } from "@/features/deploy/review";

/** Revisión manual: publicaciones que esperan la aprobación del administrador. */
export default async function AdminReviews() {
  const t = await getTranslations("admin.reviews");
  const ta = await getTranslations("admin");
  const locale = await getLocale();
  const { db } = await requirePlatformAdmin();
  const date = (iso: string | null) => (iso ? new Date(iso).toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" }) : "—");

  const [{ data: pending }, { data: recent }, { data: setting }] = await Promise.all([
    db.from("approvals").select("*").eq("kind", "deploy").eq("decision", "pending").order("created_at", { ascending: true }),
    db.from("approvals").select("*").eq("kind", "deploy").neq("decision", "pending").not("decided_by", "is", null).order("decided_at", { ascending: false }).limit(20),
    db.from("platform_settings").select("value").eq("key", "publish_review_required").maybeSingle(),
  ]);
  const ids = [...new Set([...(pending ?? []), ...(recent ?? [])].map((a) => a.project_id))];
  const { data: projects } = ids.length ? await db.from("projects").select("id,name,kind,organization_id,package_key,paid_at").in("id", ids) : { data: [] };
  const { data: orgs } = projects?.length ? await db.from("organizations").select("id,name").in("id", [...new Set(projects.map((p) => p.organization_id))]) : { data: [] };
  const { data: sites } = ids.length ? await db.from("published_sites").select("project_id,slug,custom_domain,domain_status").in("project_id", ids) : { data: [] };
  const versionIds = (pending ?? []).map((a) => (a.payload as unknown as ReviewPayload).version_id).filter(Boolean);
  const { data: versions } = versionIds.length ? await db.from("project_versions").select("id,number,summary,qa_report").in("id", versionIds) : { data: [] };
  const emails = new Map<string, string>();
  for (const a of pending ?? []) if (a.requested_by && !emails.has(a.requested_by)) { const { data } = await db.auth.admin.getUserById(a.requested_by); if (data.user?.email) emails.set(a.requested_by, data.user.email); }
  const project = (id: string) => projects?.find((p) => p.id === id);
  const org = (id?: string) => orgs?.find((o) => o.id === id)?.name ?? "—";
  const liveUrl = (id: string) => { const s = sites?.find((x) => x.project_id === id); return s ? (s.custom_domain && s.domain_status === "verified" ? `https://${s.custom_domain}` : `${siteBaseUrl()}/s/${s.slug}`) : null; };
  const enabled = setting?.value === undefined || setting?.value === null ? true : setting.value !== false && setting.value !== "false";
  const labels = { approve: t("approve"), changes: t("changes"), notePh: t("notePh"), send: t("send"), cancel: t("cancel"), noteError: t("noteError"), done: t("done") };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <Badge tone={enabled ? "success" : "warning"}>{enabled ? t("on") : t("off")}</Badge>
      </div>
      <p className="text-[14px] text-fg-muted max-w-3xl">{t("intro")}</p>

      {(pending ?? []).length === 0 && <p className="text-[13px] text-fg-muted border border-dashed border-border rounded-[12px] p-6 text-center">{t("none")}</p>}
      {(pending ?? []).map((a) => {
        const p = project(a.project_id); const pl = a.payload as unknown as ReviewPayload;
        const v = versions?.find((x) => x.id === pl.version_id);
        const qa = (v?.qa_report ?? null) as { summary?: { ok: number; warn: number; bad: number; total: number } } | null;
        const live = liveUrl(a.project_id);
        return (
          <Card key={a.id} className="p-5 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold">{p?.name ?? a.project_id}</h2>
              <Badge tone="accent">v{pl.version_number ?? v?.number ?? "?"}</Badge>
              <Badge tone={pl.origin === "payment" ? "success" : "neutral"}>{pl.origin === "payment" ? t("originPayment") : t("originClient")}</Badge>
              {p?.package_key && <Badge tone="info">{p.package_key}</Badge>}
            </div>
            <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-1 text-[13px]">
              <div className="flex gap-2"><dt className="text-fg-subtle w-28">{t("client")}</dt><dd>{org(p?.organization_id)} · {a.requested_by ? emails.get(a.requested_by) ?? "—" : "—"}</dd></div>
              <div className="flex gap-2"><dt className="text-fg-subtle w-28">{t("requested")}</dt><dd>{date(a.created_at)}</dd></div>
              <div className="flex gap-2"><dt className="text-fg-subtle w-28">{t("kind")}</dt><dd>{p?.kind ?? "—"}</dd></div>
              <div className="flex gap-2"><dt className="text-fg-subtle w-28">QA</dt><dd>{qa?.summary ? `${qa.summary.ok}/${qa.summary.total} OK · ${qa.summary.warn} ${t("warnings")} · ${qa.summary.bad} ${t("errors")}` : "—"}</dd></div>
              {v?.summary && <div className="flex gap-2 sm:col-span-2"><dt className="text-fg-subtle w-28">{t("summary")}</dt><dd className="min-w-0">{v.summary}</dd></div>}
              <div className="flex gap-2 sm:col-span-2"><dt className="text-fg-subtle w-28">{t("live")}</dt><dd>{live ? <a href={live} target="_blank" rel="noreferrer" className="text-accent hover:underline break-all">{live}</a> : t("notLive")}</dd></div>
            </dl>
            <div className="flex flex-wrap gap-3">
              <a href={`/api/admin/projects/${a.project_id}/preview?v=${pl.version_id}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-[10px] border border-border text-[13px] font-medium hover:border-border-strong">
                <ExternalLink className="size-3.5" /> {t("openPreview")}
              </a>
            </div>
            <ReviewActions approvalId={a.id} labels={labels} />
          </Card>
        );
      })}

      <div>
        <h2 className="font-semibold mb-2">{t("recent")}</h2>
        <Table head={[t("decided"), t("project"), t("result"), t("note")]}
          rows={(recent ?? []).map((a) => {
            const pl = a.payload as unknown as ReviewPayload;
            return [date(a.decided_at), `${project(a.project_id)?.name ?? "—"} · v${pl.version_number ?? "?"}`,
              <Badge key="d" tone={a.decision === "approved" ? "success" : "warning"}>{a.decision === "approved" ? t("approved") : t("changesRequested")}</Badge>,
              <span key="n" className="text-fg-muted">{pl.note ?? ""}</span>];
          })}
          empty={t("noneRecent")} />
      </div>

      <div className="max-w-xl">
        <h2 className="font-semibold mb-2">{t("settingTitle")}</h2>
        <SettingForm setting={{ key: "publish_review_required", value: enabled }} help={t("settingHelp")} labels={{ save: ta("save"), saved: ta("saved") }} />
      </div>
    </div>
  );
}
