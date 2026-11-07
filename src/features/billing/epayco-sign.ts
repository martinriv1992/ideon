import { createHash, timingSafeEqual } from "node:crypto";

/**
 * Firma de las confirmaciones de ePayco (módulo puro, probado de forma aislada):
 * x_signature = sha256(p_cust_id_cliente ^ p_key ^ x_ref_payco ^ x_transaction_id ^ x_amount ^ x_currency_code)
 */
export function epaycoSignature(custId: string, pKey: string, p: { x_ref_payco: string; x_transaction_id: string; x_amount: string; x_currency_code: string }) {
  return createHash("sha256").update([custId, pKey, p.x_ref_payco, p.x_transaction_id, p.x_amount, p.x_currency_code].join("^")).digest("hex");
}

export function verifyEpaycoSignature(custId: string, pKey: string, p: Record<string, string>) {
  const expected = epaycoSignature(custId, pKey, {
    x_ref_payco: p.x_ref_payco ?? "", x_transaction_id: p.x_transaction_id ?? "", x_amount: p.x_amount ?? "", x_currency_code: p.x_currency_code ?? "",
  });
  const got = (p.x_signature ?? "").toLowerCase();
  return got.length === expected.length && timingSafeEqual(Buffer.from(got), Buffer.from(expected));
}

/** Códigos de respuesta de ePayco (x_cod_response / x_cod_transaction_state). */
export function epaycoState(code: string | undefined): "paid" | "pending" | "failed" {
  switch (code) {
    case "1": return "paid";            // Aceptada
    case "3": case "7": case "10": return "pending"; // Pendiente / En validación / Retenida
    default: return "failed";           // Rechazada, Fallida, Reversada, Abandonada, Cancelada…
  }
}

/** Importes como los compara ePayco: «240000» y «240000.00» son el mismo importe. */
export function sameAmount(a: string | number, b: string | number) {
  return Math.round(Number(a) * 100) === Math.round(Number(b) * 100);
}
