import { getTranslations } from "next-intl/server";
import { Plus } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { getCurrentContext } from "@/features/organizations/queries";
import { listProjects } from "@/features/projects/queries";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { ProjectCard } from "@/components/app/project-card";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Filter = "all" | "active" | "archived";

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const t = await getTranslations("app.projects");
  const ctx = (await getCurrentContext())!;
  const { filter: raw } = await searchParams;
  const filter: Filter = raw === "all" || raw === "archived" ? raw : "active";
  const projects = await listProjects(ctx.organization.id, filter);

  const filters: { key: Filter; label: string }[] = [
    { key: "active", label: t("filterActive") },
    { key: "all", label: t("filterAll") },
    { key: "archived", label: t("filterArchived") },
  ];

  return (
    <PageBody>
      <PageHeader
        title={t("title")}
        description={t("subtitle")}
        actions={
          <Link href="/projects/new">
            <Button>
              <Plus className="size-4" /> {t("new")}
            </Button>
          </Link>
        }
      />

      <div className="mt-8 inline-flex h-9 items-center rounded-full border border-border bg-surface p-0.5">
        {filters.map((f) => (
          <Link
            key={f.key}
            href={{ pathname: "/projects", query: f.key === "active" ? undefined : { filter: f.key } }}
            className={cn(
              "h-8 px-4 rounded-full text-[13px] font-medium inline-flex items-center transition-colors",
              filter === f.key ? "bg-white/10 text-fg" : "text-fg-muted hover:text-fg",
            )}
          >
            {f.label}
          </Link>
        ))}
      </div>

      {projects.length === 0 ? (
        <Card className="mt-6 p-10 text-center text-fg-muted">{t("emptyFiltered")}</Card>
      ) : (
        <div className="mt-6 grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {projects.map((p) => (
            <ProjectCard key={p.id} project={p} />
          ))}
        </div>
      )}
    </PageBody>
  );
}
