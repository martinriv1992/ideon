"use client";

import { useActionState, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { createTicketAction } from "@/features/support/actions";
import type { ActionState } from "@/features/projects/actions";

export function TicketForm({ projects }: { projects: { id: string; name: string }[] }) {
  const t = useTranslations("app.pages.support");
  const [state, action, pending] = useActionState(createTicketAction, {} as ActionState);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state.ok) ref.current?.reset(); }, [state.ok]);
  return (
    <form ref={ref} action={action} className="space-y-4">
      <div><Label htmlFor="subject">{t("subject")}</Label><Input id="subject" name="subject" required minLength={3} maxLength={140} /></div>
      <div><Label htmlFor="projectId">{t("project")}</Label>
        <select id="projectId" name="projectId" className="h-11 w-full bg-surface border border-border rounded-[10px] px-3.5 text-sm text-fg"><option value="">{t("noProject")}</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
      <div><Label htmlFor="body">{t("body")}</Label><Textarea id="body" name="body" rows={5} required minLength={10} maxLength={4000} /></div>
      <div className="flex items-center gap-3"><Button type="submit" loading={pending}>{t("send")}</Button>{state.ok && <span className="text-[13px] text-success">{t("sent")}</span>}{state.error && <span className="text-[13px] text-danger">{state.error}</span>}</div>
    </form>
  );
}
