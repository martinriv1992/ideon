import { AuthForm } from "@/components/auth/auth-form";
import { forgotPasswordAction } from "@/features/auth/actions";
import { isSupabaseConfigured } from "@/lib/env";

export default function ForgotPasswordPage() {
  return <AuthForm mode="forgot" action={forgotPasswordAction} configured={isSupabaseConfigured} />;
}
