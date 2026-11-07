/** Demo de la página de ejemplos (src/content/showcase/index.json, generado por scripts/generate-showcase.mjs). */
export interface ShowcaseDemo {
  slug: string;
  kind: "web" | "crm" | "inventory" | "erp" | "dashboard" | "portal" | "app" | "other";
  title: { es: string; en: string };
  summary: { es: string; en: string };
  idea: string;
  name: string;
  model: string;
  qa: { ok: number; warn: number; bad: number; total: number };
  costUsd: number;
  generatedAt: string;
}
