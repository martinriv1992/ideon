import "server-only";
import { isSupabaseConfigured, publicEnv } from "@/lib/env";

/**
 * ¿Está activado el inicio de sesión con Google en Supabase Auth?
 * Se consulta la configuración pública de Auth (cacheada 5 min), así el botón
 * aparece solo cuando el proveedor está configurado, sin variables extra.
 */
export async function googleAuthEnabled(): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  try {
    const res = await fetch(`${publicEnv.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/settings`, {
      headers: { apikey: publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY as string },
      next: { revalidate: 300 },
    });
    if (!res.ok) return false;
    const body = (await res.json()) as { external?: { google?: boolean } };
    return Boolean(body.external?.google);
  } catch {
    return false;
  }
}
