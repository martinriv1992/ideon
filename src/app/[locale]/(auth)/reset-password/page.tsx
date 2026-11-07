import { AuthForm } from "@/components/auth/auth-form";
import { resetPasswordAction } from "@/features/auth/actions";
import { isSupabaseConfigured } from "@/lib/env";

export default function ResetPasswordPage() {
  return <AuthForm mode="reset" action={resetPasswordAction} configured={isSupabaseConfigured} />;
}
