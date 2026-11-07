import { getCurrentContext } from "@/features/organizations/queries";
import { createAdminClient } from "@/lib/supabase/admin";
import { toCsv } from "@/features/leads/schema";

export const dynamic = "force-dynamic";

const COLUMNS = ["created_at", "stage", "company", "full_name", "email", "country", "website", "solution", "budget", "timeframe", "wants_meeting", "problem",
  "estimated_value", "estimated_currency", "last_contact_at", "next_follow_up_at", "notes", "source", "medium", "campaign", "term", "content", "landing_page", "referrer", "locale"];

/** Exportación CSV de los leads (solo administradores de la plataforma). */
export async function GET() {
  const ctx = await getCurrentContext();
  if (!ctx?.profile.is_platform_admin) return new Response("forbidden", { status: 403 });
  const { data, error } = await createAdminClient().from("leads").select("*").order("created_at", { ascending: false });
  if (error) return new Response(error.message, { status: 500 });
  return new Response("﻿" + toCsv(data ?? [], COLUMNS), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="ideonapp-leads-${new Date().toISOString().slice(0, 10)}.csv"`, "Cache-Control": "no-store" },
  });
}
