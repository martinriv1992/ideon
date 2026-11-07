import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { DEFAULT_POLICIES, estimateCostUsd, getProvider, type AgentTask, type ModelPolicy } from "@/lib/ai/provider";
import {
  architectSystem, architectUser, cleanHtml, consultantSystem, consultantUser, developerSystem, developerUser,
  extractJson, isAppKind, isCompleteHtml, modifySystem, modifyUser, normalizeConsultant, parseModifyOutput,
  type ConsultantOutput, type DocRef, type FileRef, type ImageRef, type TranscriptMessage,
} from "./prompts";
import { runQa, qaSummary } from "./qa";
import { buildProposal, type SpecLike } from "@/features/proposals/generate";
import type { AgentType, Json, Project, ProjectStatus } from "@/types/database.types";

/**
 * Orquestador de agentes (Fase 2-4). Se ejecuta en servidor con la clave
 * service_role: registra cada ejecución en agent_runs, el consumo en ai_usage,
 * los mensajes del asistente, especificaciones, propuestas, versiones y eventos.
 */

type Admin = ReturnType<typeof createAdminClient>;

export class OrchestratorError extends Error {
  constructor(public code: string, message: string) { super(message); }
}

// ----------------------------------------------------------------- utilidades
async function getPolicy(db: Admin, task: AgentTask): Promise<ModelPolicy> {
  const { data } = await db.from("model_policies").select("*").eq("task", task).maybeSingle();
  if (!data) return DEFAULT_POLICIES[task];
  return { task, provider: data.provider, model: data.model, maxOutputTokens: data.max_output_tokens, inputCostPerMtok: Number(data.input_cost_per_mtok), outputCostPerMtok: Number(data.output_cost_per_mtok) };
}

async function getSetting<T>(db: Admin, key: string, fallback: T): Promise<T> {
  const { data } = await db.from("platform_settings").select("value").eq("key", key).maybeSingle();
  return (data?.value as T) ?? fallback;
}

async function loadProject(db: Admin, projectId: string) {
  const { data: project } = await db.from("projects").select("*").eq("id", projectId).maybeSingle();
  if (!project) throw new OrchestratorError("not_found", "Proyecto no encontrado");
  const { data: conversations } = await db.from("conversations").select("*").eq("project_id", projectId).order("created_at").limit(1);
  let conversation = conversations?.[0] ?? null;
  if (!conversation) {
    const { data } = await db.from("conversations").insert({ project_id: projectId, agent_type: "consultant", title: project.name }).select("*").single();
    conversation = data!;
  }
  const { data: messages } = await db.from("messages").select("*").eq("conversation_id", conversation.id).order("created_at").limit(200);
  const { data: images } = await db.from("project_images").select("id,label,width,height").eq("project_id", projectId).order("created_at");
  const { data: assets } = await db.from("project_assets").select("id,label,name,mime,size,use_reference,use_site,text_content").eq("project_id", projectId).order("created_at");
  const docs: DocRef[] = (assets ?? []).filter((a) => a.use_reference && a.text_content).map((a) => ({ id: a.id, label: a.label, name: a.name, text: a.text_content! }));
  const files: FileRef[] = (assets ?? []).filter((a) => a.use_site).map((a) => ({ id: a.id, label: a.label, name: a.name, mime: a.mime, size: a.size }));
  return { project, conversation, messages: messages ?? [], images: (images ?? []) as ImageRef[], docs, files };
}

function transcript(messages: { role: string; content: string; content_json: Json | null }[]): TranscriptMessage[] {
  return messages.filter((m) => m.role === "user" || m.role === "assistant").map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
    question: (m.content_json as { question?: TranscriptMessage["question"] } | null)?.question ?? null,
  }));
}

async function postAssistant(db: Admin, conversationId: string, content: string, agent: AgentType | null, contentJson?: Json) {
  await db.from("messages").insert({ conversation_id: conversationId, role: "assistant", content, agent_type: agent, content_json: contentJson ?? null });
}

async function event(db: Admin, projectId: string, type: string, payload: Json = {}) {
  await db.from("project_events").insert({ project_id: projectId, actor_type: "agent", type, payload });
}

