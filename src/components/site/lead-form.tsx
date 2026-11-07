"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { CalendarClock, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { BUDGETS, SOLUTIONS, TIMEFRAMES, leadSchema } from "@/features/leads/schema";
import { getAttribution, track } from "@/lib/analytics";
import { cn } from "@/lib/utils";

type Fields = { fullName: string; company: string; email: string; country: string; website: string; solution: string; problem: string; budget: string; timeframe: string; consent: boolean; wantsMeeting: boolean };

const BOOKING_URL = process.env.NEXT_PUBLIC_BOOKING_URL;

/** Formulario comercial: validación en cliente y servidor, antispam y origen de campaña. */
export function LeadForm({ initialSolution, wantsMeeting: initialMeeting }: { initialSolution?: string; wantsMeeting?: boolean }) {
  const t = useTranslations("site.lead");
  const locale = useLocale();
  const [f, setF] = useState<Fields>({
    fullName: "", company: "", email: "", country: locale === "en" ? "" : "Colombia", website: "",
    solution: (SOLUTIONS as readonly string[]).includes(initialSolution ?? "") ? initialSolution! : "", problem: "", budget: "", timeframe: "",
    consent: false, wantsMeeting: Boolean(initialMeeting),
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState<{ email: string; meeting: boolean } | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const openedAt = useRef(Date.now());
  const started = useRef(false);
  const hp = useRef<HTMLInputElement>(null);

  useEffect(() => { openedAt.current = Date.now(); }, []);
  const set = <K extends keyof Fields>(k: K, v: Fields[K]) => {
    if (!started.current) { started.current = true; track("lead_form_started", { locale }); }
    setF((x) => ({ ...x, [k]: v }));
    if (errors[k]) setErrors((e) => { const n = { ...e }; delete n[k]; return n; });
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    const payload = {
      ...f, website: f.website || undefined, budget: f.budget || undefined, locale,
      attribution: getAttribution(), hp: hp.current?.value ?? "", elapsedMs: Date.now() - openedAt.current,
    };
    const check = leadSchema.safeParse(payload);
    if (!check.success) {
      setErrors(Object.fromEntries(check.error.issues.map((i) => [String(i.path[0]), i.message])));
      return;
    }
    setSending(true);
    try {
      const res = await fetch("/api/leads", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (body?.error?.fields) setErrors(body.error.fields);
        setFormError(t(`errors.${body?.error?.message === "too_many" ? "too_many" : "generic"}`));
        return;
      }
      track("lead_form_submitted", { solution: f.solution, locale, meeting: f.wantsMeeting });
      setDone({ email: f.email, meeting: f.wantsMeeting });
    } catch { setFormError(t("errors.generic")); }
    finally { setSending(false); }
  }

  if (done) {
    return (
      <div className="rounded-[18px] border border-success/40 bg-surface p-7" role="status">
        <CheckCircle2 className="size-7 text-success" aria-hidden />
        <h2 className="mt-3 text-xl font-semibold">{t("successTitle")}</h2>
        <p className="mt-2 text-[15px] text-fg-muted">{t("successText", { email: done.email })}</p>
        {done.meeting && (BOOKING_URL ? (
          <div className="mt-5">
            <p className="text-[14px]">{t("successMeeting")}</p>
            <a href={BOOKING_URL} target="_blank" rel="noreferrer" data-track="meeting_cta_clicked" data-track-label="lead_success"
              className="mt-3 inline-flex items-center gap-2 h-11 px-5 rounded-[12px] bg-fg text-bg text-[14.5px] font-medium hover:opacity-90"><CalendarClock className="size-4" aria-hidden /> {t("successMeeting").replace(/:$/, "")}</a>
          </div>
        ) : <p className="mt-4 text-[14px] text-fg-muted">{t("successMeetingPending")}</p>)}
        <button type="button" onClick={() => { setDone(null); setF((x) => ({ ...x, problem: "" })); openedAt.current = Date.now(); }} className="mt-6 text-[13px] text-fg-subtle hover:text-fg underline">{t("another")}</button>
      </div>
    );
  }

  const err = (k: string) => (errors[k] ? <p className="mt-1 text-[12.5px] text-danger" id={`${k}-err`}>{t.has(`errors.${errors[k]}`) ? t(`errors.${errors[k]}`) : t("errors.generic")}</p> : null);
  const aria = (k: string) => ({ "aria-invalid": Boolean(errors[k]) || undefined, "aria-describedby": errors[k] ? `${k}-err` : undefined });
  const selectCls = (k: string) => cn("h-11 w-full rounded-[10px] border bg-surface px-3 text-[14px] text-fg", errors[k] ? "border-danger" : "border-border");

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      {/* Campo trampa para bots (invisible para personas y lectores de pantalla). */}
      <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden"><label>Website URL<input ref={hp} type="text" name="company_url" tabIndex={-1} autoComplete="off" /></label></div>
      <div className="grid sm:grid-cols-2 gap-4">
        <div><Label htmlFor="fullName">{t("fullName")}</Label><Input id="fullName" autoComplete="name" value={f.fullName} onChange={(e) => set("fullName", e.target.value)} {...aria("fullName")} />{err("fullName")}</div>
        <div><Label htmlFor="company">{t("company")}</Label><Input id="company" autoComplete="organization" value={f.company} onChange={(e) => set("company", e.target.value)} {...aria("company")} />{err("company")}</div>
        <div><Label htmlFor="email">{t("email")}</Label><Input id="email" type="email" autoComplete="email" value={f.email} onChange={(e) => set("email", e.target.value)} {...aria("email")} />{err("email")}</div>
        <div><Label htmlFor="country">{t("country")}</Label><Input id="country" autoComplete="country-name" value={f.country} onChange={(e) => set("country", e.target.value)} {...aria("country")} />{err("country")}</div>
        <div><Label htmlFor="website">{t("website")}</Label><Input id="website" type="url" inputMode="url" autoComplete="url" placeholder="https://" value={f.website} onChange={(e) => set("website", e.target.value)} {...aria("website")} />{err("website")}</div>
        <div>
          <Label htmlFor="solution">{t("solution")}</Label>
          <select id="solution" className={selectCls("solution")} value={f.solution} onChange={(e) => set("solution", e.target.value)} {...aria("solution")}>
            <option value="">{t("choose")}</option>
            {SOLUTIONS.map((s) => <option key={s} value={s}>{t(`solutions.${s}`)}</option>)}
          </select>{err("solution")}
        </div>
      </div>
      <div>
        <Label htmlFor="problem">{t("problem")}</Label>
        <Textarea id="problem" rows={5} maxLength={4000} value={f.problem} onChange={(e) => set("problem", e.target.value)} placeholder={t("problemHint")} {...aria("problem")} />
        {err("problem")}
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="budget">{t("budget")}</Label>
          <select id="budget" className={selectCls("budget")} value={f.budget} onChange={(e) => set("budget", e.target.value)}>
            <option value="">{t("choose")}</option>
            {BUDGETS.map((s) => <option key={s} value={s}>{t(`budgets.${s}`)}</option>)}
          </select>
        </div>
        <div>
          <Label htmlFor="timeframe">{t("timeframe")}</Label>
          <select id="timeframe" className={selectCls("timeframe")} value={f.timeframe} onChange={(e) => set("timeframe", e.target.value)} {...aria("timeframe")}>
            <option value="">{t("choose")}</option>
            {TIMEFRAMES.map((s) => <option key={s} value={s}>{t(`timeframes.${s}`)}</option>)}
          </select>{err("timeframe")}
        </div>
      </div>
      <label className="flex items-start gap-2.5 text-[14px]">
        <input type="checkbox" className="mt-1" checked={f.wantsMeeting} onChange={(e) => set("wantsMeeting", e.target.checked)} />
        <span>{t("wantsMeeting")}</span>
      </label>
      <div>
        <label className="flex items-start gap-2.5 text-[13.5px] text-fg-muted">
          <input type="checkbox" className="mt-1" checked={f.consent} onChange={(e) => set("consent", e.target.checked)} {...aria("consent")} />
          <span>{t.rich("consent", { privacy: () => <a href={`/${locale}/privacy`} target="_blank" rel="noreferrer" className="text-accent underline">{t("privacy")}</a> })}</span>
        </label>
        {err("consent")}
      </div>
      {formError && <p className="text-[13.5px] text-danger" role="alert">{formError}</p>}
      <Button type="submit" size="lg" loading={sending} className="w-full sm:w-auto">{sending ? t("sending") : t("submit")}</Button>
    </form>
  );
}
