import { getTranslations } from "next-intl/server";
import { getCurrentContext } from "@/features/organizations/queries";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { SettingsForm } from "@/components/app/settings-form";

export default async function SettingsPage() {
  const t = await getTranslations("app.settings");
  const ctx = (await getCurrentContext())!;
  return (
    <PageBody className="max-w-3xl">
      <PageHeader title={t("title")} />
      <div className="mt-8">
        <SettingsForm
          fullName={ctx.profile.full_name ?? ""}
          email={ctx.user.email ?? ""}
          locale={ctx.profile.locale}
          orgName={ctx.organization.name}
          role={ctx.role}
          canEditOrg={ctx.role === "owner" || ctx.role === "admin"}
        />
      </div>
    </PageBody>
  );
}
