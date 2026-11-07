/** Datos de contacto públicos de la plataforma. */
export const WHATSAPP_NUMBER = "573005661797"; // +57 300 566 1797

/** Enlace de WhatsApp (wa.me) con un mensaje inicial opcional. */
export function whatsappLink(message?: string) {
  return `https://wa.me/${WHATSAPP_NUMBER}${message ? `?text=${encodeURIComponent(message)}` : ""}`;
}
