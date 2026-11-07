import type { Metadata } from "next";
import { routing } from "@/i18n/routing";

export const SITE_URL = (process.env.NEXT_PUBLIC_APP_URL || "https://ideonapp.com").replace(/\/$/, "");

/** Metadatos por página: título, descripción, canónica, hreflang y Open Graph en el idioma de la página. */
export function pageMetadata({ locale, path, title, description }: { locale: string; path: string; title: string; description: string }): Metadata {
  const p = path === "/" ? "" : path;
  const languages = Object.fromEntries(routing.locales.map((l) => [l, `${SITE_URL}/${l}${p}`]));
  return {
    title: { absolute: title.includes("Ideonapp") ? title : `${title} · Ideonapp` },
    description,
    alternates: { canonical: `${SITE_URL}/${locale}${p}`, languages: { ...languages, "x-default": `${SITE_URL}/${routing.defaultLocale}${p}` } },
    openGraph: {
      title, description, url: `${SITE_URL}/${locale}${p}`, siteName: "Ideonapp", locale: locale === "en" ? "en_US" : "es_CO", type: "website",
      // Imagen generada por src/app/[locale]/opengraph-image.tsx (hay que declararla: el openGraph de la página reemplaza al heredado).
      images: [{ url: `${SITE_URL}/${locale}/opengraph-image`, width: 1200, height: 630, alt: "Ideonapp · AI Software Studio" }],
    },
    twitter: { card: "summary_large_image", title, description, images: [`${SITE_URL}/${locale}/opengraph-image`] },
  };
}

/** Datos estructurados (schema.org) incrustados de forma segura. */
export function jsonLd(data: Record<string, unknown>) {
  return { __html: JSON.stringify(data).replace(/</g, "\\u003c") };
}

export function organizationLd(locale: string) {
  return {
    "@context": "https://schema.org", "@type": "Organization", name: "Ideonapp", url: SITE_URL, logo: `${SITE_URL}/icon.svg`,
    description: locale === "en"
      ? "An AI-powered software studio building custom digital products and intelligent business solutions."
      : "Un estudio de software impulsado por inteligencia artificial que transforma ideas y necesidades empresariales en productos digitales reales.",
    areaServed: ["CO", "ES", "MX", "Worldwide"],
    contactPoint: { "@type": "ContactPoint", contactType: "sales", url: `${SITE_URL}/${locale}/contact`, availableLanguage: ["Spanish", "English"] },
  };
}

export function serviceLd(locale: string, path: string, name: string, description: string) {
  return {
    "@context": "https://schema.org", "@type": "Service", name, description, url: `${SITE_URL}/${locale}${path}`,
    provider: { "@type": "Organization", name: "Ideonapp", url: SITE_URL }, areaServed: ["CO", "ES", "MX", "Worldwide"],
  };
}
