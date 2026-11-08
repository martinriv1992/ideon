"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, MessageSquareWarning } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { approvePublishAction, rejectPublishAction } from "@/features/admin/actions";

/** Botones de la revisión: aprobar y publicar, o pedir cambios con una nota para el cliente. */
export function ReviewActions({ approvalId, labels }: { approvalId: string; labels: Record<"approve" | "changes" | "notePh" | "send" | "cancel" | "noteError" | "done", string> }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [mode, setMode] = useState<"idle" | "note">("idle");
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const run = (fn: () => Promise<{ ok?: boolean; error?: string }>) => start(async () => {
    setMsg(null);
    const r = await fn();
    if (r.error) setMsg(r.error === "note" ? labels.noteError : r.error);
    else { setMsg(labels.done); router.refresh(); }
  });
  return (
    <div className="space-y-2">
      {mode === "idle" ? (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" loading={pending} onClick={() => run(() => approvePublishAction(approvalId))}><Check className="size-4" /> {labels.approve}</Button>
          <Button size="sm" variant="secondary" disabled={pending} onClick={() => setMode("note")}><MessageSquareWarning className="size-4" /> {labels.changes}</Button>
        </div>
      ) : (
        <div className="space-y-2">
          <Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder={labels.notePh} />
          <div className="flex gap-2">
            <Button size="sm" loading={pending} onClick={() => run(() => rejectPublishAction(approvalId, note))}>{labels.send}</Button>
            <Button size="sm" variant="ghost" onClick={() => setMode("idle")}>{labels.cancel}</Button>
          </div>
        </div>
      )}
      {msg && <p className="text-[12.5px] text-fg-muted" role="status">{msg}</p>}
    </div>
  );
}
