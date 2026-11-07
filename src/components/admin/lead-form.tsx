"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { updateLeadAction } from "@/features/admin/actions";
import { STAGES } from "@/features/leads/schema";
import type { ActionState } from "@/features/projects/actions";
import type { Lead } from "@/types/database.types";

const local = (iso: string | null) => (iso ? new Date(new Date(iso).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : "");

/** Edición rápida de un lead por el fundador. */
export function LeadForm({ lead, labels, stageLabels }: { lead: Lead; labels: Record<"stage" | "value" | "currency" | "lastContact" | "nextFollowUp" | "notes" | "save" | "saved", string>; stageLabels: Record<string, string> }) {
  const [state, action, pending] = useActionState(updateLeadAction, {} as ActionState);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="id" value={lead.id} />
      <div className="grid sm:grid-cols-3 gap-3">
        <div>
          <Label htmlFor="stage">{labels.stage}</Label>
          <select id="stage" name="stage" defaultValue={lead.stage} className="h-10 w-full rounded-[10px] border border-border bg-surface px-3 text-[14px]">
            {STAGES.map((s) => <option key={s} value={s}>{stageLabels[s]}</option>)}
          </select>
        </div>
        <div><Label htmlFor="estimatedValue">{labels.value}</Label><Input id="estimatedValue" name="estimatedValue" type="number" min={0} step="1" defaultValue={lead.estimated_value ?? ""} /></div>
        <div><Label htmlFor="estimatedCurrency">{labels.currency}</Label><Input id="estimatedCurrency" name="estimatedCurrency" maxLength={3} defaultValue={lead.estimated_currency ?? (lead.locale === "en" ? "USD" : "COP")} /></div>
        <div><Label htmlFor="lastContactAt">{labels.lastContact}</Label><Input id="lastContactAt" name="lastContactAt" type="datetime-local" defaultValue={local(lead.last_contact_at)} /></div>
        <div><Label htmlFor="nextFollowUpAt">{labels.nextFollowUp}</Label><Input id="nextFollowUpAt" name="nextFollowUpAt" type="datetime-local" defaultValue={local(lead.next_follow_up_at)} /></div>
      </div>
      <div><Label htmlFor="notes">{labels.notes}</Label><Textarea id="notes" name="notes" rows={5} defaultValue={lead.notes ?? ""} /></div>
      <div className="flex items-center gap-3">
        <Button size="sm" type="submit" loading={pending}>{labels.save}</Button>
        {state.ok && <span className="text-[13px] text-success">{labels.saved}</span>}
        {state.error && <span className="text-[13px] text-danger">{state.error}</span>}
      </div>
    </form>
  );
}
