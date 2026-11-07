import { AuthForm } from "@/components/auth/auth-form";
import { loginAction } from "@/features/auth/actions";
import { safeNext } from "@/features/auth/schemas";
import { isSupabaseConfigured } from "@/lib/env";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  return (
    <AuthForm
      mode="login"
      action={loginAction}
      next={safeNext(next)}
      configured={isSupabaseConfigured}
    />
  );
}
