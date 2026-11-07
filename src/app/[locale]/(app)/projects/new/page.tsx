import { getTranslations } from "next-intl/server";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { NewProjectForm } from "@/components/app/new-project-form";

export default async function NewProjectPage({ searchParams }: { searchParams: Promise<{ package?: string }> }) {
  const { package: pkg } = await searchParams;
  const t = await getTranslations("app.newProject");
  return (
    <PageBody className="max-w-3xl">
      <PageHeader title={t("title")} description={t("subtitle")} />
      <div className="mt-8">
        <NewProjectForm initialPackage={pkg ?? null} />
      </div>
    </PageBody>
  );
}
