import "server-only";
import { siteBaseUrl } from "./serve";

/**
 * Adaptadores de despliegue. `ideon` publica en la propia plataforma (/s/<slug>)
 * sin depender de terceros; `vercel` usa la API REST de Vercel cuando hay token.
 */
export interface DeployInput {
  slug: string;
  html: string;                        // con marcadores {{IMG:id}} ya resueltos a rutas relativas
  assets: { path: string; data: Uint8Array; contentType: string }[];
}
export interface DeployResult { url: string; externalId?: string; logs?: string }

export interface DeployProvider {
  readonly target: "ideon" | "vercel";
  isConfigured(): boolean;
  deploy(input: DeployInput): Promise<DeployResult>;
  addDomain?(domain: string): Promise<{ verification: unknown }>;
}

export const ideonProvider: DeployProvider = {
  target: "ideon",
  isConfigured: () => true,
  async deploy(input) {
    // El contenido ya está en project_files; aquí solo se calcula la URL pública.
    return { url: `${siteBaseUrl()}/s/${input.slug}` };
  },
};

function vercelHeaders() {
  return { Authorization: `Bearer ${process.env.VERCEL_TOKEN}`, "Content-Type": "application/json" };
}
function vercelQuery() {
  return process.env.VERCEL_TEAM_ID ? `?teamId=${encodeURIComponent(process.env.VERCEL_TEAM_ID)}` : "";
}
function toBase64(bytes: Uint8Array) {
  return Buffer.from(bytes).toString("base64");
}

export const vercelProvider: DeployProvider = {
  target: "vercel",
  isConfigured: () => Boolean(process.env.VERCEL_TOKEN),
  async deploy(input) {
    const name = (process.env.VERCEL_SITES_PROJECT || `ideon-${input.slug}`).toLowerCase();
    const files = [
      { file: "index.html", data: toBase64(new TextEncoder().encode(input.html)), encoding: "base64" },
      ...input.assets.map((a) => ({ file: a.path, data: toBase64(a.data), encoding: "base64" })),
    ];
    const res = await fetch(`https://api.vercel.com/v13/deployments${vercelQuery()}`, {
      method: "POST",
      headers: vercelHeaders(),
      body: JSON.stringify({ name, files, target: "production", projectSettings: { framework: null, outputDirectory: "." } }),
    });
    const body = (await res.json()) as { url?: string; id?: string; error?: { message?: string } };
    if (!res.ok) throw new Error(`Vercel: ${body.error?.message ?? res.statusText}`);
    return { url: `https://${body.url}`, externalId: body.id, logs: `Despliegue ${body.id} creado en Vercel (${name}).` };
  },
  async addDomain(domain) {
    const project = process.env.VERCEL_SITES_PROJECT;
    if (!project) throw new Error("Define VERCEL_SITES_PROJECT para gestionar dominios en Vercel.");
    const res = await fetch(`https://api.vercel.com/v10/projects/${encodeURIComponent(project)}/domains${vercelQuery()}`, {
      method: "POST", headers: vercelHeaders(), body: JSON.stringify({ name: domain }),
    });
    const body = (await res.json()) as { verification?: unknown; error?: { message?: string } };
    if (!res.ok) throw new Error(`Vercel: ${body.error?.message ?? res.statusText}`);
    return { verification: body.verification ?? null };
  },
};

export function getDeployProvider(target: "ideon" | "vercel"): DeployProvider {
  return target === "vercel" ? vercelProvider : ideonProvider;
}
