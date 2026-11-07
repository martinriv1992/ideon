// Pruebas de los módulos puros de agentes (sin Supabase ni red). Ejecutar: npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { consultantSystem, consultantUser, extractJson, normalizeConsultant, parseModifyOutput, cleanHtml, isCompleteHtml, developerSystem, architectSystem } from "../dist-tests/features/agents/prompts.js";
import { runQa, qaSummary } from "../dist-tests/features/agents/qa.js";
import { buildProposal } from "../dist-tests/features/proposals/generate.js";

test("extractJson tolera texto alrededor y bloques de código", () => {
  assert.deepEqual(extractJson('Claro:\n{"a":1}\nGracias'), { a: 1 });
  assert.deepEqual(extractJson('```json\n{"b":[1,2]}\n```'), { b: [1, 2] });
  assert.equal(extractJson("sin json"), null);
});

test("normalizeConsultant produce pregunta con opciones y progreso", () => {
  const out = normalizeConsultant({ reply: "Hola", question: { text: "¿Objetivo?", options: ["A", "B", 3], multi: "yes" }, progress: { step: "2", total: 6 }, ready: 0, brief: { name: "X" } });
  assert.equal(out.reply, "Hola");
  assert.deepEqual(out.question, { text: "¿Objetivo?", options: ["A", "B", "3"], multi: true });
  assert.deepEqual(out.progress, { step: 2, total: 6 });
  assert.equal(out.ready, false);
  assert.equal(out.brief.name, "X");
});

test("prompts del consultor dependen del tipo y llevan la transcripción", () => {
  assert.match(consultantSystem("web"), /secciones que debe tener/);
  assert.match(consultantSystem("crm"), /entidades principales/);
  const u = consultantUser({ kind: "crm", idea: "Un CRM", brief: null, images: [{ id: "i1", label: "logo" }], messages: [{ role: "user", content: "Un CRM" }, { role: "assistant", content: "¿Objetivo?", question: { text: "¿Objetivo?", options: ["A", "B"], multi: false } }, { role: "user", content: "A" }] });
  assert.match(u, /CLIENTE: Un CRM/);
  assert.match(u, /pregunta planteada: ¿Objetivo\? \| opciones: A \/ B/);
  assert.match(u, /ÚNICAMENTE con el objeto JSON/);
  assert.match(architectSystem("inventory"), /entities/);
  assert.match(developerSystem("web"), /\{\{IMG:id\}\}/);
});

test("parseModifyOutput separa respuesta y HTML", () => {
  const r = parseModifyOutput("RESPUESTA: Listo.\n===HTML===\n```html\n<!DOCTYPE html><html><body>x</body></html>\n```");
  assert.equal(r.reply, "Listo.");
  assert.ok(r.html.startsWith("<!DOCTYPE html>"));
  assert.equal(parseModifyOutput("RESPUESTA: Es una pregunta").html, null);
  assert.equal(isCompleteHtml(cleanHtml("texto <!doctype html><html></html>")), true);
  assert.equal(isCompleteHtml("<html>"), false);
});

test("QA detecta problemas reales", () => {
  const good = `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>T</title><style>@media(max-width:600px){}</style></head><body><h1>Hola</h1><nav><a href="#c">c</a></nav><section id="c"></section><img src="{{IMG:abc}}" alt="foto"></body></html>`;
  const qa = runQa(good, { app: false, imageIds: ["abc"] });
  assert.equal(qaSummary(qa).bad, 0, JSON.stringify(qa));
  const badHtml = `<html><body><p>lorem ipsum</p><img src="https://x/y.png"><a href="#nope">x</a><script src="https://cdn/x.js"></script></body></html>`;
  const q2 = runQa(badHtml, { app: true, imageIds: [] });
  const texts = q2.filter((c) => c.level === "bad").map((c) => c.text).join(" | ");
  assert.match(texts, /Falta <title>/);
  assert.match(texts, /Recursos externos/);
  assert.match(texts, /lorem ipsum/);
  assert.match(texts, /No hay formularios/);
});

test("buildProposal usa planes configurados y queda 'según alcance' sin precio", () => {
  const plans = [{ key: "starter", price_from: null, currency: "USD", is_active: true }, { key: "pro", price_from: 1500, currency: "USD", is_active: true }];
  const web = buildProposal({ kind: "web", name: "Sitio", pages: [{ title: "Inicio", sections: [{ heading: "Hero" }, { heading: "Contacto" }] }] }, plans);
  assert.equal(web.complexity, "starter"); assert.equal(web.price, null); assert.equal(web.items.length, 4);
  const app = buildProposal({ kind: "app", name: "CRM", complexity: "pro", entities: [{ label: "Clientes", fields: [1, 2] }, { label: "Pedidos", fields: [] }], workflows: ["Venta descuenta stock"], estimated_days: 9 }, plans);
  assert.equal(app.plan_key, "pro"); assert.equal(app.price, 1500); assert.equal(app.estimated_days, 9);
});