async function setStatus(db: Admin, project: Project, status: ProjectStatus, extra: Partial<Project> = {}) {
  await db.from("projects").update({ status, ...extra }).eq("id", project.id);
  await event(db, project.id, "status.changed", { from: project.status, to: status });
  project.status = status;
}

/** Ejecuta una llamada al modelo registrándola como agent_run y en ai_usage. */
async function callModel(db: Admin, project: Project, conversationId: string, task: AgentTask, agent: AgentType, system: string, user: string) {
  const policy = await getPolicy(db, task);
  const provider = await getProvider();
  const { data: run } = await db.from("agent_runs").insert({
    project_id: project.id, conversation_id: conversationId, agent_type: agent, step: task, provider: provider.name, model: policy.model, status: "running", started_at: new Date().toISOString(),
    input: { system_chars: system.length, user_chars: user.length },
  }).select("*").single();
  await db.from("projects").update({ active_run_id: run!.id }).eq("id", project.id);
  try {
    const res = await provider.complete({ system, user, model: policy.model, maxOutputTokens: policy.maxOutputTokens, task });
    const cost = estimateCostUsd(policy, res.inputTokens, res.outputTokens);
    await db.from("agent_runs").update({ status: "succeeded", finished_at: new Date().toISOString(), model: res.model, input_tokens: res.inputTokens, output_tokens: res.outputTokens, cost_usd: cost, output: { chars: res.text.length, truncated: res.truncated } }).eq("id", run!.id);
    await db.from("ai_usage").insert({ organization_id: project.organization_id, project_id: project.id, run_id: run!.id, provider: provider.name, model: res.model, input_tokens: res.inputTokens, output_tokens: res.outputTokens, cost_usd: cost });
    return { ...res, runId: run!.id };
  } catch (e) {
    await db.from("agent_runs").update({ status: "failed", finished_at: new Date().toISOString(), error: e instanceof Error ? e.message : String(e) }).eq("id", run!.id);
    throw e;
  } finally {
    await db.from("projects").update({ active_run_id: null }).eq("id", project.id);
  }
}

async function callJson<T>(db: Admin, project: Project, conversationId: string, task: AgentTask, agent: AgentType, system: string, user: string): Promise<{ value: T; runId: string }> {
  const first = await callModel(db, project, conversationId, task, agent, system, user);
  let v = extractJson<T>(first.text);
  if (v) return { value: v, runId: first.runId };
  const second = await callModel(db, project, conversationId, task, agent, system, user + "\n\nIMPORTANTE: tu respuesta anterior no fue JSON válido. Responde ÚNICAMENTE con el objeto JSON pedido, sin texto antes ni después y sin bloques de código.");
  v = extractJson<T>(second.text);
  if (v) return { value: v, runId: second.runId };
  throw new OrchestratorError("invalid_json", "El modelo no devolvió JSON válido");
}

// ----------------------------------------------------------------- consultor
export async function runConsultant(projectId: string) {
  const db = createAdminClient();
  const { project, conversation, messages, images, docs, files } = await loadProject(db, projectId);
  if (project.status === "draft") await setStatus(db, project, "discovery");

  const { value } = await callJson<unknown>(db, project, conversation.id, "consultant", "consultant",
    consultantSystem(project.kind),
    consultantUser({ kind: project.kind, idea: project.initial_idea, brief: project.brief, messages: transcript(messages), images, docs, files }));
  const out: ConsultantOutput | null = normalizeConsultant(value);
  if (!out) throw new OrchestratorError("invalid_json", "Respuesta del consultor no válida");

  const brief = { ...((project.brief as Record<string, unknown>) ?? {}), ...(out.brief ?? {}) } as Json;
  await db.from("projects").update({ brief }).eq("id", project.id);
  await postAssistant(db, conversation.id, out.reply, "consultant", {
    question: out.ready ? null : (out.question as unknown as Json),
    progress: (out.progress ?? null) as unknown as Json,
  });
  await event(db, project.id, out.ready ? "consultant.ready" : "consultant.question", { step: out.progress?.step ?? null });

  if (out.ready) {
    project.brief = brief;
    await runArchitectAndProposal(db, project, conversation.id, { images, docs, files });
  }
  return { ready: out.ready };
}

