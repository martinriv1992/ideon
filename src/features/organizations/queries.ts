import { cache } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { slugify } from "@/lib/utils";
import type { Organization, OrgRole, Profile } from "@/types/database.types";

export interface CurrentContext {
  user: User;
  profile: Profile;
  organization: Organization;
  role: OrgRole;
}

/**
 * Contexto del usuario autenticado: perfil + organización activa + rol.
 * Si el usuario no pertenece a ninguna organización se crea su organización
 * personal (idempotente). Cacheado por petición.
 */
export const getCurrentContext = cache(async (): Promise<CurrentContext | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  let { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();

  // El trigger crea el perfil al registrarse; por robustez lo creamos si falta.
  if (!profile) {
    const { data: created, error } = await supabase
      .from("profiles")
      .insert({
        id: user.id,
        full_name: (user.user_metadata?.full_name as string | undefined) ?? user.email?.split("@")[0] ?? null,
        locale: (user.user_metadata?.locale as string | undefined) ?? "es",
      })
      .select("*")
      .single();
    if (error || !created) throw new Error(`No se pudo crear el perfil: ${error?.message}`);
    profile = created;
  }

  const { data: memberships } = await supabase
    .from("organization_members")
    .select("role, organizations(*)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1);

  const membership = memberships?.[0];
  if (membership?.organizations) {
    return {
      user,
      profile,
      organization: membership.organizations as unknown as Organization,
      role: membership.role,
    };
  }

  // Crear organización personal
  const baseName = profile.full_name || user.email?.split("@")[0] || "workspace";
  const slug = `${slugify(baseName) || "workspace"}-${user.id.slice(0, 8)}`;
  const { data: org, error: orgError } = await supabase
    .from("organizations")
    .insert({ name: baseName, slug, type: "personal", created_by: user.id, billing_email: user.email ?? null })
    .select("*")
    .single();
  if (orgError || !org) throw new Error(`No se pudo crear la organización: ${orgError?.message}`);

  return { user, profile, organization: org, role: "owner" };
});
