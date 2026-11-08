/* eslint-disable @typescript-eslint/no-unused-expressions */
/**
 * Agente QA: comprobaciones estáticas reales sobre el HTML generado.
 * Módulo puro (usa node-html-parser), probado de forma aislada.
 */
import { parse } from "node-html-parser";

export type QaLevel = "ok" | "warn" | "bad";
export interface QaCheck { level: QaLevel; text: string }

/**
 * Errores de sintaxis de los scripts en línea (se compilan sin ejecutarse). Un
 * error aquí deja la aplicación en blanco aunque el HTML sea correcto.
 */
export function jsSyntaxErrors(html: string): string[] {
  const errors: string[] = [];
  for (const m of html.matchAll(/<script(?![^>]*\bsrc=)([^>]*)>([\s\S]*?)<\/script>/gi)) {
    const attrs = m[1]; const code = m[2];
    if (/type\s*=\s*["']?(module|application\/(ld\+)?json|text\/template)/i.test(attrs) || !code.trim()) continue;
    try { new Function(code); } catch (e) { if (e instanceof SyntaxError) errors.push(e.message); }
  }
  return errors;
}

export function runQa(html: string, opts: { app: boolean; imageIds: string[]; fileIds?: string[] }): QaCheck[] {
  const out: QaCheck[] = [];
  const ok = (t: string) => out.push({ level: "ok", text: t });
  const warn = (t: string) => out.push({ level: "warn", text: t });
  const bad = (t: string) => out.push({ level: "bad", text: t });

  let doc: ReturnType<typeof parse>;
  try { doc = parse(html); } catch { bad("El HTML no se pudo analizar."); return out; }

  const title = doc.querySelector("title")?.text?.trim();
  title ? ok(`Título definido: «${title}»`) : bad("Falta <title>.");
  doc.querySelector('meta[name="viewport"]') ? ok("Meta viewport presente (responsive).") : bad("Falta la meta viewport.");
  doc.querySelector("html")?.getAttribute("lang") ? ok("Idioma declarado en <html lang>.") : warn("No se declara el idioma del documento.");
  // Las aplicaciones generan parte de su interfaz con JavaScript: se busca también en los scripts.
  const h1 = opts.app ? Math.max(doc.querySelectorAll("h1").length, (html.match(/<h1[\s>]/gi) ?? []).length) : doc.querySelectorAll("h1").length;
  h1 === 1 ? ok("Un único H1.") : h1 === 0 ? (opts.app ? warn("No se detecta un H1.") : bad("No hay H1.")) : warn(`Hay ${h1} H1; se recomienda uno.`);

  const ext = doc.querySelectorAll("script[src],img[src],link[href],iframe[src]")
    .map((e) => e.getAttribute("src") || e.getAttribute("href") || "")
    .filter((u) => /^https?:/i.test(u) && !/fonts\.googleapis\.com/.test(u));
  ext.length ? bad(`Recursos externos no permitidos: ${ext.length} (${ext[0]}).`) : ok("Sin recursos externos (solo Google Fonts).");

  const imgSrcs = doc.querySelectorAll("img[src]").map((e) => e.getAttribute("src") || "");
  const badImg = imgSrcs.filter((u) => !/^\{\{IMG:[a-z0-9-]+\}\}$/i.test(u) && !/^data:/i.test(u));
  const refs = [...html.matchAll(/\{\{IMG:([a-z0-9-]+)\}\}/gi)].map((m) => m[1]);
  const unknown = refs.filter((id) => !opts.imageIds.includes(id));
  if (badImg.length) bad(`Imágenes con origen no permitido: ${badImg.length}.`);
  else if (unknown.length) warn(`Referencias a fotos inexistentes: ${unknown.length}.`);
  else ok(refs.length ? "Fotos del cliente correctamente referenciadas." : "Sin imágenes externas.");

  const fileRefs = [...html.matchAll(/\{\{FILE:([a-z0-9-]+)\}\}/gi)].map((m) => m[1]);
  if (fileRefs.length) {
    const unknownFiles = fileRefs.filter((id) => !(opts.fileIds ?? []).includes(id));
    unknownFiles.length ? warn(`Enlaces a archivos inexistentes: ${unknownFiles.length}.`) : ok(`Archivos del cliente enlazados (${new Set(fileRefs).size}).`);
  }

  const anchors = doc.querySelectorAll('a[href^="#"]').map((a) => (a.getAttribute("href") || "").slice(1)).filter(Boolean);
  const missing = anchors.filter((id) => !doc.getElementById(id));
  if (!opts.app) {
    if (!anchors.length) warn("No hay navegación por anclas.");
    else if (missing.length) bad(`Enlaces de navegación rotos: ${[...new Set(missing)].slice(0, 3).join(", ")}.`);
    else ok(`Navegación interna correcta (${anchors.length} enlaces).`);
  }
  const forms = doc.querySelectorAll("form").length;
  if (forms) (/preventDefault/.test(html) ? ok("Formulario con manejo en página.") : warn("Hay formularios sin manejo de envío."));
  /@media/.test(html) ? ok("Reglas responsive (@media) presentes.") : warn("No se detectan reglas @media.");
  /lorem ipsum/i.test(html) ? bad("Contiene texto de relleno (lorem ipsum).") : ok("Sin texto de relleno.");
  const kb = html.length / 1024;
  kb < 90 ? ok(`Tamaño ${kb.toFixed(0)} KB.`) : warn(`Tamaño elevado: ${kb.toFixed(0)} KB.`);

  if (opts.app) {
    doc.querySelectorAll("script").length ? ok("Lógica de aplicación presente (JavaScript).") : bad("La aplicación no tiene JavaScript.");
    doc.querySelectorAll("form, input, select").length || /<(form|input|select)[\s>]/i.test(html) ? ok("Formularios y campos de captura presentes.") : bad("No hay formularios de captura.");
    doc.querySelectorAll("table, [role=table]").length || /<table[\s>]/i.test(html) ? ok("Listados en tabla presentes.") : warn("No se detectan tablas de listado.");
    /\bconfirm\(|\balert\(|\bprompt\(/.test(html) ? warn("Usa diálogos nativos (alert/confirm).") : ok("Sin diálogos nativos del navegador.");
    // Ideon Data: datos en la nube y usuarios reales en la app publicada.
    if (/\bIdeonDB\s*\.\s*ready\s*\(/.test(html)) {
      /localStorage\s*\.\s*setItem/.test(html) ? warn("Usa Ideon Data pero también guarda datos en localStorage.") : ok("Datos persistentes y compartidos con Ideon Data.");
    } else warn("La aplicación guarda los datos solo en el navegador (no usa Ideon Data).");
  }
  const jsErrors = jsSyntaxErrors(html);
  if (doc.querySelectorAll("script").length) jsErrors.length ? bad(`Error de sintaxis en JavaScript: ${jsErrors[0]}`) : ok("JavaScript sin errores de sintaxis.");
  const noAlt = doc.querySelectorAll("img").filter((i) => !i.getAttribute("alt")).length;
  noAlt ? warn(`${noAlt} imágenes sin texto alternativo.`) : ok("Imágenes con texto alternativo.");
  return out;
}

export function qaSummary(checks: QaCheck[]) {
  return { ok: checks.filter((c) => c.level === "ok").length, warn: checks.filter((c) => c.level === "warn").length, bad: checks.filter((c) => c.level === "bad").length, total: checks.length };
}
