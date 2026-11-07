"use client";

import { useTransition } from "react";
import { updateTicketStatusAction } from "@/features/admin/actions";

export function TicketStatus({ id, status }: { id: string; status: string }) {
  const [pending, start] = useTransition();
  return (
    <select defaultValue={status} disabled={pending} onChange={(e) => start(() => updateTicketStatusAction(id, e.target.value as "open"))} className="h-8 bg-surface border border-border rounded-[8px] px-2 text-[13px]">
      {["open", "in_progress", "resolved", "closed"].map((s) => <option key={s} value={s}>{s}</option>)}
    </select>
  );
}
