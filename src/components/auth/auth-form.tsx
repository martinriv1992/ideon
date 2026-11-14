"use client";

import { useActionState, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { MailCheck, Lightbulb } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { FieldError, Input, Label } from "@/components/ui/input";
import type { AuthState } from "@/features/auth/actions";
import { readPendingIdea } from "@/features/projects/pending-idea";
import { GoogleButton } from "./google-button";
import { Turnstile } from "./turnstile";

type Mode = "login" | "register" | "forgot" | "reset";

interface Props {
  mode: Mode;
  action: (prev: AuthState, formData: FormData) => Promise<AuthState>;
  next?: string;
  configured: boolean;
  /** Inicio de sesión con Google activado en Supabase. */
  google?: boolean;
}

export function AuthForm({ mode, action, next, configured, google = false }: Props) {
  const t = useTranslations("auth");
  const locale = useLocale();
  const [state, formAction, pending] = useActionState(action, {} as AuthState);
  const [pendingIdea, setPendingIdea] = useState<string | null>(null);
  const hasPendingIdea = Boolean(pendingIdea);

  useEffect(() => {
    if (mode === "register" || mode === "login") setPendingIdea(readPendingIdea()?.idea ?? null);
  }, [mode]);

  const titles: Record<Mode, [string, string]> = {
    login: [t("loginTitle"), t("loginSubtitle")],
    register: [t("registerTitle"), t("registerSubtitle")],
    forgot: [t("forgotTitle"), t("forgotSubtitle")],
    reset: [t("resetTitle"), t("resetSubtitle")],
  };
  // Si viene del primer prompt de la portada, dejamos claro que hace falta una cuenta (gratis) para crear el proyecto.
  const fromPrompt = hasPendingIdea && (mode === "register" || mode === "login");
  const [title, subtitle] = fromPrompt
    ? [mode === "register" ? t("freeTitle") : t("freeLoginTitle"), t("freeSteps")]
    : titles[mode];

  const errorText = (key?: string) => {
    if (!key) return null;
    if (key === "notConfigured") return t("notConfigured");
    return t.has(`errors.${key}`) ? t(`errors.${key}`) : t("errors.generic");
  };

  if (state.success === "checkEmail") {
    return (
      <div className="text-center">
        <div className="mx-auto size-12 rounded-full bg-accent-soft text-accent flex items-center justify-center">
          <MailCheck className="size-6" />
        </div>
        <h1 className="mt-5 text-2xl font-semibold tracking-tight">{t("checkEmail")}</h1>
        <p className="mt-2 text-[15px] text-fg-muted">
          {t("checkEmailText", { email: state.email ?? "" })}
        </p>
        <Link href="/login" className="inline-block mt-8 text-sm text-accent hover:underline">
          {t("backToLogin")}
        </Link>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-2 text-[15px] text-fg-muted">{subtitle}</p>

      {fromPrompt && (
        <div className="mt-6 rounded-[12px] border border-accent/30 bg-accent-soft p-3.5 text-[13px] text-fg space-y-1.5">
          <p className="flex gap-2 font-medium"><Lightbulb className="size-4 mt-0.5 shrink-0 text-accent" />{mode === "login" ? t("pendingIdeaLogin") : t("pendingIdea")}</p>
          <p className="text-fg-muted line-clamp-2 italic">«{pendingIdea}»</p>
          <p>
            {mode === "register" ? t("freeHasAccount") : t("freeNoAccount")}{" "}
            <Link href={{ pathname: mode === "register" ? "/login" : "/register", query: next ? { next } : undefined }} className="font-medium text-accent hover:underline">
              {mode === "register" ? t("login") : t("register")}
            </Link>
          </p>
        </div>
      )}

      {!configured && (
        <div className="mt-6 rounded-[12px] border border-warning/30 bg-warning/10 p-3.5 text-[13px] text-warning">
          {t("notConfigured")}
        </div>
      )}

      {google && configured && (mode === "login" || mode === "register") && (
        <div className="mt-8"><GoogleButton next={next} /></div>
      )}

      <form action={formAction} className={google && configured && (mode === "login" || mode === "register") ? "space-y-5" : "mt-8 space-y-5"} noValidate>
        {next && <input type="hidden" name="next" value={next} />}
        <input type="hidden" name="locale" value={locale} />

        {mode === "register" && (
          <div>
            <Label htmlFor="fullName">{t("fullName")}</Label>
            <Input id="fullName" name="fullName" autoComplete="name" required />
            <FieldError>{errorText(state.fieldErrors?.fullName)}</FieldError>
          </div>
        )}

        {mode !== "reset" && (
          <div>
            <Label htmlFor="email">{t("email")}</Label>
            <Input id="email" name="email" type="email" autoComplete="email" inputMode="email" required />
            <FieldError>{errorText(state.fieldErrors?.email)}</FieldError>
          </div>
        )}

        {mode !== "forgot" && (
          <div>
            <div className="flex items-center justify-between">
              <Label htmlFor="password">{t("password")}</Label>
              {mode === "login" && (
                <Link href="/forgot-password" className="text-[13px] text-fg-muted hover:text-fg mb-1.5">
                  {t("forgot")}
                </Link>
              )}
            </div>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              minLength={8}
              required
            />
            {mode !== "login" && !state.fieldErrors?.password && (
              <p className="mt-1.5 text-[13px] text-fg-subtle">{t("passwordHint")}</p>
            )}
            <FieldError>{errorText(state.fieldErrors?.password)}</FieldError>
          </div>
        )}

        {state.error && state.error !== "notConfigured" && (
          <p className="text-[13px] text-danger" role="alert">
            {errorText(state.error)}
          </p>
        )}

        {state.success === "resetSent" && (
          <p className="text-[13px] text-success" role="status">
            {t("resetSent")}
          </p>
        )}

        {mode !== "reset" && <Turnstile resetKey={state} locale={locale} />}

        <Button type="submit" size="lg" className="w-full" loading={pending} disabled={!configured}>
          {mode === "login" && t("login")}
          {mode === "register" && t("register")}
          {mode === "forgot" && t("sendLink")}
          {mode === "reset" && t("savePassword")}
        </Button>

        {mode === "register" && <p className="text-[12px] text-fg-subtle leading-relaxed">{t("terms")}</p>}
      </form>

      <p className="mt-8 text-[14px] text-fg-muted text-center">
        {mode === "login" && (
          <>
            {t("noAccount")}{" "}
            <Link href={{ pathname: "/register", query: next ? { next } : undefined }} className="text-fg hover:text-accent font-medium">
              {t("register")}
            </Link>
          </>
        )}
        {mode === "register" && (
          <>
            {t("hasAccount")}{" "}
            <Link href={{ pathname: "/login", query: next ? { next } : undefined }} className="text-fg hover:text-accent font-medium">
              {t("login")}
            </Link>
          </>
        )}
        {(mode === "forgot" || mode === "reset") && (
          <Link href="/login" className="text-fg hover:text-accent font-medium">
            {t("backToLogin")}
          </Link>
        )}
      </p>
    </div>
  );
}
