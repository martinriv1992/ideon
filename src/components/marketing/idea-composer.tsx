"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ArrowRight, Sparkles } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { clearPendingFiles, savePendingFiles, savePendingIdea } from "@/features/projects/pending-idea";
import { AttachmentPicker } from "@/components/app/attachment-picker";
import { PROJECT_KINDS } from "@/features/projects/kinds";
import { cn } from "@/lib/utils";

const MAX = 2000;

export function IdeaComposer({ isAuthenticated }: { isAuthenticated: boolean }) {
  const t = useTranslations("hero");
  const locale = useLocale();
  const router = useRouter();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [kind, setKind] = useState<string>("web");
  const [files, setFiles] = useState<File[]>([]);

  // «Crear algo así» desde la página de ejemplos: ?kind=crm&idea=… rellena el compositor.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const k = q.get("kind"); const i = q.get("idea");
    if (k && (PROJECT_KINDS as readonly string[]).includes(k)) setKind(k);
    if (i) { setValue(i.slice(0, MAX)); requestAnimationFrame(() => textareaRef.current && autoGrow(textareaRef.current)); }
  }, []);
  const tk = useTranslations("app.workspace.kinds");
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

  async function submit() {
    const idea = value.trim();
    if (idea.length < 10) {
      setError(t("errorEmpty"));
      return;
    }
    setSubmitting(true);
    savePendingIdea(idea, locale, kind);
    // Los adjuntos esperan en el navegador hasta que exista el proyecto.
    await (files.length ? savePendingFiles(files) : clearPendingFiles());
    router.push(
      isAuthenticated ? "/projects/new" : { pathname: "/register", query: { next: "/projects/new" } },
    );
  }

  return (
    <div id="start" className="w-full max-w-3xl mx-auto scroll-mt-28">
      <div className="mb-3 flex flex-wrap justify-center gap-1.5" role="group" aria-label={t("kindLabel")}>
        {PROJECT_KINDS.map((k) => (
          <button key={k} type="button" onClick={() => setKind(k)} aria-pressed={kind === k}
            className={cn("h-8 px-3 rounded-full border text-[12.5px] font-medium transition-colors", kind === k ? "bg-accent-soft text-accent border-accent/40" : "bg-surface text-fg-muted border-border hover:text-fg hover:border-border-strong")}>
            {tk(k)}
          </button>
        ))}
      </div>
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
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") void submit();
          }}
          placeholder={t("placeholder")}
          className="w-full bg-transparent resize-none outline-none px-5 pt-5 pb-2 text-[15px] sm:text-base leading-relaxed text-fg placeholder:text-fg-subtle min-h-[112px]"
        />
        <div className="flex items-end justify-between gap-3 px-3 pb-3">
          <div className="flex flex-col gap-1.5 pl-1 min-w-0">
            <AttachmentPicker files={files} onChange={setFiles} compact />
            <span className="pl-1 text-[12px] tabular-nums text-fg-subtle">
              {t("charCount", { count: value.length, max: MAX })}
            </span>
          </div>
          <Button size="lg" onClick={() => void submit()} loading={submitting} className="group">
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
              data-prompt={ex.prompt}
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
