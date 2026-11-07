import { getTranslations } from "next-intl/server";
import { Plus, Sparkles } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { getCurrentContext } from "@/features/organizations/queries";
import { listProjects, projectStats } from "@/features/projects/queries";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { ProjectCard } from "@/components/app/project-card";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default async function DashboardPage() {
  const t = await getTranslations("app.dashboard");
  const ctx = (await getCurrentContext())!;
  const projects = await listProjects(ctx.organization.id, "all");
  const stats = projectStats(projects);
  const recent = projects.filter((p) => !p.archived_at).slice(0, 6);
  const firstName = (ctx.profile.full_name ?? "").split(" ")[0] || ctx.user.email || "";

  const tiles = [
    { label: t("statsAll"), value: stats.all },
    { label: t("statsDraft"), value: stats.draft },
    { label: t("statsActive"), value: stats.active },
    { label: t("statsLive"), value: stats.live },
  ];

  return (
    <PageBody>
      <PageHeader
        title={t("greeting", { name: firstName })}
        description={t("subtitle")}
        actions={
          <Link href="/projects/new">
            <Button>
              <Plus className="size-4" /> {t("empty.cta")}
            </Button>
          </Link>
        }
      />

      <div className="mt-8 grid grid-cols-2 lg:grid-cols-4 gap-3">
        {tiles.map((s) => (
          <Card key={s.label} className="p-5">
            <p className="text-[13px] text-fg-muted">{s.label}</p>
            <p className="mt-2 text-3xl font-semibold tracking-tight tabular-nums">{s.value}</p>
          </Card>
        ))}
      </div>

      <div className="mt-10 flex items-center justify-between">
        <h2 className="text-lg font-semibold tracking-tight">{t("recent")}</h2>
        {recent.length > 0 && (
          <Link href="/projects" className="text-sm text-fg-muted hover:text-fg">
            {t("viewAll")}
          </Link>
        )}
      </div>

      {recent.length === 0 ? (
        <Card className="mt-4 p-10 text-center">
          <div className="mx-auto size-12 rounded-full bg-accent-soft text-accent flex items-center justify-center">
            <Sparkles className="size-5" />
          </div>
          <h3 className="mt-4 text-lg font-semibold tracking-tight">{t("empty.title")}</h3>
          <p className="mt-1.5 text-[15px] text-fg-muted">{t("empty.text")}</p>
          <Link href="/projects/new" className="inline-block mt-6">
            <Button>{t("empty.cta")}</Button>
          </Link>
        </Card>
      ) : (
        <div className="mt-4 grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {recent.map((p) => (
            <ProjectCard key={p.id} project={p} />
          ))}
        </div>
      )}
    </PageBody>
  );
}
