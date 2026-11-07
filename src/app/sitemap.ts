import type { MetadataRoute } from "next";
import { routing } from "@/i18n/routing";
import { SITE_URL } from "@/lib/seo";

/** Páginas públicas en cada idioma, con sus alternativas hreflang. */
const PAGES: { path: string; priority: number; changeFrequency: "weekly" | "monthly" | "yearly" }[] = [
  { path: "", priority: 1, changeFrequency: "weekly" },
  { path: "/inventory", priority: 0.9, changeFrequency: "monthly" },
  { path: "/crm", priority: 0.8, changeFrequency: "monthly" },
  { path: "/custom-software", priority: 0.8, changeFrequency: "monthly" },
  { path: "/business", priority: 0.7, changeFrequency: "monthly" },
  { path: "/portfolio", priority: 0.7, changeFrequency: "monthly" },
  { path: "/contact", priority: 0.8, changeFrequency: "yearly" },
  { path: "/examples", priority: 0.5, changeFrequency: "monthly" },
  { path: "/privacy", priority: 0.2, changeFrequency: "yearly" },
  { path: "/terms", priority: 0.2, changeFrequency: "yearly" },
];

export default function sitemap(): MetadataRoute.Sitemap {
  return PAGES.flatMap((p) => routing.locales.map((l) => ({
    url: `${SITE_URL}/${l}${p.path}`,
    changeFrequency: p.changeFrequency,
    priority: p.priority,
    alternates: { languages: Object.fromEntries(routing.locales.map((x) => [x, `${SITE_URL}/${x}${p.path}`])) },
  })));
}
