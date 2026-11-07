"use server";

import { revalidatePath } from "next/cache";
import { getLocale } from "next-intl/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentContext } from "@/features/organizations/queries";
import type { ActionState } from "@/features/projects/actions";

const schema = z.object({ subject: z.string().trim().min(3).max(140), body: z.string().trim().min(10).max(4000), projectId: z.string().uuid().optional().or(z.literal("")) });

export async function createTicketAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "invalid" };
  const ctx = await getCurrentContext();
  if (!ctx) return { error: "unauthenticated" };
  const supabase = await createClient();
  const { error } = await supabase.from("support_tickets").insert({ organization_id: ctx.organization.id, project_id: parsed.data.projectId || null, created_by: ctx.user.id, subject: parsed.data.subject, body: parsed.data.body });
  if (error) return { error: error.message };
  revalidatePath(`/${await getLocale()}/support`);
  return { ok: true };
}
