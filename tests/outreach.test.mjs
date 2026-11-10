// Cadencias automáticas: elegibilidad, tiempos entre pasos y plantillas. Ejecutar: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { nextStep, cadenceFrom, outreachConfigFrom, templateMessage, channelFor, itemId, emailHtml } from "../dist-tests/features/appdata/outreach-core.js";

const cad = cadenceFrom({ cadencia: [{ dia: 0, canal: "Correo" }, { dia: 3, canal: "WhatsApp" }, { dia: 7, canal: "Correo" }] });
const cfg = outreachConfigFrom({ activo: true, fitMin: 50 });
const L = { id: "l1", empresa: "Ferretería X", correo: "ventas@fx.co", telefono: "3001234567", etapa: "Nuevo", fit: 60 };

test("paso 0 solo para «Nuevo» con encaje suficiente y algún canal", () => {
  assert.deepEqual(nextStep(L, cad, [], cfg), { paso: 0, canal: "Correo" });
  assert.equal(nextStep({ ...L, fit: 40 }, cad, [], cfg), null);
  assert.equal(nextStep({ ...L, fit: null }, cad, [], cfg), null);
  assert.deepEqual(nextStep({ ...L, fit: null }, cad, [], outreachConfigFrom({ fitMin: 0 })), { paso: 0, canal: "Correo" });
  assert.equal(nextStep({ ...L, etapa: "Respondió" }, cad, [], cfg), null);
  assert.equal(nextStep({ ...L, baja: true }, cad, [], cfg), null);
  assert.deepEqual(nextStep({ ...L, correo: "" }, cad, [], cfg), { paso: 0, canal: "WhatsApp" });
  assert.equal(nextStep({ ...L, correo: "", telefono: "" }, cad, [], cfg), null);
});

test("pasos siguientes respetan los días y los pendientes", () => {
  const sent = { id: itemId("l1", 0), leadId: "l1", paso: 0, canal: "Correo", estado: "enviado", enviadoEn: "2026-11-01T10:00:00Z" };
  assert.equal(nextStep({ ...L, etapa: "Contactado" }, cad, [sent], cfg, new Date("2026-11-03T10:00:00Z")), null);
  assert.deepEqual(nextStep({ ...L, etapa: "Contactado" }, cad, [sent], cfg, new Date("2026-11-04T10:00:01Z")), { paso: 1, canal: "WhatsApp" });
  assert.equal(nextStep(L, cad, [{ ...sent, estado: "borrador", enviadoEn: null }], cfg), null);
  const last = { ...sent, paso: 2, id: itemId("l1", 2) };
  assert.equal(nextStep(L, cad, [last], cfg, new Date("2027-01-01")), null);
});

test("configuración saneada y plantillas con pago único", () => {
  const c = outreachConfigFrom({ limiteDiario: 9999, modo: "x", responderA: "malo", remitente: "Martín <x>" });
  assert.equal(c.limiteDiario, 200); assert.equal(c.modo, "aprobacion"); assert.equal(c.responderA, ""); assert.equal(c.remitente, "Martín x");
  const m = templateMessage(L, 0, "Correo", "Martín");
  assert.equal(m.asunto, "inventario y cotizaciones"); assert.match(m.texto, /Ferretería X/); assert.match(m.texto, /P\. D\.: es pago único/);
  assert.ok(m.texto.split(/\s+/).length <= 90, "correo corto");
  assert.ok((m.texto.match(/\?/g) || []).length <= 3, "saludo, una pregunta y la invitación");
  assert.doesNotMatch(m.texto, /soluciones|innovador|transformaci|potenci|espero que/i);
  assert.equal(templateMessage({ id: "y", empresa: "Barbería Z" }, 0, "Correo", "Martín").asunto, "reservas por WhatsApp");
  assert.equal(templateMessage({ id: "y", empresa: "Comercial Q" }, 0, "Correo", "Martín").asunto, "una pregunta rápida");
  assert.equal(templateMessage(L, 1, "WhatsApp", "Martín").asunto, "");
  assert.equal(channelFor({ dia: 0, canal: "WhatsApp" }, { id: "x", correo: "a@b.co" }), "Correo");
  assert.match(emailHtml("Hola <b>\n\nChao", "https://x/u"), /&lt;b&gt;.*date de baja/s);
});

test("firma corporativa: datos por usuario, enlaces seguros y sin despedida duplicada", async () => {
  const { signatureFrom, stripSignoff, emailHtml, signatureText } = await import("../dist-tests/features/appdata/outreach-core.js");
  const sig = signatureFrom({ cargo: "Ventas", web: "javascript:alert(1)", telefono: "300 111 2233" }, { cargo: "Fundador" }, "Martín Riviere");
  assert.equal(sig.nombre, "Martín Riviere"); assert.equal(sig.cargo, "Fundador"); assert.equal(sig.web, "https://ideonapp.com");
  assert.match(sig.ctaText, /CRM personalizado gratis/);
  const t = "Hola, ¿qué tal?\n\nUna pregunta.\n\nMartín\nIdeonapp\n\nP. D.: es pago único.";
  assert.equal(stripSignoff(t, "Martín Riviere"), "Hola, ¿qué tal?\n\nUna pregunta.\n\nP. D.: es pago único.");
  const html = emailHtml(t, "https://x/u", { diseno: "pieza", banner: "https://ideonapp.com/email/general.jpg", ctaUrl: "https://cal.com/x" }, sig);
  assert.match(html, /email\/general\.jpg/); assert.match(html, /Agendar 15 minutos/); assert.match(html, /CRM personalizado gratis &rarr;/); assert.match(html, /wa\.me\/573001112233/);
  assert.equal((html.match(/>Martín</g) || []).length, 0, "la despedida del texto se reemplaza por la firma");
  assert.match(signatureText(sig), /ideonapp\.com/);
});

test("respuestas: dirección por prospecto y texto sin lo citado", async () => {
  const { parseReplyLocal, stripQuoted } = await import("../dist-tests/features/appdata/outreach-core.js");
  assert.deepEqual(parseReplyLocal("Ideonapp <r.2c5cbc89.l1a1b785c8c0hefo.ab12cd34ef@respuestas.ideonapp.com>"), { p8: "2c5cbc89", leadId: "l1a1b785c8c0hefo", sig: "ab12cd34ef" });
  assert.equal(parseReplyLocal("martin@ideonapp.com"), null);
  const t = "Hola Martín, sí me interesa. ¿El jueves?\n\nEl lun, 10 nov 2026 a las 9:00, Martín <x@y.com> escribió:\n> Hola, ¿qué tal?\n> texto";
  assert.equal(stripQuoted(t), "Hola Martín, sí me interesa. ¿El jueves?");
  assert.equal(stripQuoted("Ok\n\nOn Mon, Nov 10, 2026 at 9:00 AM Martin wrote:\n> hi"), "Ok");
});
