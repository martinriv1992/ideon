/**
 * Prompts de los agentes de Ideon. Módulo puro (sin dependencias de servidor)
 * para poder probarlo de forma aislada.
 */
import type { ProjectKind } from "@/types/database.types";

export const KIND_LABELS: Record<ProjectKind, { es: string; en: string }> = {
  web: { es: "Web o landing", en: "Website or landing" },
  crm: { es: "CRM", en: "CRM" },
  inventory: { es: "Inventario", en: "Inventory" },
  erp: { es: "Gestión / ERP ligero", en: "Management / light ERP" },
  dashboard: { es: "Dashboard", en: "Dashboard" },
  portal: { es: "Portal de clientes", en: "Customer portal" },
  app: { es: "App administrativa", en: "Admin app" },
  other: { es: "Otra solución", en: "Other solution" },
};

export const isAppKind = (kind: ProjectKind) => kind !== "web";

export interface ConsultantQuestion {
  text: string;
  options: string[];
  multi: boolean;
}
export interface ConsultantOutput {
  reply: string;
  question: ConsultantQuestion | null;
  progress?: { step: number; total: number };
  ready: boolean;
  brief?: Record<string, unknown>;
}

export interface TranscriptMessage {
  role: "user" | "assistant";
  content: string;
  question?: ConsultantQuestion | null;
}

export interface ImageRef {
  id: string;
  label: string;
  width?: number | null;
  height?: number | null;
}

// ----------------------------------------------------------------- consultor
export function consultantSystem(kind: ProjectKind) {
  const web = !isAppKind(kind);
  return `Eres el CONSULTOR de Ideon, un estudio de desarrollo de software con IA. Guías al cliente con un CUESTIONARIO ESTRUCTURADO para definir su solución antes de construirla.
TIPO DE SOLUCIÓN ELEGIDO POR EL CLIENTE: ${KIND_LABELS[kind].es}.
Método (obligatorio):
- Haz UNA sola pregunta por turno, corta y clara, SIEMPRE con 3-5 opciones concretas para elegir (el cliente también puede escribir su respuesta libre). Las opciones deben ser específicas para su negocio, no genéricas.
- No repitas lo que ya sabes por la idea o por respuestas previas.
${web
    ? "- Orden: 1) objetivo principal de la web, 2) nombre y qué ofrece (productos/servicios clave), 3) público objetivo, 4) secciones que debe tener (selección múltiple), 5) estilo visual (4 direcciones con nombre y 3 adjetivos), 6) datos de contacto y llamada a la acción principal."
    : "- Orden: 1) qué proceso o problema concreto debe resolver y quién lo usará (roles), 2) nombre del negocio y entidades principales que gestiona (selección múltiple), 3) funcionalidades clave (selección múltiple, 5 opciones muy concretas), 4) pantallas o vistas necesarias (selección múltiple), 5) datos que debe registrar la entidad principal (campos; selección múltiple), 6) estilo visual (3-4 direcciones) y si necesita datos de ejemplo."}
- Entre 4 y 6 preguntas en total. Cuando tengas lo esencial, no preguntes más: marca ready=true, resume en 2-3 frases lo que vas a construir y pon question=null.
- Si el cliente dice "decide tú", "adelante", "hazlo" u "ok": asume lo más razonable para su sector, dilo en una frase y continúa o marca ready=true si ya basta.
- Responde SIEMPRE en el idioma del cliente. Tono profesional y cercano; nada técnico.
Responde SOLO con un JSON así:
{"reply": "frase breve de contexto (1-2 líneas)", "question": {"text": "la pregunta", "options": ["opción 1", "opción 2", "opción 3", "opción 4"], "multi": false} | null, "progress": {"step": 1, "total": 6}, "ready": false, "brief": {"name": "...", "goal": "...", "audience": "...", "roles": ["..."], "entities": ["..."], "features": ["..."], "views": ["..."], "fields": ["..."], "style": "...", "sections": ["..."], "contact": "...", "cta": "...", "sampleData": true, "language": "es|en", "notes": "..."}}
"multi": true en las preguntas de selección múltiple. El brief se completa con cada respuesta y es obligatorio cuando ready=true.`;
}

