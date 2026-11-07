import { useTranslations } from "next-intl";
import { ArrowRight } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "./status-badge";
import { RelativeTime } from "@/components/ui/relative-time";
import type { Project } from "@/types/database.types";

export function ProjectCard({ project }: { project: Project }) {
  const t = useTranslations("app.projects");
  return (
    <Link href={`/projects/${project.id}`} className="block group">
      <Card hover className="h-full p-5 flex flex-col">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-[15px] font-medium text-fg leading-snug line-clamp-2">{project.name}</h3>
          <StatusBadge status={project.status} />
        </div>
        <p className="mt-3 text-[13px] text-fg-muted leading-relaxed line-clamp-3 flex-1">{project.initial_idea}</p>
        <div className="mt-4 flex items-center justify-between text-[12px] text-fg-subtle">
          <span>{t.rich("updated", { date: () => <RelativeTime value={project.updated_at} /> })}</span>
          <span className="inline-flex items-center gap-1 text-fg-muted group-hover:text-accent transition-colors">
            {t("open")} <ArrowRight className="size-3.5" />
          </span>
        </div>
      </Card>
    </Link>
  );
}
