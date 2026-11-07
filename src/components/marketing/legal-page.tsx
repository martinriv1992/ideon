import { getLocale } from "next-intl/server";
import { Container } from "@/components/ui/card";

/**
 * Páginas legales. El texto definitivo lo redacta el equipo legal del negocio;
 * aquí se deja la estructura y un aviso explícito de que está pendiente.
 */
const PAGES = {
  privacy: { es: "Política de privacidad", en: "Privacy policy" },
  terms: { es: "Términos de servicio", en: "Terms of service" },
} as const;

export async function LegalPage({ legal }: { legal: keyof typeof PAGES }) {
  const locale = (await getLocale()) as "es" | "en";
  const page = PAGES[legal];

  return (
    <section className="pt-36 pb-24">
      <Container className="max-w-3xl">
        <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight">{page[locale]}</h1>
        <p className="mt-6 text-fg-muted leading-relaxed">
          {locale === "es"
            ? "Este documento está pendiente de redacción por el equipo legal de Ideon. Se publicará aquí antes del lanzamiento comercial."
            : "This document is pending drafting by Ideon's legal team. It will be published here before the commercial launch."}
        </p>
      </Container>
    </section>
  );
}