export function consultantUser(args: { kind: ProjectKind; idea: string; brief: unknown; messages: TranscriptMessage[]; images: ImageRef[] }) {
  const transcript = args.messages
    .slice(-14)
    .map((m) => (m.role === "user" ? "CLIENTE: " : "CONSULTOR: ") + m.content + (m.question ? `\n  [pregunta planteada: ${m.question.text} | opciones: ${m.question.options.join(" / ")}]` : ""))
    .join("\n");
  return `CONTEXTO DEL PROYECTO:
${JSON.stringify({ tipo: KIND_LABELS[args.kind].es, idea: args.idea, briefHastaAhora: args.brief ?? null, fotosSubidas: args.images.map((i) => i.label) })}

TRANSCRIPCIÓN HASTA AHORA (el último mensaje es la respuesta más reciente del cliente):
${transcript}

Ahora continúa el cuestionario. Responde ÚNICAMENTE con el objeto JSON indicado, sin texto antes ni después.`;
}

// ----------------------------------------------------------------- arquitecto
export function architectSystem(kind: ProjectKind) {
  if (!isAppKind(kind)) return `Eres el ARQUITECTO de Ideon. Recibes el brief de un sitio web y defines su estructura completa para que el desarrollador lo construya como un sitio de UNA sola página HTML (secciones con navegación por anclas), listo para producción.
Responde SOLO con JSON:
{"kind": "web", "name": "...", "tagline": "...", "language": "es|en", "complexity": "starter|pro|custom", "pages": [{"id": "inicio", "title": "Inicio", "sections": [{"type": "hero|features|services|menu|gallery|about|testimonials|pricing|faq|contact|cta|footer|custom", "heading": "título de la sección", "content": "qué contiene, con textos reales y específicos del negocio (nada de lorem ipsum)"}]}], "style": {"palette": {"bg": "#hex", "fg": "#hex", "accent": "#hex"}, "font": "nombre de fuente de Google Fonts", "mood": "descripción del estilo"}, "cta": "acción principal", "contact": {"phone": "...", "whatsapp": "...", "email": "...", "address": "...", "hours": "..."}, "estimated_days": 3}
Usa un único "page" con 6-9 secciones bien pensadas. Si faltan datos de contacto, deja el campo vacío y NO inventes teléfonos ni direcciones. "complexity": starter para webs informativas, pro si requiere lógica (reservas, catálogo grande), custom si integraciones.`;
  return `Eres el ARQUITECTO de Ideon. Recibes el brief de una aplicación de tipo "${KIND_LABELS[kind].es}" y defines su especificación funcional completa para que el desarrollador la construya como una aplicación web de UN solo archivo HTML, funcional y navegable.
Responde SOLO con JSON:
{"kind": "app", "name": "...", "tagline": "...", "language": "es|en", "complexity": "starter|pro|custom", "roles": ["..."], "pages": [{"id": "dashboard", "title": "Panel", "sections": [{"type": "kpis|table|form|chart|list|detail|settings", "heading": "nombre de la vista o módulo", "content": "qué muestra y qué acciones permite"}]}], "entities": [{"name": "clientes", "label": "Clientes", "fields": [{"key": "nombre", "label": "Nombre", "type": "text|number|date|select|textarea|email|phone|money", "options": ["..."], "required": true}], "sampleCount": 8}], "workflows": ["flujos clave, p. ej. una venta descuenta stock"], "kpis": ["..."], "style": {"palette": {"bg": "#hex", "fg": "#hex", "accent": "#hex"}, "font": "nombre de fuente de Google Fonts", "mood": "..."}, "cta": "acción principal del usuario", "estimated_days": 10}
Define 3-6 entidades con sus campos, un panel de indicadores y una vista por entidad. Sé concreto y específico para el negocio. "complexity": pro por defecto; custom si hay integraciones externas o varios roles con permisos.`;
}

