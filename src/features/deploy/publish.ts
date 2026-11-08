import "server-only";
import { promises as dns } from "node:dns";
import { createAdminClient } from "@/lib/supabase/admin";
import { getDeployProvider } from "./providers";
import { bundleStaticAssets, getVersionFile, siteBaseUrl, slugify } from "./serve";
import type { Json } from "@/types/database.types";

export class PublishError extends Error {
  constructor(public code: string, message: string) { super(message); }
}

/**
 * Publica la versión actual del proyecto (o la indicada) y deja el sitio servido en
 * /s/<slug> (y, si se pide, en Vercel). Con revisión manual activa, solo se llama
 * desde la aprobación del administrador (`approvalId`) o por un administrador;
 * los clientes pasan por requestPublish (src/features/deploy/review.ts).
 */
export async function publishProject(projectId: string, userId: string, opts: { target: "ideon" | "vercel"; slug?: string; versionId?: string; approvalId?: string }) {
  const db = createAdminClient();
  const { data: project } = await db.from("projects").select("*").eq("id", projectId).single();
  if (!project) throw new PublishError("not_found", "Proyecto no encontrado");
  const versionId = opts.versionId ?? project.current_version_id;
  if (!versionId) throw new PublishError("invalid_state", "No hay versión que publicar");
  const provider = getDeployProvider(opts.target);
  if (!provider.isConfigured()) throw new PublishError("not_configured", "Vercel no está configurado (VERCEL_TOKEN).");

  const { data: existing } = await db.from("published_sites").select("*").eq("project_id", projectId).maybeSingle();
  let slug = slugify(opts.slug || existing?.slug || project.name) || `sitio-${projectId.slice(0, 6)}`;
  if (!existing || existing.slug !== slug) {
    const { data: clash } = await db.from("published_sites").select("project_id").eq("slug", slug).neq("project_id", projectId).maybeSingle();
    if (clash) slug = `${slug}-${projectId.slice(0, 4)}`;
  }

  // Aprobación: la solicitud revisada (pending → approved) o, si publica un administrador directamente, una nueva.
  const { data: approval } = opts.approvalId
    ? await db.from("approvals").update({ decision: "approved", decided_by: userId, decided_at: new Date().toISOString() }).eq("id", opts.approvalId).select("*").single()
    : await db.from("approvals").insert({
      project_id: projectId, kind: "deploy", payload: { target: opts.target, slug, version_id: versionId } as Json,
      decision: "approved", requested_by: userId, decided_by: userId, decided_at: new Date().toISOString(),
    }).select("*").single();
  const { data: deployment } = await db.from("deployments").insert({
    project_id: projectId, version_id: versionId, target: opts.target, status: "building", slug, approval_id: approval!.id, created_by: userId,
  }).select("*").single();

  try {
    const file = await getVersionFile(versionId);
    if (!file) throw new PublishError("not_found", "Archivo no encontrado");
    // Para proveedores externos, imágenes y archivos viajan como archivos estáticos.
    let html = file.content;
    let assets: { path: string; data: Uint8Array; contentType: string }[] = [];
    if (opts.target !== "ideon") ({ html, assets } = await bundleStaticAssets(projectId, html));
    const result = await provider.deploy({ slug, html, assets });
    if (opts.target === "ideon") {
      // Primera publicación tras una revisión: si el dominio comprado ya quedó activo, se conecta ahora.
      let domain = { custom_domain: existing?.custom_domain ?? null, domain_status: existing?.domain_status ?? null, domain_verification: existing?.domain_verification ?? null };
      if (!existing?.custom_domain) {
        const { data: order } = await db.from("domain_orders").select("domain").eq("project_id", projectId).eq("status", "active").order("created_at", { ascending: false }).limit(1).maybeSingle();
        if (order) domain = { custom_domain: order.domain, domain_status: "verified", domain_verification: { type: "registrar", provider: "vercel" } as Json };
      }
      await db.from("published_sites").upsert({ project_id: projectId, slug, version_id: versionId, ...domain, published_at: new Date().toISOString() });
    }
    await db.from("deployments").update({ status: "live", url: result.url, external_id: result.externalId ?? null, logs: result.logs ?? null, finished_at: new Date().toISOString() }).eq("id", deployment!.id);
    if (project.status === "review" || project.status === "ready_to_deploy") await db.from("projects").update({ status: "live" }).eq("id", projectId);
    await db.from("project_events").insert({ project_id: projectId, actor_id: userId, actor_type: "user", type: "deploy.live", payload: { target: opts.target, url: result.url } });
    return { url: result.url, slug, deploymentId: deployment!.id };
  } catch (e) {
    await db.from("deployments").update({ status: "failed", logs: e instanceof Error ? e.message : String(e), finished_at: new Date().toISOString() }).eq("id", deployment!.id);
    await db.from("project_events").insert({ project_id: projectId, actor_type: "system", type: "deploy.failed", payload: { message: e instanceof Error ? e.message : String(e) } });
    throw e;
  }
}