// ----------------------------------------------------------------- arquitecto + propuesta
async function runArchitectAndProposal(db: Admin, project: Project, conversationId: string, refs: { images: ImageRef[]; docs: DocRef[]; files: FileRef[] }) {
  await setStatus(db, project, "specification");
  const { value: spec, runId } = await callJson<SpecLike>(db, project, conversationId, "architect", "architect",
    architectSystem(project.kind), architectUser({ brief: project.brief, idea: project.initial_idea, ...refs }));
  if (!spec || !spec.pages) throw new OrchestratorError("invalid_json", "Especificación no válida");

  const { data: prev } = await db.from("specifications").select("version").eq("project_id", project.id).order("version", { ascending: false }).limit(1);
  const version = (prev?.[0]?.version ?? 0) + 1;
  const { data: specRow } = await db.from("specifications").insert({ project_id: project.id, version, content: spec as unknown as Json, run_id: runId }).select("*").single();
  await event(db, project.id, "specification.created", { version });

  const { data: plans } = await db.from("pricing_plans").select("*").eq("is_active", true);
  const currency = await getSetting<string>(db, "default_currency", "USD");
  const draft = buildProposal(spec, plans ?? [], currency);
  await db.from("proposals").update({ status: "expired" }).eq("project_id", project.id).eq("status", "sent");
  const { data: proposal } = await db.from("proposals").insert({
    project_id: project.id, specification_id: specRow!.id, plan_key: draft.plan_key, complexity: draft.complexity, title: draft.title, summary: draft.summary,
    items: draft.items as unknown as Json, estimated_days: draft.estimated_days, price: draft.price, currency: draft.currency,
    external_costs: draft.external_costs as unknown as Json, maintenance_option: draft.maintenance_option as unknown as Json, status: "sent",
  }).select("*").single();
  await db.from("projects").update({ complexity: draft.complexity }).eq("id", project.id);
  await event(db, project.id, "proposal.sent", { proposal_id: proposal!.id });

  const requireApproval = await getSetting<boolean>(db, "require_proposal_approval", true);
  if (requireApproval) {
    await setStatus(db, project, "proposal");
    await postAssistant(db, conversationId,
      `He definido la estructura de «${spec.name ?? project.name}» y preparado la propuesta: ${draft.items.length} entregables, unos ${draft.estimated_days} días de trabajo${draft.price != null ? ` y un precio de ${draft.price} ${draft.currency}` : " (precio según alcance; te lo confirmamos antes de empezar)"}. Revísala en la pestaña Propuesta y, si estás de acuerdo, apruébala para que el desarrollador construya la primera versión.`,
      "architect", { proposal_id: proposal!.id });
  } else {
    await setStatus(db, project, "approved");
    await runBuild(project.id, "Primera versión");
  }
}

// ----------------------------------------------------------------- aprobación → construcción
export async function approveProposal(projectId: string, proposalId: string, userId: string) {
  const db = createAdminClient();
  const { data: proposal } = await db.from("proposals").select("*").eq("id", proposalId).eq("project_id", projectId).maybeSingle();
  if (!proposal || proposal.status !== "sent") throw new OrchestratorError("invalid_state", "La propuesta no está pendiente de aprobación");
  await db.from("proposals").update({ status: "approved", approved_by: userId, approved_at: new Date().toISOString() }).eq("id", proposalId);
  const { data: project } = await db.from("projects").select("*").eq("id", projectId).single();
  await event(db, projectId, "proposal.approved", { proposal_id: proposalId });
  await setStatus(db, project!, "approved");
  await runBuild(projectId, "Primera versión");
}

export async function runBuild(projectId: string, label: string) {
  const db = createAdminClient();
  const { project, conversation, images, docs, files } = await loadProject(db, projectId);
  const { data: specs } = await db.from("specifications").select("*").eq("project_id", projectId).order("version", { ascending: false }).limit(1);
  const spec = specs?.[0]?.content as SpecLike | undefined;
  if (!spec) throw new OrchestratorError("invalid_state", "No hay especificación");

  await setStatus(db, project, "in_development");
  const res = await callModel(db, project, conversation.id, "developer", "developer", developerSystem(project.kind), developerUser({ spec, images, docs, files }));
  const html = cleanHtml(res.text);
  if (!isCompleteHtml(html) || res.truncated) {
    await setStatus(db, project, "approved");
    await postAssistant(db, conversation.id, "La generación se cortó antes de completar el producto. Pulsa «Reintentar construcción» o pide una versión más sencilla.", "developer", { retry: "build" });
    throw new OrchestratorError("truncated", "HTML incompleto");
  }
  await commitVersion(db, project, conversation.id, html, label, res.runId, { imageIds: images.map((i) => i.id), fileIds: files.map((f) => f.id) });
}

