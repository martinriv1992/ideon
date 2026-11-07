import { getTranslations } from "next-intl/server";
import { Construction } from "lucide-react";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { Badge, Card } from "@/components/ui/card";

/**
 * Módulos del área de cliente cuya lógica llega en fases posteriores.
 * Se muestran con su estado real (no disponible) en lugar de simular datos.
 */
export type Module = "proposals" | "files" | "billing" | "subscriptions" | "support";

export async function ModulePlaceholder({ module: key }: { module: Module }) {
  const t = await getTranslations("app.placeholder");

  return (
    <PageBody>
      <PageHeader title={t(`${key}.title`)} />
      <Card className="mt-8 p-10 text-center max-w-xl mx-auto">
        <div className="mx-auto size-12 rounded-full bg-white/5 text-fg-muted flex items-center justify-center">
          <Construction className="size-5" />
        </div>
        <Badge className="mt-5">{t("notAvailable")}</Badge>
        <p className="mt-4 text-[15px] text-fg-muted leading-relaxed">{t(`${key}.text`)}</p>
      </Card>
    </PageBody>
  );
}
