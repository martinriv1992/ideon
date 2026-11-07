"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Briefcase, Lightbulb } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FieldError, Input, Label, Textarea } from "@/components/ui/input";
import { createProjectAction, type ActionState } from "@/features/projects/actions";
import { clearPendingFiles, clearPendingIdea, readPendingFiles, readPendingIdea } from "@/features/projects/pending-idea";
import { AttachmentPicker } from "@/components/app/attachment-picker";
import { uploadToProject } from "@/lib/upload-client";
import { useRouter } from "@/i18n/navigation";
import { PROJECT_KINDS } from "@/features/projects/kinds";
import { cn } from "@/lib/utils";
import { PACKAGES, getPackage } from "@/features/packages/catalog";
import { money } from "@/lib/money";

export function NewProjectForm({ initialPackage = null }: { initialPackage?: string | null }) {
  const t = useTranslations("app.newProject");
  const locale = useLocale();
  const [pkgKey, setPkgKey] = useState<string | null>(getPackage(initialPackage)?.key ?? null);
  const pkg = getPackage(pkgKey);
  const tHero = useTranslations("hero");
  const [state, formAction, pending] = useActionState(createProjectAction, {} as ActionState);
  const [idea, setIdea] = useState("");
  const [kind, setKind] = useState("web");
  const tk = useTranslations("app.workspace.kinds");
  const [restored, setRestored] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [uploadErrors, setUploadErrors] = useState<string[]>([]);
  const router = useRouter();
  const uploadedFor = useRef<string | null>(null);

  useEffect(() => {
    const pendingIdea = readPendingIdea();
    if (pendingIdea) {
      setIdea(pendingIdea.idea);
      if (pendingIdea.kind) setKind(pendingIdea.kind);
      setRestored(true);
    }
    void readPendingFiles().then((f) => { if (f.length) { setFiles(f); setRestored(true); } });
  }, []);

  useEffect(() => {
    if (state.ok) clearPendingIdea();
  }, [state.ok]);

  // Proyecto creado con adjuntos: se suben antes de abrirlo para que el consultor los vea desde el principio.
  useEffect(() => {
    const projectId = state.projectId;
    if (!projectId || uploadedFor.current === projectId) return;
    uploadedFor.current = projectId;
    void (async () => {
      const errors: string[] = [];
      for (const [i, f] of files.entries()) {
        setUploadStatus(t("uploading", { n: i + 1, total: files.length }));
        try { await uploadToProject(projectId, f); } catch (e) { errors.push(`${f.name}: ${e instanceof Error ? e.message : "error"}`); }
      }
      await clearPendingFiles();
      if (errors.length) { setUploadErrors(errors); setUploadStatus(null); setTimeout(() => router.push(`/projects/${projectId}`), 4000); }
      else router.push(`/projects/${projectId}`);
    })();
  }, [state.projectId, files, router, t]);

  return (
    <form
      action={(fd) => {
        clearPendingIdea();
        formAction(fd);
      }}
      className="space-y-6"
    >
      {restored && (
        <div className="flex gap-3 rounded-[12px] border border-accent/30 bg-accent-soft p-3.5 text-[13px]">
          <Lightbulb className="size-4 mt-0.5 shrink-0 text-accent" />
          <span>{t("restored")}</span>
        </div>
      )}

      <div>
        <Label>{t("packageLabel")}</Label>
        <input type="hidden" name="package" value={pkg?.key ?? ""} />
        <div className="grid sm:grid-cols-2 gap-2" role="group">
          <button type="button" onClick={() => setPkgKey(null)} aria-pressed={!pkg}
            className={cn("rounded-[12px] border p-3 text-left transition-colors", !pkg ? "border-accent bg-accent-soft" : "border-border bg-surface hover:border-border-strong")}>
            <span className="block text-[13.5px] font-medium">{t("customOption")}</span>
            <span className="block text-[12px] text-fg-muted mt-0.5">{t("customOptionHint")}</span>
          </button>
          {PACKAGES.map((p) => (
            <button key={p.key} type="button" onClick={() => { setPkgKey(p.key); setKind(p.kind); }} aria-pressed={pkg?.key === p.key}
              className={cn("rounded-[12px] border p-3 text-left transition-colors", pkg?.key === p.key ? "border-accent bg-accent-soft" : "border-border bg-surface hover:border-border-strong")}>
              <span className="flex items-center justify-between gap-2 text-[13.5px] font-medium"><span className="inline-flex items-center gap-1.5"><Briefcase className="size-3.5 text-accent" />{p.name}</span><span className="tabular-nums text-fg-muted text-[12px]">{money(p.price, p.currency, locale)}</span></span>
              <span className="block text-[12px] text-fg-muted mt-0.5">{locale === "en" ? p.tagline.en : p.tagline.es}</span>
            </button>
          ))}
        </div>
        {pkg && (
          <ul className="mt-2 grid sm:grid-cols-2 gap-x-4 gap-y-1 text-[12.5px] text-fg-muted">
            {pkg.modules.map((m) => <li key={m.es}>✓ {locale === "en" ? m.en : m.es}</li>)}
          </ul>
        )}
      </div>

      <div className={cn(pkg && "hidden")}>
        <Label>{t("kindLabel")}</Label>
        <input type="hidden" name="kind" value={pkg ? pkg.kind : kind} />
        <div className="flex flex-wrap gap-1.5" role="group">
          {PROJECT_KINDS.map((k) => (
            <button key={k} type="button" onClick={() => setKind(k)} aria-pressed={kind === k}
              className={cn("h-8 px-3 rounded-full border text-[12.5px] font-medium transition-colors", kind === k ? "bg-accent-soft text-accent border-accent/40" : "bg-surface text-fg-muted border-border hover:text-fg hover:border-border-strong")}>
              {tk(k)}
            </button>
          ))}
        </div>
      </div>

      <div>
        <Label htmlFor="name">{t("nameLabel")}</Label>
        <Input id="name" name="name" placeholder={t("namePlaceholder")} maxLength={120} />
        <p className="mt-1.5 text-[13px] text-fg-subtle">{t("nameHint")}</p>
      </div>

      <div>
        <Label htmlFor="idea">{pkg ? t("ideaLabelPackage") : t("ideaLabel")}</Label>
        <Textarea
          id="idea"
          name="idea"
          rows={8}
          value={idea}
          onChange={(e) => setIdea(e.target.value)}
          placeholder={pkg ? t("ideaPlaceholderPackage") : t("ideaPlaceholder")}
          maxLength={8000}
          required
        />
        <div className="mt-1.5 flex justify-between text-[12px] text-fg-subtle">
          <FieldError>{state.fieldErrors?.idea ? tHero("errorEmpty") : null}</FieldError>
          <span className="tabular-nums ml-auto">{idea.length} / 8000</span>
        </div>
      </div>

      <div>
        <Label>{t("attachLabel")}</Label>
        <input type="hidden" name="hasAttachments" value={files.length ? "1" : "0"} />
        <AttachmentPicker files={files} onChange={setFiles} />
      </div>

      {state.error && (
        <p className="text-[13px] text-danger" role="alert">
          {state.error}
        </p>
      )}

      {uploadErrors.length > 0 && (
        <div className="text-[13px] text-danger" role="alert">
          <p>{t("uploadErrors")}</p>
          <ul className="mt-1 list-disc pl-5">{uploadErrors.map((e) => <li key={e}>{e}</li>)}</ul>
        </div>
      )}

      <Button type="submit" size="lg" loading={pending || Boolean(uploadStatus)} disabled={Boolean(state.projectId)}>
        {uploadStatus ?? t("submit")}
      </Button>
    </form>
  );
}