async function commitVersion(db: Admin, project: Project, conversationId: string, html: string, summary: string, runId: string, refs: { imageIds: string[]; fileIds: string[] }) {
  const qa = runQa(html, { app: isAppKind(project.kind), ...refs });
  const s = qaSummary(qa);
  await db.from("agent_runs").insert({ project_id: project.id, conversation_id: conversationId, agent_type: "qa", step: "qa", provider: "ideon", status: "succeeded", started_at: new Date().toISOString(), finished_at: new Date().toISOString(), output: s as unknown as Json });

  const { data: prev } = await db.from("project_versions").select("number").eq("project_id", project.id).order("number", { ascending: false }).limit(1);
  const number = (prev?.[0]?.number ?? 0) + 1;
  const { data: version } = await db.from("project_versions").insert({ project_id: project.id, number, summary, run_id: runId, qa_report: qa as unknown as Json }).select("*").single();
  await db.from("project_files").insert({ version_id: version!.id, path: "index.html", content: html, content_type: "text/html", size: html.length });
  await db.from("projects").update({ current_version_id: version!.id }).eq("id", project.id);
  await setStatus(db, project, "review", { current_version_id: version!.id });
  await event(db, project.id, "version.created", { number, qa: s as unknown as Json });
  await postAssistant(db, conversationId,
    (s.bad ? `Versión v${number} lista, con ${s.bad} punto${s.bad > 1 ? "s" : ""} a revisar en QA. ` : `Versión v${number} lista y verificada (${s.ok}/${s.total} comprobaciones). `) +
    (isAppKind(project.kind) ? "Pruébala en la vista previa y dime qué cambiar: campos, módulos, reportes o flujos." : "Mírala en la vista previa y dime qué cambiar: textos, colores, secciones o fotos."),
    "qa", { version_id: version!.id, qa: s as unknown as Json });
  return version!;
}

// ----------------------------------------------------------------- modificaciones
export async function runModify(projectId: string, instruction: string) {
  const db = createAdminClient();
  const { project, conversation, messages, images, docs, files } = await loadProject(db, projectId);
  if (!project.current_version_id) throw new OrchestratorError("invalid_state", "No hay versión que modificar");
  const { data: version } = await db.from("project_versions").select("*").eq("id", project.current_version_id).single();
  const { data: file } = await db.from("project_files").select("content").eq("version_id", version!.id).eq("path", "index.html").single();

  const recent = transcript(messages).slice(-9, -1);
  const res = await callModel(db, project, conversation.id, "modify", "developer", modifySystem(project.kind),
    modifyUser({ recent, instruction, html: file!.content, versionNumber: version!.number, images, docs, files }));
  const { reply, html } = parseModifyOutput(res.text);
  if (html) {
    if (!isCompleteHtml(html) || res.truncated) {
      await postAssistant(db, conversation.id, "El cambio no pudo completarse (la respuesta se cortó). Pide un cambio más acotado.", "developer");
      throw new OrchestratorError("truncated", "HTML incompleto");
    }
    await postAssistant(db, conversation.id, reply, "developer");
    await commitVersion(db, project, conversation.id, html, instruction.slice(0, 80), res.runId, { imageIds: images.map((i) => i.id), fileIds: files.map((f) => f.id) });
  } else {
    await postAssistant(db, conversation.id, reply, "developer");
  }
}

/** Punto de entrada tras un mensaje del cliente: decide qué agente actúa. */
export async function handleUserMessage(projectId: string) {
  const db = createAdminClient();
  const { project, messages } = await loadProject(db, projectId);
  const last = [...messages].reverse().find((m) => m.role === "user");
  if (!last) return;
  if (project.current_version_id) return runModify(projectId, last.content);
  if (project.status === "proposal") return; // esperando aprobación: el mensaje queda registrado
  return runConsultant(projectId);
}
