import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/env";

export const dynamic = "force-dynamic";

/** Comprobación de estado para monitorización y despliegues. */
export function GET() {
  return NextResponse.json({
    status: "ok",
    service: "ideon-web",
    phase: 1,
    supabase: isSupabaseConfigured ? "configured" : "not_configured",
    timestamp: new Date().toISOString(),
  });
}
