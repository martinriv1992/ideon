import "server-only";
import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { getCurrentContext } from "@/features/organizations/queries";
import { createAdminClient } from "@/lib/supabase/admin";

/** Solo administradores de la plataforma (profiles.is_platform_admin). Devuelve un cliente service_role. */
export async function requirePlatformAdmin() {
  const ctx = await getCurrentContext();
  const locale = await getLocale();
  if (!ctx) redirect({ href: "/login", locale });
  if (!ctx!.profile.is_platform_admin) redirect({ href: "/dashboard", locale });
  return { ctx: ctx!, db: createAdminClient() };
}
