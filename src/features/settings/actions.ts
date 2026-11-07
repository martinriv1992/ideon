"use server";

import { revalidatePath } from "next/cache";
import { getLocale } from "next-intl/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentContext } from "@/features/organizations/queries";
import type { ActionState } from "@/features/projects/actions";

const schema = z.object({
  fullName: z.string().trim().min(2).max(120),
  locale: z.enum(["es", "en"]),
  orgName: z.string().trim().min(2).max(120),
});

export async function updateSettingsAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "invalid" };

  const ctx = await getCurrentContext();
  if (!ctx) return { error: "unauthenticated" };
  const supabase = await createClient();

  const { error: pErr } = await supabase
    .from("profiles")
    .update({ full_name: parsed.data.fullName, locale: parsed.data.locale })
    .eq("id", ctx.user.id);
  if (pErr) return { error: pErr.message };

  if (ctx.role === "owner" || ctx.role === "admin") {
    const { error: oErr } = await supabase
      .from("organizations")
      .update({ name: parsed.data.orgName })
      .eq("id", ctx.organization.id);
    if (oErr) return { error: oErr.message };
  }

  const locale = await getLocale();
  revalidatePath(`/${locale}/settings`);
  return { ok: true };
}
