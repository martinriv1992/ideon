import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { adminEmails, escapeHtml as esc, sendEmail, userEmail } from "@/lib/notify";
import { publicEnv } from "@/lib/env";
import { publishProject, PublishError } from "./publish";
import type { Json } from "@/types/database.types";

/**
 * Revisión manual antes de publicar: el sitio o la app real de un cliente solo
 * se publica (o se actualiza) cuando un administrador de la plataforma lo aprueba.
 * La vista previa del workspace sigue siendo instantánea.
 *
 * Ajuste `publish_review_required` (por defecto activado) en /admin/reviews.
 * Cada solicitud es una fila de `approvals` (kind "deploy") en estado pending.
 */

type Admin = ReturnType<typeof createAdminClient>;
export interface ReviewPayload { target: "ideon"; slug?: string; version_id: string; version_number?: number; note?: string; origin?: string }

export async function reviewRequired(db: Admin = createAdminClient()) {
  const { data } = await db.from("platform_settings").select("value").eq("key", "publish_review_required").maybeSingle();
  return data?.value === undefined || data?.value === null ? true : data.value !== false && data.value !== "false";
}

async function isPlatformAdmin(db: Admin, userId: string) {
  const { data } = await db.from("profiles").select("is_platform_admin").eq("id", userId).maybeSingle();
  return Boolean(data?.is_platform_admin);
}

const base = () => publicEnv.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");

/**
 * El cliente pide publicar (al pagar o con el botón Publicar). Si la revisión está
 * activa y quien lo pide no es administrador, queda pendiente; si no, se publica ya.
 */
export async function requestPublish(projectId: string, userId: string, opts: { slug?: string; versionId?: string; origin: "payment" | "client" }) {
  const db = createAdminClient();
  if (!(await reviewRequired(db)) || (await isPlatformAdmin(db, userId))) {
    const r = await publishProject(projectId, userId, { target: "ideon", slug: opts.slug, versionId: opts.versionId });
    return { status: "live" as const, ...r };
  }
  const { data: project } = await db.from("projects").select("id,name,current_version_id").eq("id", projectId).single();
  if (!project) throw new PublishError("not_found", "Proyecto no encontrado");
  const versionId = opts.versionId ?? project.current_version_id;
  if (!versionId) throw new PublishError("invalid_state", "No hay versión que publicar");
  const { data: version } = await db.from("project_versions").select("number").eq("id", versionId).eq("project_id", projectId).maybeSingle();
  if (!version) throw new PublishError("not_found", "Versión no encontrada");

  // Una sola solicitud viva por proyecto: la nueva sustituye a la anterior.
  await db.from("approvals").update({ decision: "rejected", decided_at: new Date().toISOString(), payload: { superseded: true } as Json })
    .eq("project_id", projectId).eq("kind", "deploy").eq("decision", "pending");
  const payload: ReviewPayload = { target: "ideon", slug: opts.slug, version_id: versionId, version_number: version.number, origin: opts.origin };
  const { data: approval } = await db.from("approvals").insert({ project_id: projectId, kind: "deploy", payload: payload as unknown as Json, decision: "pending", requested_by: userId }).select("id").single();
  await db.from("project_events").insert({ project_id: projectId, actor_id: userId, actor_type: "user", type: "publish.review_requested", payload: { version: version.number } });

  await sendEmail({
    to: await adminEmails(),
    subject: `Revisión pendiente · ${project.name} (v${version.number})`,
    html: `<div style="font-family:system-ui,sans-serif;max-width:520px;line-height:1.5"><h2 style="margin:0 0 8px">Revisión pendiente</h2>
<p><b>${esc(project.name)}</b> · versión ${version.number} · ${opts.origin === "payment" ? "recién pagado" : "el cliente pidió publicar"}.</p>
<p><a href="${base()}/es/admin/reviews">Revisar y aprobar</a></p></div>`,
  });
  return { status: "pending_review" as const, approvalId: approval?.id ?? null };
}

/** El administrador aprueba: se publica la versión revisada y se avisa al cliente. */
export async function approvePublish(approvalId: string, adminId: string) {
  const db = createAdminClient();
  const { data: a } = await db.from("approvals").select("*").eq("id", approvalId).eq("kind", "deploy").eq("decision", "pending").maybeSingle();
  if (!a) throw new PublishError("not_found", "La solicitud ya no está pendiente");
  const p = a.payload as unknown as ReviewPayload;
  const result = await publishProject(a.project_id, adminId, { target: "ideon", slug: p.slug, versionId: p.version_id, approvalId });
  const { data: project } = await db.from("projects").select("name,locale").eq("id", a.project_id).single();
  const to = await userEmail(a.requested_by);
  if (to && project) {
    const en = project.locale === "en";
    await sendEmail({
      to: [to],
      subject: en ? `Your project is live · ${project.name}` : `Tu proyecto está publicado · ${project.name}`,
      html: `<div style="font-family:system-ui,sans-serif;max-width:520px;line-height:1.5"><h2 style="margin:0 0 8px">${en ? "Your project is live" : "Tu proyecto ya está publicado"}</h2>
<p>${en ? "We reviewed" : "Revisamos"} <b>${esc(project.name)}</b> ${en ? "and published it" : "y lo publicamos"}: <a href="${esc(result.url)}">${esc(result.url)}</a></p>
<p><a href="${base()}/${en ? "en" : "es"}/projects/${a.project_id}">${en ? "Open your project" : "Abrir tu proyecto"}</a></p></div>`,
    });
  }
  return result;
}

/** El administrador pide cambios antes de publicar: la solicitud se cierra con una nota para el cliente. */
export async function rejectPublish(approvalId: string, adminId: string, note: string) {
  const db = createAdminClient();
  const { data: a } = await db.from("approvals").select("*").eq("id", approvalId).eq("kind", "deploy").eq("decision", "pending").maybeSingle();
  if (!a) throw new PublishError("not_found", "La solicitud ya no está pendiente");
  const payload = { ...(a.payload as unknown as ReviewPayload), note: note.trim().slice(0, 2000) };
  await db.from("approvals").update({ decision: "rejected", decided_by: adminId, decided_at: new Date().toISOString(), payload: payload as unknown as Json }).eq("id", approvalId);
  await db.from("project_events").insert({ project_id: a.project_id, actor_id: adminId, actor_type: "user", type: "publish.review_changes", payload: { note: payload.note } });
  const { data: project } = await db.from("projects").select("name,locale").eq("id", a.project_id).single();
  const to = await userEmail(a.requested_by);
  if (to && project) {
    const en = project.locale === "en";
    await sendEmail({
      to: [to],
      subject: en ? `A few adjustments before publishing · ${project.name}` : `Unos ajustes antes de publicar · ${project.name}`,
      html: `<div style="font-family:system-ui,sans-serif;max-width:520px;line-height:1.5"><h2 style="margin:0 0 8px">${en ? "We reviewed your project" : "Revisamos tu proyecto"}</h2>
<p>${en ? "Before publishing" : "Antes de publicar"} <b>${esc(project.name)}</b> ${en ? "we suggest:" : "te sugerimos:"}</p>
<p style="white-space:pre-wrap;background:#f4f4f5;padding:12px;border-radius:8px">${esc(payload.note)}</p>
<p><a href="${base()}/${en ? "en" : "es"}/projects/${a.project_id}">${en ? "Open your project" : "Abrir tu proyecto"}</a></p></div>`,
    });
  }
}
