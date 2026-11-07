import { getTranslations } from "next-intl/server";
import { whatsappLink } from "@/lib/contact";

/** Botón flotante de WhatsApp en las páginas públicas. */
export async function WhatsAppButton() {
  const t = await getTranslations("whatsapp");
  return (
    <a
      href={whatsappLink(t("message"))}
      target="_blank"
      rel="noreferrer"
      aria-label={t("label")}
      title={t("label")}
      className="fixed z-40 right-4 bottom-4 sm:right-6 sm:bottom-6 size-12 sm:size-14 rounded-full bg-[#25D366] text-white shadow-lg shadow-black/30 flex items-center justify-center hover:scale-105 transition-transform focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
    >
      <svg viewBox="0 0 32 32" className="size-6 sm:size-7" fill="currentColor" aria-hidden>
        <path d="M16.04 3C9.4 3 4 8.36 4 14.97c0 2.11.56 4.17 1.62 5.99L4 29l8.24-1.6a12.1 12.1 0 0 0 3.8.62c6.63 0 12.03-5.36 12.03-11.97S22.67 3 16.04 3zm0 21.86c-1.2 0-2.38-.2-3.5-.6l-.25-.09-4.9.95.98-4.73-.16-.26a9.8 9.8 0 0 1-1.51-5.2c0-5.44 4.44-9.87 9.9-9.87 5.45 0 9.9 4.43 9.9 9.87 0 5.45-4.45 9.93-9.9 9.93zm5.43-7.4c-.3-.15-1.76-.86-2.03-.96-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.47-.88-.79-1.48-1.76-1.65-2.06-.17-.3-.02-.46.13-.6.13-.14.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.6-.92-2.2-.24-.58-.49-.5-.67-.5h-.57c-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.48 0 1.46 1.07 2.88 1.22 3.08.15.2 2.1 3.2 5.08 4.48.71.31 1.27.49 1.7.63.71.22 1.36.19 1.88.12.57-.09 1.76-.72 2-1.41.25-.7.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35z" />
      </svg>
    </a>
  );
}