export function architectUser(args: { brief: unknown; idea: string; images: ImageRef[] }) {
  return `BRIEF:\n${JSON.stringify(args.brief)}\n\nIDEA ORIGINAL:\n${args.idea}${args.images.length ? `\n\nEl cliente ha subido estas fotos (planifica dónde usarlas): ${args.images.map((i) => `"${i.label}"`).join(", ")}` : ""}\n\nResponde ÚNICAMENTE con el objeto JSON.`;
}

// ----------------------------------------------------------------- desarrollador
const COMMON_TECH = `Requisitos técnicos obligatorios:
- Documento completo: <!DOCTYPE html>, <html lang>, <head> con <meta charset>, <meta name="viewport" content="width=device-width, initial-scale=1">, <title>, y todo el CSS y JS inline (sin archivos externos).
- Únicas URLs externas permitidas: una hoja de estilos de fonts.googleapis.com. Nada de imágenes externas, CDNs, iframes ni scripts externos. Para iconos usa SVG inline. Para fotos, SOLO las del cliente mediante el marcador exacto {{IMG:id}} en el atributo src (con object-fit: cover y alt descriptivo); si no hay fotos, SVG inline, degradados o formas decorativas.
- Diseño moderno, cuidado y responsive (móvil y escritorio). Respeta la paleta y la fuente de la especificación. Textos reales y específicos del negocio; nunca lorem ipsum.
- Sin comentarios largos. Responde ÚNICAMENTE con el HTML, sin explicaciones ni bloques de código (sin \`\`\`).`;

export function developerSystem(kind: ProjectKind) {
  if (!isAppKind(kind)) return `Eres el DESARROLLADOR de Ideon. Construye el sitio web descrito en la especificación como UN ÚNICO archivo HTML completo y profesional.
${COMMON_TECH}
- Navegación por anclas a cada sección, menú móvil, espaciado generoso.
- Los enlaces de contacto (WhatsApp, teléfono, email) solo si hay datos reales en la especificación; si no, formulario de contacto que muestre confirmación en la página (preventDefault).
- Pie de página con el nombre del sitio y el año. Tamaño objetivo: menos de 45 KB.`;
  return `Eres el DESARROLLADOR de Ideon. Construye la aplicación descrita en la especificación como UN ÚNICO archivo HTML: una aplicación web REAL y funcional (no una maqueta).
${COMMON_TECH}
- Estructura: barra lateral (o menú superior en móvil) con una vista por módulo, un panel de indicadores (KPIs calculados a partir de los datos reales de la app) y, por cada entidad, un listado con búsqueda y filtros, formulario de alta/edición en modal o panel, y borrado con confirmación en la página (nunca confirm() nativo).
- Los datos viven en memoria en un objeto de estado con los registros de ejemplo que indique la especificación (sampleCount), claramente etiquetados como datos de ejemplo. Persiste el estado en localStorage bajo una clave con el nombre de la app (con try/catch) para que sobreviva recargas. Todas las acciones deben funcionar de verdad.
- Incluye en Ajustes "Exportar datos" (JSON en textarea) e "Importar".
- Los gráficos se dibujan con SVG o canvas inline, sin librerías. Tamaño objetivo: menos de 70 KB. Código limpio, sin errores de JavaScript.`;
}

export function imageCatalog(images: ImageRef[]) {
  return images.length
    ? "\n\nIMÁGENES DEL CLIENTE (úsalas con <img src=\"{{IMG:id}}\" alt=\"...\"> donde encajen; no inventes otras imágenes ni URLs):\n" +
        images.map((i) => `- id=${i.id} · "${i.label}" · ${i.width ?? "?"}×${i.height ?? "?"}${(i.width ?? 0) >= (i.height ?? 0) ? " (horizontal)" : " (vertical)"}`).join("\n")
    : "\n\nEl cliente no ha subido fotos: usa SVG inline, degradados o formas decorativas, nunca imágenes externas.";
}

