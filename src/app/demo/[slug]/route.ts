import fs from "node:fs/promises";
import path from "node:path";
import { siteHeaders, withPreviewBadge } from "@/features/deploy/serve";
import data from "@/content/showcase/index.json";
import type { ShowcaseDemo } from "@/content/showcase/types";

const showcase = data as ShowcaseDemo[];

export const dynamic = "force-static";

export function generateStaticParams() {
  return showcase.map((d) => ({ slug: d.slug }));
}

/** Demo pública de la página de ejemplos (generada por Ideon, con datos ficticios). */
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!showcase.some((d) => d.slug === slug)) return new Response("No encontrado", { status: 404 });
  const html = await fs.readFile(path.join(process.cwd(), "src/content/showcase", `${slug}.html`), "utf8");
  return new Response(withPreviewBadge(html, slug.endsWith("-en") ? "Ideonapp product demo · fictional data" : "Demostración de producto · Ideonapp · datos ficticios"), { headers: siteHeaders("text/html", 3600) });
}
