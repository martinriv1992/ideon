import { getTranslations } from "next-intl/server";
import { AuthForm } from "@/components/auth/auth-form";
import { loginAction } from "@/features/auth/actions";
import { safeNext } from "@/features/auth/schemas";
import { isSupabaseConfigured } from "@/lib/env";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;
  const t = await getTranslations("auth");
  // Enlace de correo inválido o caducado (confirmación o recuperación de contraseña).
  const linkError = error === "auth_link" || error === "auth_callback";
  return (
    <>
      {linkError && (
        <p role="alert" className="mb-4 rounded-[12px] border border-warning/40 bg-warning/10 px-4 py-3 text-[13px] leading-relaxed">
          {t("linkInvalid")}
        </p>
      )}
      <AuthForm
        mode="login"
        action={loginAction}
        next={safeNext(next)}
        configured={isSupabaseConfigured}
      />
    </>
  );
}