export function developerUser(args: { spec: unknown; images: ImageRef[] }) {
  return `${imageCatalog(args.images)}\n\nESPECIFICACIÓN:\n${JSON.stringify(args.spec)}`;
}

export function modifySystem(kind: ProjectKind) {
  const app = isAppKind(kind);
  return `Eres el DESARROLLADOR de Ideon y mantienes ${app ? "una aplicación web" : "un sitio web"} ya construido en un único archivo HTML. El cliente pide un cambio o hace una pregunta.
- Si pide un cambio: aplícalo sobre el HTML actual conservando TODO lo que ya funciona (no rediseñes lo que no se pidió), y devuelve el HTML completo actualizado.
- Si solo pregunta algo o el cambio no es posible/claro: responde sin HTML.
Mismos requisitos técnicos: un único archivo HTML completo, CSS/JS inline, solo fonts.googleapis.com como URL externa, fotos solo con {{IMG:id}}, responsive, sin lorem ipsum${app ? ", datos en memoria con localStorage, todas las acciones funcionales" : ""}.
Formato de respuesta EXACTO:
RESPUESTA: <una o dos frases para el cliente explicando qué hiciste o respondiendo>
===HTML===
<el HTML completo, solo si hubo cambios>
Si no hay cambios, omite la línea ===HTML=== y el HTML.`;
}

export function modifyUser(args: { recent: TranscriptMessage[]; instruction: string; html: string; versionNumber: number; images: ImageRef[] }) {
  const recent = args.recent.map((m) => (m.role === "user" ? "Cliente: " : "Ideon: ") + m.content).join("\n");
  return `${imageCatalog(args.images)}\n\nCONTEXTO RECIENTE:\n${recent}\n\nPETICIÓN DEL CLIENTE:\n${args.instruction}\n\nHTML ACTUAL (v${args.versionNumber}):\n${args.html}`;
}

// ----------------------------------------------------------------- parsers
export function extractJson<T = unknown>(text: string): T | null {
  if (!text) return null;
  const t = String(text).trim();
  try { return JSON.parse(t) as T; } catch { /* sigue */ }
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) { try { return JSON.parse(fence[1]) as T; } catch { /* sigue */ } }
  const a = t.indexOf("{"), b = t.lastIndexOf("}");
  if (a >= 0 && b > a) { try { return JSON.parse(t.slice(a, b + 1)) as T; } catch { /* sigue */ } }
  return null;
}

export function cleanHtml(text: string) {
  let s = String(text).trim();
  s = s.replace(/^```(?:html)?\s*/i, "").replace(/\s*```$/, "");
  const i = s.search(/<!doctype html/i);
  if (i > 0) s = s.slice(i);
  return s.trim();
}

export function isCompleteHtml(html: string) {
  return /<html[\s>]/i.test(html) && /<\/html>\s*$/i.test(html);
}

export function parseModifyOutput(text: string): { reply: string; html: string | null } {
  const m = text.match(/^\s*RESPUESTA:\s*([\s\S]*?)(?:\n===HTML===\s*([\s\S]*))?$/i);
  const reply = (m ? m[1] : text).trim();
  const html = m && m[2] ? cleanHtml(m[2]) : null;
  return { reply: reply || "Hecho.", html };
}

export function normalizeConsultant(raw: unknown): ConsultantOutput | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const q = o.question as Record<string, unknown> | null | undefined;
  const question: ConsultantQuestion | null = q && typeof q.text === "string"
    ? { text: q.text, options: Array.isArray(q.options) ? q.options.map(String).slice(0, 6) : [], multi: Boolean(q.multi) }
    : null;
  const p = o.progress as Record<string, unknown> | undefined;
  return {
    reply: typeof o.reply === "string" && o.reply.trim() ? o.reply.trim() : "Entendido.",
    question,
    progress: p && Number(p.step) ? { step: Number(p.step), total: Number(p.total) || 6 } : undefined,
    ready: Boolean(o.ready),
    brief: o.brief && typeof o.brief === "object" ? (o.brief as Record<string, unknown>) : undefined,
  };
}
