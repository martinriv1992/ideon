import { AuthForm } from "@/components/auth/auth-form";
import { registerAction } from "@/features/auth/actions";
import { safeNext } from "@/features/auth/schemas";
import { isSupabaseConfigured } from "@/lib/env";

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  return (
    <AuthForm
      mode="register"
      action={registerAction}
      next={safeNext(next, "/projects/new")}
      configured={isSupabaseConfigured}
    />
  );
}
