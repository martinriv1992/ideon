import fs from "node:fs/promises";
import path from "node:path";
import { siteHeaders } from "@/features/deploy/serve";
import demos from "@/content/private-demos/index.json";

/**
 * Demos privadas para prospectos (con su marca): solo accesibles con el enlace,
 * no aparecen en /examples ni en el sitemap y no se indexan.
 */
export const dynamic = "force-static";

export function generateStaticParams() {
  return demos.map((d) => ({ token: d.token }));
}

export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const demo = demos.find((d) => d.token === token);
  if (!demo) return new Response("No encontrado", { status: 404 });
  const html = await fs.readFile(path.join(process.cwd(), "src/content/private-demos", demo.file), "utf8");
  return new Response(html, { headers: { ...siteHeaders("text/html", 300), "X-Robots-Tag": "noindex, nofollow" } });
}
