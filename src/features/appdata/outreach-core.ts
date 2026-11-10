/**
 * Cadencias automáticas de contacto (núcleo puro, sin red ni base de datos).
 * Las usan el motor del servidor (outreach.ts) y las pruebas.
 *
 * Datos de la app (colecciones de Ideon Data):
 * - settings/outreach: configuración (activo, modo, límite diario, remitente…).
 * - settings/templates: cadencia [{dia, canal, texto}] (el texto es una guía).
 * - leads: prospectos. outreach: un registro por prospecto y paso («o_<lead>_<paso>»).
 */

export type Canal = "Correo" | "WhatsApp";
export type ItemEstado = "borrador" | "aprobado" | "enviado" | "whatsapp" | "omitido" | "error";

export interface OutreachConfig {
  activo: boolean;
  modo: "aprobacion" | "auto";
  limiteDiario: number;
  fitMin: number;
  remitente: string;
  responderA: string;
  firma: string;
}
export const DEFAULT_OUTREACH: OutreachConfig = { activo: false, modo: "aprobacion", limiteDiario: 20, fitMin: 50, remitente: "Martín de Ideonapp", responderA: "", firma: "Martín" };

export interface CadStep { dia: number; canal: Canal; texto?: string }
export interface Lead {
  id: string; nombre?: string; empresa?: string; correo?: string; telefono?: string; etapa?: string; fit?: number | null; baja?: boolean;
  ciudad?: string; sector?: string; dolor?: string; angulo?: string;
}
export interface Item { id: string; leadId: string; paso: number; canal: Canal; estado: ItemEstado; asunto?: string; texto?: string; enviadoEn?: string | null; creado?: string }

