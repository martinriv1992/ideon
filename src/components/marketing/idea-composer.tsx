"use client";

import { useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ArrowRight, Sparkles } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { savePendingIdea } from "@/features/projects/pending-idea";
import { cn } from "@/lib/utils";

const MAX = 2000;

export function IdeaComposer({ isAuthenticated }: { isAuthenticated: boolean }) {
  const t = useTranslations("hero");
  const locale = useLocale();
  const router = useRouter();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const examples = t.raw("examples") as { title: string; prompt: string }[];

  function autoGrow(el: HTMLTextAreaElement) {
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 320)}px`;
  }

  function pickExample(prompt: string) {
    setValue(prompt);
    setError(null);
    requestAnimationFrame(() => {
      if (textareaRef.current) {
        autoGrow(textareaRef.current);
        textareaRef.current.focus();
      }
    });
  }

  function submit() {
    const idea = value.trim();
    if (idea.length < 10) {
      setError(t("errorEmpty"));
      return;
    }
    setSubmitting(true);
    savePendingIdea(idea, locale);
    router.push(
      isAuthenticated ? "/projects/new" : { pathname: "/register", query: { next: "/projects/new" } },
    );
  }

  return (
    <div id="start" className="w-full max-w-3xl mx-auto scroll-mt-28">
      <div
        className={cn(
          "relative rounded-[20px] border bg-surface/80 backdrop-blur transition-[border-color,box-shadow] duration-300",
          error ? "border-danger/50" : "border-border-strong focus-within:border-accent/60 focus-within:glow-accent",
        )}
      >
        <div className="absolute -inset-px rounded-[20px] bg-accent-gradient opacity-0 blur-xl transition-opacity duration-500 pointer-events-none [.group:focus-within_&]:opacity-20" />
        <label htmlFor="idea" className="sr-only">
          {t("placeholder")}
        </label>
        <textarea
          id="idea"
          ref={textareaRef}
          value={value}
          maxLength={MAX}
          rows={3}
          onChange={(e) => {
            setValue(e.target.value);
            if (error) setError(null);
            autoGrow(e.target);
          }}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") submit();
          }}
          placeholder={t("placeholder")}
          className="w-full bg-transparent resize-none outline-none px-5 pt-5 pb-2 text-[15px] sm:text-base leading-relaxed text-fg placeholder:text-fg-subtle min-h-[112px]"
        />
        <div className="flex items-center justify-between gap-3 px-3 pb-3">
          <span className="pl-2 text-[12px] tabular-nums text-fg-subtle">
            {t("charCount", { count: value.length, max: MAX })}
          </span>
          <Button size="lg" onClick={submit} loading={submitting} className="group">
            {t("cta")}
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
          </Button>
        </div>
      </div>
      {error ? (
        <p className="mt-3 text-[13px] text-danger text-center" role="alert">
          {error}
        </p>
      ) : (
        <p className="mt-3 text-[13px] text-fg-subtle text-center">{t("hint")}</p>
      )}

      <div className="mt-8">
        <p className="text-[12px] uppercase tracking-wide text-fg-subtle text-center mb-3">
          {t("examplesLabel")}
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          {examples.map((ex) => (
            <button
              key={ex.title}
              type="button"
              onClick={() => pickExample(ex.prompt)}
              className="inline-flex items-center gap-2 h-9 px-3.5 rounded-full border border-border bg-surface text-[13px] text-fg-muted hover:text-fg hover:border-border-strong hover:bg-surface-hover transition-colors"
            >
              <Sparkles className="size-3.5 text-accent" aria-hidden />
              {ex.title}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
