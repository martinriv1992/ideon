import { connection } from "next/server";
import { redirect } from "@/i18n/navigation";
import { getLocale } from "next-intl/server";
import { isSupabaseConfigured } from "@/lib/env";
import { getCurrentContext } from "@/features/organizations/queries";
import { logoutAction } from "@/features/auth/actions";
import { AppSidebar } from "@/components/app/sidebar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // Área privada: siempre renderizada por petición (sesión por cookies).
  await connection();
  const locale = await getLocale();
  if (!isSupabaseConfigured) redirect({ href: "/login", locale });

  const ctx = await getCurrentContext();
  if (!ctx) redirect({ href: "/login", locale });

  return (
    <div className="min-h-dvh flex">
      <AppSidebar
        userName={ctx!.profile.full_name ?? ctx!.user.email ?? ""}
        orgName={ctx!.organization.name}
        isAdmin={ctx!.profile.is_platform_admin}
        logout={logoutAction}
      />
      <div className="flex-1 min-w-0 pt-14 lg:pt-0">{children}</div>
    </div>
  );
}