/** Etapas en las que la cadencia se detiene (el prospecto ya respondió o se cerró). */
export const STOP_STAGES = ["Respondió", "Reunión", "Propuesta", "Cliente", "Perdido"];
const EMAIL = /^[^\s@<>()[\]",;:]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/;
export const isEmail = (s?: string) => Boolean(s && EMAIL.test(s.trim()));
export const hasPhone = (s?: string) => (s ?? "").replace(/\D/g, "").length >= 7;

export function outreachConfigFrom(raw: unknown): OutreachConfig {
  const r = (raw && typeof raw === "object" ? raw : {}) as Partial<OutreachConfig>;
  const num = (v: unknown, d: number, min: number, max: number) => { const n = Number(v); return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : d; };
  return {
    activo: r.activo === true,
    modo: r.modo === "auto" ? "auto" : "aprobacion",
    limiteDiario: num(r.limiteDiario, DEFAULT_OUTREACH.limiteDiario, 1, 200),
    fitMin: num(r.fitMin, DEFAULT_OUTREACH.fitMin, 0, 100),
    remitente: String(r.remitente || DEFAULT_OUTREACH.remitente).replace(/[<>"\r\n]/g, "").slice(0, 60),
    responderA: isEmail(r.responderA) ? String(r.responderA).trim() : "",
    firma: String(r.firma || DEFAULT_OUTREACH.firma).slice(0, 60),
  };
}

export function cadenceFrom(raw: unknown): CadStep[] {
  const arr = (raw && typeof raw === "object" && Array.isArray((raw as { cadencia?: unknown }).cadencia) ? (raw as { cadencia: unknown[] }).cadencia : []) as Partial<CadStep>[];
  const steps = arr.map((s) => ({ dia: Math.max(0, Number(s.dia) || 0), canal: (s.canal === "Correo" ? "Correo" : "WhatsApp") as Canal, texto: s.texto ?? "" }))
    .sort((a, b) => a.dia - b.dia);
  return steps.length ? steps : [{ dia: 0, canal: "Correo" }, { dia: 3, canal: "WhatsApp" }, { dia: 7, canal: "Correo" }, { dia: 14, canal: "WhatsApp" }];
}

export const itemId = (leadId: string, paso: number) => `o_${leadId}_${paso}`.slice(0, 64);

/** Canal efectivo: el del paso, o el otro si el prospecto no tiene ese dato; null si no tiene ninguno. */
export function channelFor(step: CadStep, lead: Lead): Canal | null {
  if (step.canal === "Correo") return isEmail(lead.correo) ? "Correo" : hasPhone(lead.telefono) ? "WhatsApp" : null;
  return hasPhone(lead.telefono) ? "WhatsApp" : isEmail(lead.correo) ? "Correo" : null;
}

/**
 * Siguiente paso que toca para un prospecto, o null.
 * - Paso 0: solo prospectos «Nuevo», con encaje ≥ fitMin (o sin auditar si fitMin es 0) y algún canal.
 * - Pasos siguientes: cuando el anterior se envió y pasaron los días de la cadencia.
 * - Nunca si se dio de baja, si está en una etapa de parada o si tiene un paso pendiente.
 */
export function nextStep(lead: Lead, cad: CadStep[], items: Item[], cfg: OutreachConfig, now = new Date()): { paso: number; canal: Canal } | null {
  if (lead.baja || STOP_STAGES.includes(lead.etapa ?? "")) return null;
  const mine = items.filter((i) => i.leadId === lead.id).sort((a, b) => a.paso - b.paso);
  const last = mine[mine.length - 1];
  if (!last) {
    if ((lead.etapa ?? "Nuevo") !== "Nuevo") return null;
    if (cfg.fitMin > 0 && !(typeof lead.fit === "number" && lead.fit >= cfg.fitMin)) return null;
    const canal = channelFor(cad[0], lead);
    return canal ? { paso: 0, canal } : null;
  }
  if (last.estado !== "enviado" || !last.enviadoEn) return null;
  const k = last.paso + 1;
  if (k >= cad.length) return null;
  const waitDays = Math.max(1, cad[k].dia - cad[last.paso].dia);
  if (now.getTime() < new Date(last.enviadoEn).getTime() + waitDays * 86_400_000) return null;
  const canal = channelFor(cad[k], lead);
  return canal ? { paso: k, canal } : null;
}

const lc = (s: string) => s ? s.charAt(0).toLowerCase() + s.slice(1).replace(/\.\s*$/, "") : s;

/** Mensaje de plantilla (sin IA): usa el dolor y el ángulo de la auditoría si existen. */
export function templateMessage(lead: Lead, paso: number, canal: Canal, firma: string): { asunto: string; texto: string } {
  const empresa = lead.empresa || "tu negocio";
  const hola = lead.nombre ? `Hola, ${lead.nombre.split(" ")[0]}` : `Hola, equipo de ${empresa}`;
  const solucion = lead.angulo ? lc(lead.angulo) : "agenda, pedidos, inventario o un CRM, según lo que más tiempo les quite hoy";
  const gancho = lead.dolor
    ? `Te escribo porque creo que podemos ayudarles con algo concreto: ${lc(lead.dolor)}.`
    : `Ayudamos a negocios${lead.sector ? ` de ${lc(lead.sector)}` : ""}${lead.ciudad ? ` en ${lead.ciudad}` : ""} a dejar de operar con Excel y WhatsApp.`;
  const pago = "Es pago único: el sistema queda a nombre de ustedes, sin licencias ni cobro por usuario.";
  const firmaTxt = `${firma}\nIdeonapp · ideonapp.com`;
  if (canal === "WhatsApp") {
    const t = [
      `${hola} 👋 Soy ${firma}, de Ideonapp. ${gancho} Hacemos software a la medida (${solucion}). ${pago} ¿Te cuento cómo quedaría para ${empresa}?`,
      `${hola}, te escribí hace unos días. Un ejemplo de lo que podríamos montarles en 2 a 4 semanas: ${solucion}. ¿Te mando una demo corta?`,
      `${hola}. Te dejo una idea concreta para ${empresa}: ${solucion}, con presupuesto cerrado y pago único. ¿Lo vemos en una llamada de 15 minutos?`,
      `${hola}, último mensaje para no molestar 🙂 Si en algún momento quieren ordenar ${lead.dolor ? lc(lead.dolor) : "su operación"} con un sistema propio, aquí estoy. ¡Éxitos!`,
    ];
    return { asunto: "", texto: t[Math.min(paso, t.length - 1)] };
  }
  const subj = [`${empresa}: una idea para ahorrar tiempo`, `Ejemplo para ${empresa}`, `Mini propuesta para ${empresa}`, `¿Lo dejamos para más adelante?`];
  const body = [
    `${hola}:\n\n${gancho}\n\nEn Ideonapp hacemos software a la medida: ${solucion}. ${pago}\n\n¿Te muestro en 15 minutos cómo quedaría para ${empresa}?\n\n${firmaTxt}`,
    `${hola}:\n\nTe escribí hace unos días. Para que sea concreto: en 2 a 4 semanas podríamos tenerles ${solucion}, con su marca y acceso para todo el equipo.\n\n¿Te mando una demo de algo parecido que ya tenemos funcionando?\n\n${firmaTxt}`,
    `${hola}:\n\nTe comparto cómo trabajaríamos con ${empresa}:\n\n1. Una llamada de 20 minutos para entender cómo operan hoy.\n2. Una propuesta con alcance, plazo y precio cerrado.\n3. Una primera versión funcionando en pocas semanas.\n\n${pago}\n\n¿Agendamos la llamada?\n\n${firmaTxt}`,
    `${hola}:\n\nNo quiero llenarte el correo, así que este es mi último mensaje. Si más adelante quieren un sistema propio para ${lead.dolor ? lc(lead.dolor) : "ordenar su operación"}, respóndeme y lo retomamos.\n\n¡Éxitos!\n\n${firmaTxt}`,
  ];
  const i = Math.min(paso, body.length - 1);
  return { asunto: subj[i], texto: body[i] };
}

/** Correo en HTML a partir del texto plano, con pie para darse de baja. */
export function emailHtml(texto: string, unsubscribeUrl: string) {
  const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
  const paras = texto.split(/\n{2,}/).map((p) => `<p style="margin:0 0 14px">${esc(p).replace(/\n/g, "<br>")}</p>`).join("");
  return `<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;font-size:15px;line-height:1.55;color:#111;max-width:560px">${paras}<p style="margin:28px 0 0;font-size:12px;color:#888">Si prefieres no recibir más mensajes, <a href="${esc(unsubscribeUrl)}" style="color:#888">date de baja aquí</a>.</p></div>`;
}
