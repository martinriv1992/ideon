"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { FileText, ImageIcon, Paperclip, X } from "lucide-react";
import { ASSET_ACCEPT, IMAGE_ACCEPT, MAX_UPLOAD_BYTES, classifyUpload } from "@/lib/uploads";
import { cn } from "@/lib/utils";

export const MAX_ATTACHMENTS = 10;

/** Botón de adjuntar fotos y documentos junto a la idea (homepage y nuevo proyecto). */
export function AttachmentPicker({ files, onChange, className, compact }: { files: File[]; onChange: (files: File[]) => void; className?: string; compact?: boolean }) {
  const t = useTranslations("attachments");
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  function add(list: FileList | null) {
    if (!list?.length) return;
    setError(null);
    const next = [...files];
    for (const f of Array.from(list)) {
      if (next.length >= MAX_ATTACHMENTS) { setError(t("tooMany", { max: MAX_ATTACHMENTS })); break; }
      if (!classifyUpload(f)) { setError(t("unsupported", { name: f.name })); continue; }
      if (f.size > MAX_UPLOAD_BYTES) { setError(t("tooLarge", { name: f.name })); continue; }
      if (!next.some((x) => x.name === f.name && x.size === f.size)) next.push(f);
    }
    onChange(next);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className={className}>
      <input ref={inputRef} type="file" multiple accept={`${IMAGE_ACCEPT},${ASSET_ACCEPT}`} className="hidden" onChange={(e) => add(e.target.files)} />
      <div className="flex flex-wrap items-center gap-1.5">
        <button type="button" onClick={() => inputRef.current?.click()} title={t("hint")}
          className={cn("inline-flex items-center gap-1.5 rounded-full border border-border bg-surface text-fg-muted hover:text-fg hover:border-border-strong transition-colors", compact ? "h-8 px-3 text-[12.5px]" : "h-9 px-3.5 text-[13px]")}>
          <Paperclip className="size-3.5" aria-hidden /> {t("button")}
        </button>
        {files.map((f, i) => (
          <span key={`${f.name}-${i}`} className="inline-flex items-center gap-1.5 h-8 max-w-[220px] pl-2.5 pr-1 rounded-full bg-surface-2 border border-border text-[12px]">
            {classifyUpload(f) === "image" ? <ImageIcon className="size-3.5 shrink-0 text-accent" aria-hidden /> : <FileText className="size-3.5 shrink-0 text-accent" aria-hidden />}
            <span className="truncate">{f.name}</span>
            <button type="button" onClick={() => onChange(files.filter((_, j) => j !== i))} aria-label={t("remove", { name: f.name })} className="size-6 rounded-full inline-flex items-center justify-center text-fg-subtle hover:text-fg hover:bg-surface-hover">
              <X className="size-3.5" />
            </button>
          </span>
        ))}
      </div>
      {error ? <p className="mt-1.5 text-[12px] text-danger" role="alert">{error}</p>
        : !files.length && !compact ? <p className="mt-1.5 text-[12px] text-fg-subtle">{t("hint")}</p> : null}
    </div>
  );
}
