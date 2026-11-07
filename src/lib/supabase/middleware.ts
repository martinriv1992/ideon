import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isSupabaseConfigured, requireSupabaseEnv } from "@/lib/env";

/**
 * Refresca la sesión de Supabase en cada petición y devuelve el usuario.
 * Debe ejecutarse antes de cualquier redirección para que las cookies
 * renovadas lleguen al navegador.
 */
export async function updateSession(request: NextRequest, response: NextResponse) {
  if (!isSupabaseConfigured) return { response, user: null };

  const { url, anonKey } = requireSupabaseEnv();
  let supabaseResponse = response;

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        supabaseResponse = NextResponse.next({ request });
        // Conservar cabeceras que next-intl haya añadido (p. ej. x-next-intl-locale)
        response.headers.forEach((v, k) => supabaseResponse.headers.set(k, v));
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options),
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { response: supabaseResponse, user };
}
