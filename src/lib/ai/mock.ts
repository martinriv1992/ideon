import "server-only";
import type { AIProvider, CompletionRequest, CompletionResult } from "./provider";

/**
 * Proveedor MOCK, solo para pruebas automatizadas y desarrollo sin clave
 * (AI_PROVIDER=mock). Produce respuestas deterministas con el formato que
 * esperan los agentes. Nunca se usa en producción salvo configuración explícita.
 */
function count(re: RegExp, s: string) {
  return (s.match(re) || []).length;
}

export const mockProvider: AIProvider = {
  name: "mock",
  async complete(req: CompletionRequest): Promise<CompletionResult> {
    const out = (text: string): CompletionResult => ({
      text,
      model: `mock:${req.model}`, // deja ver en las pruebas qué modelo real se habría usado
      inputTokens: Math.ceil((req.system.length + req.user.length) / 4),
      outputTokens: Math.ceil(text.length / 4),
      truncated: false,
    });

    if (req.task === "consultant") {
      const answered = count(/^CLIENTE: /gm, req.user); // mensajes del cliente en la transcripción
      const steps = [
        { text: "¿Cuál es el objetivo principal?", options: ["Conseguir clientes", "Vender online", "Informar"], multi: false },
        { text: "¿Qué secciones necesitas?", options: ["Inicio", "Servicios", "Contacto", "Galería"], multi: true },
        { text: "¿Qué estilo visual prefieres?", options: ["Minimalista", "Cálido", "Corporativo"], multi: false },
      ];
      const step = answered - 1; // la idea cuenta como primer mensaje
      if (step < steps.length) {
        return out(JSON.stringify({
          reply: `Paso ${step + 1}.`,
          question: steps[step],
          progress: { step: step + 1, total: steps.length },
          ready: false,
          brief: { name: "Negocio de prueba", goal: "Probar la plataforma" },
        }));
      }
      return out(JSON.stringify({
        reply: "Tengo todo lo necesario. Construyo la primera versión.",
        question: null,
        progress: { step: steps.length, total: steps.length },
        ready: true,
        brief: { name: "Negocio de prueba", goal: "Probar la plataforma", audience: "Clientes", style: "Minimalista", sections: ["Inicio", "Servicios", "Contacto"], contact: "no indicado", language: "es" },
      }));
    }

    if (req.task === "architect") {
      const app = /"kind": "app"|aplicación de tipo/i.test(req.system);
      return out(JSON.stringify({
        kind: app ? "app" : "web",
        name: "Negocio de prueba",
        tagline: "Sitio generado en modo de pruebas",
        language: "es",
        pages: [{ id: "inicio", title: "Inicio", sections: [
          { type: "hero", heading: "Bienvenido", content: "Texto de bienvenida." },
          { type: "services", heading: "Servicios", content: "Tres servicios." },
          { type: "contact", heading: "Contacto", content: "Formulario." },
        ] }],
        entities: app ? [{ name: "clientes", label: "Clientes", fields: [{ key: "nombre", label: "Nombre", type: "text", required: true }], sampleCount: 3 }] : [],
        style: { palette: { bg: "#ffffff", fg: "#111111", accent: "#2f6fed" }, font: "Inter", mood: "limpio" },
        cta: "Contactar",
        contact: {},
      }));
    }

    const html = `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Negocio de prueba</title><style>body{font-family:system-ui;margin:0}header{padding:48px 24px;background:#2f6fed;color:#fff}section{padding:32px 24px}@media(max-width:600px){header{padding:32px 16px}}</style></head><body><header><h1>Bienvenido</h1><p>Sitio generado en modo de pruebas.</p><nav><a href="#servicios">Servicios</a> · <a href="#contacto">Contacto</a></nav></header><section id="servicios"><h2>Servicios</h2><p>Tres servicios.</p></section><section id="contacto"><h2>Contacto</h2><form onsubmit="event.preventDefault();this.innerHTML='<p>Gracias</p>'"><input placeholder="Email" required><button>Enviar</button></form></section><footer><p>© Negocio de prueba</p></footer></body></html>`;
    if (req.task === "developer") return out(html);
    // modify
    const instruction = (req.user.match(/PETICIÓN DEL CLIENTE:\n([\s\S]*?)\n\nHTML ACTUAL/) || [])[1] || "";
    if (/^\s*¿/.test(instruction)) return out("RESPUESTA: Es una pregunta; no he cambiado nada.");
    return out("RESPUESTA: He aplicado el cambio solicitado.\n===HTML===\n" + html.replace("Bienvenido", "Bienvenido (modificado)"));
  },
};