export async function rollbackTo(projectId: string, userId: string, versionId: string) {
  const { requestPublish } = await import("./review");
  return requestPublish(projectId, userId, { versionId, origin: "client" });
}

const HOSTNAME = /^(?=.{4,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i;

/** Asocia un dominio propio al sitio publicado y devuelve las instrucciones DNS. */
export async function setCustomDomain(projectId: string, userId: string, domain: string) {
  const db = createAdminClient();
  const host = domain.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  if (!HOSTNAME.test(host)) throw new PublishError("invalid", "Dominio no válido");
  const { data: site } = await db.from("published_sites").select("*").eq("project_id", projectId).maybeSingle();
  if (!site) throw new PublishError("invalid_state", "Publica primero el sitio en Ideon");
  const platformHost = new URL(siteBaseUrl()).host;
  let verification: Json = { type: "CNAME", name: host, value: platformHost, note: "Crea un registro CNAME en tu proveedor de DNS apuntando a la plataforma. Para un dominio raíz (sin www) usa ALIAS/ANAME o un registro A si tu proveedor no admite CNAME." } as Json;
  const vercel = getDeployProvider("vercel");
  if (vercel.isConfigured() && vercel.addDomain) {
    try { const r = await vercel.addDomain(host); if (r.verification) verification = { ...(verification as Record<string, unknown>), vercel: r.verification } as unknown as Json; }
    catch (e) { verification = { ...(verification as Record<string, unknown>), vercelError: e instanceof Error ? e.message : String(e) } as Json; }
  }
  await db.from("approvals").insert({ project_id: projectId, kind: "custom_domain", payload: { domain: host } as Json, decision: "approved", requested_by: userId, decided_by: userId, decided_at: new Date().toISOString() });
  await db.from("published_sites").update({ custom_domain: host, domain_status: "pending_dns", domain_verification: verification }).eq("project_id", projectId);
  await db.from("project_events").insert({ project_id: projectId, actor_id: userId, actor_type: "user", type: "domain.requested", payload: { domain: host } });
  return { domain: host, verification };
}

/** Comprueba por DNS si el dominio apunta a la plataforma. */
export async function verifyCustomDomain(projectId: string) {
  const db = createAdminClient();
  const { data: site } = await db.from("published_sites").select("*").eq("project_id", projectId).maybeSingle();
  if (!site?.custom_domain) throw new PublishError("invalid_state", "No hay dominio configurado");
  const platformHost = new URL(siteBaseUrl()).host.split(":")[0];
  let verified = false; let detail = "";
  try {
    const cname = await dns.resolveCname(site.custom_domain).catch(() => [] as string[]);
    if (cname.some((c) => c.replace(/\.$/, "").toLowerCase() === platformHost.toLowerCase())) { verified = true; detail = `CNAME → ${cname[0]}`; }
    if (!verified) {
      const [a, pa] = await Promise.all([dns.resolve4(site.custom_domain).catch(() => [] as string[]), dns.resolve4(platformHost).catch(() => [] as string[])]);
      if (a.length && pa.length && a.some((ip) => pa.includes(ip))) { verified = true; detail = `A → ${a[0]}`; }
      else detail = a.length || cname.length ? `Apunta a ${[...cname, ...a].join(", ")}; se esperaba ${platformHost}` : "Sin registros DNS todavía (la propagación puede tardar hasta 48 h).";
    }
  } catch (e) { detail = e instanceof Error ? e.message : String(e); }
  await db.from("published_sites").update({ domain_status: verified ? "verified" : "pending_dns" }).eq("project_id", projectId);
  if (verified) await db.from("project_events").insert({ project_id: projectId, actor_type: "system", type: "domain.verified", payload: { domain: site.custom_domain } });
  return { verified, detail };
}

export async function removeCustomDomain(projectId: string) {
  const db = createAdminClient();
  await db.from("published_sites").update({ custom_domain: null, domain_status: null, domain_verification: null }).eq("project_id", projectId);
}
