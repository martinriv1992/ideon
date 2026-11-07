"use server";

import { revalidatePath } from "next/cache";
import { getLocale } from "next-intl/server";
import { z } from "zod";
import { getCurrentContext } from "@/features/organizations/queries";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ActionState } from "@/features/projects/actions";

async function admin() {
  const ctx = await getCurrentContext();
  if (!ctx?.profile.is_platform_admin) throw new Error("forbidden");
  return createAdminClient();
}

export async function updatePlanAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = z.object({ key: z.string(), price_from: z.string().optional(), currency: z.string().length(3), is_active: z.string().optional() }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "invalid" };
  try {
    const db = await admin();
    const price = parsed.data.price_from?.trim() ? Number(parsed.data.price_from) : null;
    const { error } = await db.from("pricing_plans").update({ price_from: price, currency: parsed.data.currency.toUpperCase(), is_active: parsed.data.is_active === "on" }).eq("key", parsed.data.key);
    if (error) return { error: error.message };
    revalidatePath(`/${await getLocale()}/admin/pricing`);
    return { ok: true };
  } catch (e) { return { error: (e as Error).message }; }
}

export async function updatePolicyAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = z.object({ task: z.string(), model: z.string().min(3), max_output_tokens: z.coerce.number().int().min(256).max(64000), input_cost_per_mtok: z.coerce.number().min(0), output_cost_per_mtok: z.coerce.number().min(0) }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "invalid" };
  try {
    const db = await admin();
    const { task, ...rest } = parsed.data;
    const { error } = await db.from("model_policies").upsert({ task, provider: "anthropic", ...rest });
    if (error) return { error: error.message };
    revalidatePath(`/${await getLocale()}/admin/ai`);
    return { ok: true };
  } catch (e) { return { error: (e as Error).message }; }
}

export async function updateSettingAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = z.object({ key: z.string(), value: z.string() }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "invalid" };
  try {
    const db = await admin();
    let value: unknown; try { value = JSON.parse(parsed.data.value); } catch { value = parsed.data.value; }
    const { error } = await db.from("platform_settings").upsert({ key: parsed.data.key, value: value as never });
    if (error) return { error: error.message };
    revalidatePath(`/${await getLocale()}/admin/settings`);
    return { ok: true };
  } catch (e) { return { error: (e as Error).message }; }
}

export async function updateTicketStatusAction(ticketId: string, status: "open" | "in_progress" | "resolved" | "closed") {
  const db = await admin();
  await db.from("support_tickets").update({ status }).eq("id", ticketId);
  revalidatePath(`/${await getLocale()}/admin/tickets`);
}

/** Gestión comercial de un lead (etapa, valor, fechas de contacto y notas). */
export async function updateLeadAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { leadUpdateSchema } = await import("@/features/leads/schema");
  const raw = Object.fromEntries(formData) as Record<string, string>;
  const id = z.string().uuid().safeParse(raw.id);
  const parsed = leadUpdateSchema.safeParse({
    stage: raw.stage, estimatedValue: raw.estimatedValue?.trim() ? Number(raw.estimatedValue) : null,
    estimatedCurrency: raw.estimatedCurrency ?? "", lastContactAt: raw.lastContactAt || undefined, nextFollowUpAt: raw.nextFollowUpAt || undefined, notes: raw.notes,
  });
  if (!id.success || !parsed.success) return { error: "invalid" };
  try {
    const db = await admin();
    const d = parsed.data;
    const { error } = await db.from("leads").update({
      stage: d.stage, estimated_value: d.estimatedValue ?? null, estimated_currency: d.estimatedCurrency ?? null,
      last_contact_at: d.lastContactAt, next_follow_up_at: d.nextFollowUpAt, notes: d.notes,
    }).eq("id", id.data);
    if (error) return { error: error.message };
    revalidatePath(`/${await getLocale()}/admin/leads`);
    return { ok: true };
  } catch (e) { return { error: (e as Error).message }; }
}
