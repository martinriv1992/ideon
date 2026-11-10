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

/**
 * Textos por sector: una pregunta concreta sobre su día a día y una frase de cómo ayudamos
 * (resultado, no lista de funciones). Se elige por palabras del sector o de la empresa.
 */
const SECTOR_COPY: { match: RegExp; asunto: string; pregunta: string; ayuda: string }[] = [
  { match: /odont|dental|ortodon|sonris/i, asunto: "citas sin confirmar", pregunta: "¿cuántas citas se les caen al mes porque nadie alcanzó a confirmarlas?", ayuda: "Ayudamos a consultorios a que el recordatorio y la confirmación salgan solos, sin que recepción tenga que perseguir a nadie." },
  { match: /pilates|yoga|gimnas|fitness|crossfit|entren/i, asunto: "clases y paquetes", pregunta: "¿cómo saben hoy cuántas clases le quedan a cada alumno?", ayuda: "Ayudamos a estudios como el suyo a llevar reservas, paquetes y vencimientos sin hojas de cálculo." },
  { match: /cl[ií]nic|consultorio|m[eé]dic|salud|fisio/i, asunto: "agenda de pacientes", pregunta: "¿cómo hacen hoy para que ningún paciente se quede sin su próximo control?", ayuda: "Ayudamos a centros de salud a tener agenda, recordatorios y controles en un solo lugar." },
  { match: /barber|peluq|belleza|est[eé]tica|spa|u[ñn]as|nails|capilar|sal[oó]n/i, asunto: "reservas por WhatsApp", pregunta: "¿cuántos mensajes de reserva contestan al día entre un cliente y otro?", ayuda: "Ayudamos a salones a que los clientes reserven solos y reciban su recordatorio." },
  { match: /veterin|mascota|pet/i, asunto: "recordatorios de vacunas", pregunta: "¿cómo le avisan hoy a cada dueño que toca vacuna o control?", ayuda: "Ayudamos a veterinarias a que esos recordatorios salgan solos y la historia de cada mascota esté a la mano." },
  { match: /distribu|mayorist|comerciali|alimentos|licores|aseo/i, asunto: "pedidos de los vendedores", pregunta: "¿cómo les llegan hoy los pedidos de los vendedores a bodega?", ayuda: "Ayudamos a distribuidoras a recibir pedidos y ver el inventario al instante, sin pasar todo a Excel." },
  { match: /ferret|construc|materiales|el[eé]ctric/i, asunto: "inventario y cotizaciones", pregunta: "¿cuánto tiempo se les va armando una cotización con tantas referencias?", ayuda: "Ayudamos a ferreterías a cotizar en minutos y a saber qué se está agotando antes de que pase." },
  { match: /agencia|marketing|dise[ñn]o|branding|publicidad|creativ/i, asunto: "una idea para tus clientes", pregunta: "¿qué hacen hoy cuando un cliente les pide un sistema o una app, además de la web?", ayuda: "Desarrollamos CRM, inventarios y apps en marca blanca para agencias: ustedes venden, nosotros construimos." },
  { match: /restaur|caf[eé]|cocina|comida|panader|helad/i, asunto: "costos por plato", pregunta: "¿saben hoy cuánto les cuesta de verdad cada plato?", ayuda: "Ayudamos a restaurantes a conectar pedidos, recetas e inventario para que el costo real salga solo." },
  { match: /inmobil|arriendo|propiedad/i, asunto: "seguimiento de interesados", pregunta: "¿dónde queda registrado cada interesado que pregunta por un inmueble?", ayuda: "Ayudamos a inmobiliarias a que ningún interesado se quede sin seguimiento." },
];
const GENERIC = { asunto: "una pregunta rápida", pregunta: "¿qué parte de la operación sigue dependiendo de Excel o de WhatsApp?", ayuda: "Armamos sistemas a la medida para que eso deje de depender de hojas de cálculo y mensajes sueltos." };
export function sectorCopy(lead: Pick<Lead, "sector" | "empresa">) {
  const txt = `${lead.sector ?? ""} ${lead.empresa ?? ""}`;
  return SECTOR_COPY.find((c) => c.match.test(txt)) ?? GENERIC;
}

/**
 * Mensaje de plantilla (sin IA). Corto, con una sola pregunta y sin frases de catálogo;
 * el «pago único» va como posdata en los correos.
 */
export function templateMessage(lead: Lead, paso: number, canal: Canal, firma: string): { asunto: string; texto: string } {
  const c = sectorCopy(lead);
  const empresa = lead.empresa || "su negocio";
  const nombre = lead.nombre ? lead.nombre.split(" ")[0] : "";
  const hola = nombre ? `Hola, ${nombre}` : "Hola, ¿qué tal?";
  const firmaTxt = `${firma}\nIdeonapp`;
  const pd = "P. D.: es pago único; el sistema queda a nombre de ustedes, sin licencias.";
  if (canal === "WhatsApp") {
    const t = [
      `Hola${nombre ? ` ${nombre}` : ""}, soy ${firma} de Ideonapp. Una pregunta rápida para ${empresa}: ${c.pregunta}`,
      `Hola${nombre ? ` ${nombre}` : ""}, soy ${firma} de Ideonapp otra vez. ${c.ayuda} Si te sirve, te mando un video corto con un ejemplo.`,
      `Hola${nombre ? ` ${nombre}` : ""}, ¿les sirve que les muestre en 15 minutos cómo quedaría para ${empresa}? Sin compromiso.`,
      `Hola${nombre ? ` ${nombre}` : ""}, no te escribo más para no llenarte el chat 🙂 Si en algún momento lo quieren ver, aquí estoy. ¡Éxitos!`,
    ];
    return { asunto: "", texto: t[Math.min(paso, t.length - 1)] };
  }
  const subj = [c.asunto, `re: ${c.asunto}`, "un ejemplo concreto", "¿lo dejamos para después?"];
  const body = [
    `${hola}\n\nUna pregunta rápida sobre ${empresa}: ${c.pregunta}\n\nLo pregunto porque ${c.ayuda.charAt(0).toLowerCase()}${c.ayuda.slice(1)}\n\n¿Te muestro un ejemplo en 15 minutos?\n\n${firmaTxt}\n\n${pd}`,
    `${hola}\n\nTe escribí hace unos días sobre esto. Para que sea concreto: en 2 a 4 semanas les podemos tener funcionando algo así, con su marca y acceso para todo el equipo.\n\n¿Te mando un video corto con un ejemplo?\n\n${firmaTxt}`,
    `${hola}\n\nAsí trabajaríamos: una llamada de 20 minutos para entender cómo operan, una propuesta con precio cerrado y una primera versión funcionando en pocas semanas.\n\n¿Te queda bien una llamada esta semana?\n\n${firmaTxt}\n\n${pd}`,
    `${hola}\n\nNo quiero llenarte el correo, así que este es el último. Si más adelante quieren verlo, respóndeme y lo retomamos.\n\n¡Éxitos!\n\n${firmaTxt}`,
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
