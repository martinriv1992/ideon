import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/card";
import type { ProjectStatus } from "@/types/database.types";

const TONES: Record<ProjectStatus, "neutral" | "accent" | "success" | "warning" | "danger" | "info"> = {
  draft: "neutral",
  discovery: "accent",
  specification: "accent",
  proposal: "info",
  approved: "info",
  in_development: "warning",
  review: "warning",
  ready_to_deploy: "success",
  live: "success",
  maintenance: "success",
  on_hold: "neutral",
  cancelled: "danger",
};

export function StatusBadge({ status }: { status: ProjectStatus }) {
  const t = useTranslations("app.status");
  return <Badge tone={TONES[status]}>{t(status)}</Badge>;
}
