import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentContext } from "@/features/organizations/queries";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { Card } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";

export default async function FilesPage() {
  const t = await getTranslations("app.pages");
  const locale = await getLocale();
  const ctx = (await getCurrentContext())!;
  const supabase = await createClient();
  const { data: versions } = await supabase.from("project_versions").select("id, number, summary, created_at, project_id, projects!inner(id, name, organization_id)").eq("projects.organization_id", ctx.organization.id).order("created_at", { ascending: false }).limit(100);
  return (
    <PageBody>
      <PageHeader title={t("files.title")} description={t("files.subtitle")} />
      {!versions?.length ? <Card className="mt-8 p-10 text-center text-fg-muted">{t("files.empty")}</Card> : (
        <div className="mt-8 space-y-2">{versions.map((v) => { const pr = v.projects as unknown as { id: string; name: string }; return (
          <Card key={v.id} className="p-4 flex flex-wrap items-center gap-3">
            <span className="font-mono text-[12px]">v{v.number}</span>
            <span className="flex-1 min-w-0 truncate"><Link href={`/projects/${pr.id}`} className="font-medium hover:text-accent">{pr.name}</Link> · <span className="text-fg-muted">{v.summary}</span></span>
            <span className="text-[13px] text-fg-muted">{formatDate(v.created_at, locale)}</span>
            <a className="text-[13px] text-accent hover:underline" href={`/api/projects/${pr.id}/preview?v=${v.id}`} target="_blank" rel="noreferrer">{t("files.open")}</a>
            <a className="text-[13px] text-accent hover:underline" href={`/api/projects/${pr.id}/download?v=${v.id}`}>ZIP</a>
          </Card>); })}</div>
      )}
    </PageBody>
  );
}
