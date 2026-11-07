import { after } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { epaycoConfigured, epaycoSecrets } from "@/features/billing/epayco";
import { epaycoState, sameAmount, verifyEpaycoSignature } from "@/features/billing/epayco-sign";
import { fulfilPayment } from "@/features/billing/fulfil";

export const dynamic = "force-dynamic";
export const maxDuration = 120; // publicación + compra del dominio tras responder

/**
 * URL de confirmación de ePayco (servidor a servidor). Se valida la firma, que el
 * pago exista, el importe y la moneda; después se activa el proyecto en segundo
 * plano para responder a ePayco enseguida.
 */
async function handle(params: Record<string, string>) {
  if (!epaycoConfigured()) return new Response("not configured", { status: 503 });
  const { custId, pKey } = epaycoSecrets();
  if (!verifyEpaycoSignature(custId, pKey, params)) return new Response("invalid signature", { status: 400 });

  const paymentId = params.x_id_invoice || params.x_extra1;
  const db = createAdminClient();
  const { data: payment } = await db.from("payments").select("*").eq("id", paymentId ?? "").eq("provider", "epayco").maybeSingle();
  if (!payment) return new Response("unknown payment", { status: 404 });
  if (!sameAmount(params.x_amount, payment.amount) || (params.x_currency_code ?? "").toUpperCase() !== payment.currency.toUpperCase()) {
    await db.from("payments").update({ metadata: { ...(payment.metadata as object), mismatch: params } }).eq("id", payment.id);
    return new Response("amount mismatch", { status: 400 });
  }

  const state = epaycoState(params.x_cod_response ?? params.x_cod_transaction_state);
  if (state === "paid") {
    after(async () => { await fulfilPayment(payment.id, params); });
  } else if (state === "failed" && payment.status === "pending") {
    await db.from("payments").update({ status: "failed", external_id: params.x_ref_payco ?? null }).eq("id", payment.id);
    await db.from("domain_orders").update({ status: "cancelled" }).eq("payment_id", payment.id).eq("status", "awaiting_payment");
  }
  return new Response("ok");
}

export async function POST(req: Request) {
  const type = req.headers.get("content-type") ?? "";
  let params: Record<string, string> = {};
  if (type.includes("application/json")) params = Object.fromEntries(Object.entries((await req.json().catch(() => ({}))) as Record<string, unknown>).map(([k, v]) => [k, String(v)]));
  else params = Object.fromEntries(new URLSearchParams(await req.text()));
  return handle(params);
}

// ePayco puede enviar la confirmación por GET según la configuración del comercio.
export async function GET(req: Request) {
  return handle(Object.fromEntries(new URL(req.url).searchParams));
}
