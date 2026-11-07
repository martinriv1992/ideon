import "server-only";
import { publicEnv } from "@/lib/env";

/**
 * ePayco (Colombia): pagos del lanzamiento y de las renovaciones con su
 * Checkout estándar. La confirmación llega a /api/billing/epayco/confirmation
 * y se valida con la firma (P_CUST_ID_CLIENTE + P_KEY).
 *
 * Variables: EPAYCO_PUBLIC_KEY, EPAYCO_P_CUST_ID_CLIENTE, EPAYCO_P_KEY y
 * EPAYCO_TEST=true mientras se prueba en modo de pruebas.
 */
export function epaycoConfigured() {
  return Boolean(process.env.EPAYCO_PUBLIC_KEY && process.env.EPAYCO_P_CUST_ID_CLIENTE && process.env.EPAYCO_P_KEY);
}

export function epaycoSecrets() {
  return { custId: process.env.EPAYCO_P_CUST_ID_CLIENTE ?? "", pKey: process.env.EPAYCO_P_KEY ?? "" };
}

export interface EpaycoCheckout {
  key: string;
  test: boolean;
  data: Record<string, string>;
}

/** Parámetros para ePayco.checkout.configure(...).open(data) en el navegador. */
export function epaycoCheckout(args: {
  paymentId: string; name: string; description: string; amount: number; currency: string;
  email?: string | null; buyerName?: string | null; locale: "es" | "en"; projectId: string;
  /** Datos del pagador para prellenar el checkout (Colombia por defecto). */
  phone?: string | null; address?: string | null;
  /** Página a la que vuelve el cliente tras pagar (por defecto, el proyecto). */
  returnPath?: string;
}): EpaycoCheckout {
  const base = publicEnv.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  return {
    key: process.env.EPAYCO_PUBLIC_KEY ?? "",
    test: process.env.EPAYCO_TEST === "true",
    data: {
      name: args.name.slice(0, 100),
      description: args.description.slice(0, 250),
      invoice: args.paymentId,
      currency: args.currency.toLowerCase(),
      amount: String(args.amount),
      tax_base: "0",
      tax: "0",
      country: "co",
      lang: args.locale,
      external: "false",
      extra1: args.paymentId,
      extra2: args.projectId,
      response: args.returnPath ? `${base}/${args.locale}${args.returnPath}` : `${base}/${args.locale}/projects/${args.projectId}?payment=return`,
      confirmation: `${base}/api/billing/epayco/confirmation`,
      ...(args.email ? { email_billing: args.email } : {}),
      ...(args.buyerName ? { name_billing: args.buyerName } : {}),
      // Colombia por defecto: documento tipo cédula y móvil sin el prefijo +57.
      type_doc_billing: "CC",
      ...(args.phone ? { mobilephone_billing: args.phone.replace(/^\+57/, "").replace(/\D/g, "") } : {}),
      ...(args.address ? { address_billing: args.address.slice(0, 100) } : {}),
    },
  };
}
