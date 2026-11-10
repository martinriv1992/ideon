// Ideon Data: validación de operaciones, contraseñas temporales y detección del SDK. Ejecutar: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { batchSchema, opSchema, generatePassword, sessionCookieName, usesIdeonData, toClient, LIMITS } from "../dist-tests/features/appdata/core.js";

test("operaciones válidas y campos reservados eliminados", () => {
  const r = opSchema.parse({ op: "insert", collection: "productos", id: "p1", data: { nombre: "Arroz", id: "x", createdAt: "y", stock: 5 } });
  assert.deepEqual(r.data, { nombre: "Arroz", stock: 5 });
  assert.equal(opSchema.parse({ op: "increment", collection: "productos", id: "3f0b1c2e-1d2a-4c55-9a0b-1234567890ab", field: "stock", delta: -2 }).delta, -2);
  assert.ok(opSchema.safeParse({ op: "remove", collection: "productos", id: "p1" }).success);
});

test("se rechazan colecciones, ids, campos y tamaños no válidos", () => {
  assert.equal(opSchema.safeParse({ op: "insert", collection: "Productos", id: "p1", data: {} }).success, false);
  assert.equal(opSchema.safeParse({ op: "insert", collection: "productos", id: "../x", data: {} }).success, false);
  assert.equal(opSchema.safeParse({ op: "increment", collection: "productos", id: "p1", field: "id", delta: 1 }).success, false);
  assert.equal(opSchema.safeParse({ op: "increment", collection: "productos", id: "p1", field: "stock", delta: Infinity }).success, false);
  assert.equal(opSchema.safeParse({ op: "drop", collection: "productos", id: "p1" }).success, false);
  const big = { texto: "x".repeat(LIMITS.recordBytes + 10) };
  assert.equal(opSchema.safeParse({ op: "insert", collection: "notas", id: "n1", data: big }).success, false);
  assert.equal(batchSchema.safeParse({ ops: [] }).success, false);
  assert.equal(batchSchema.safeParse({ ops: Array.from({ length: LIMITS.opsPerBatch + 1 }, (_, i) => ({ op: "remove", collection: "a", id: "r" + i })) }).success, false);
});

test("contraseña temporal legible y sin caracteres ambiguos", () => {
  const p = generatePassword((n) => randomBytes(n));
  assert.match(p, /^[A-HJ-NP-Za-km-z2-9]{4}-[A-HJ-NP-Za-km-z2-9]{4}-[A-HJ-NP-Za-km-z2-9]{4}$/);
  assert.notEqual(p, generatePassword((n) => randomBytes(n)));
});

test("cookie por proyecto y detección del SDK", () => {
  assert.equal(sessionCookieName("3f0b1c2e-1d2a-4c55-9a0b-1234567890ab"), "ideon_app_3f0b1c2e1d2a4c55");
  assert.equal(usesIdeonData("<script>IdeonDB.ready().then(start)</script>"), true);
  assert.equal(usesIdeonData("<script>localStorage.setItem('x',1)</script>"), false);
});

test("formato de registro para el SDK", () => {
  const r = toClient({ id: "p1", collection: "productos", data: { a: 1 }, created_at: "c", updated_at: "u", deleted_at: null, created_by: null, updated_by: null });
  assert.deepEqual(r, { id: "p1", collection: "productos", data: { a: 1 }, createdAt: "c", updatedAt: "u", createdBy: null, deleted: false });
});

test("prospección: limpia, valida y deduplica lo que devuelve la IA", async () => {
  const { normalizeProspects, prospectRequestSchema, cleanPhone } = await import("../dist-tests/features/appdata/core.js");
  const raw = { empresas: [
    { empresa: "Ferretería Uno", telefono: "(604) 511-9828", correo: "INFO@Uno.co", web: "uno.co", fuente: "https://uno.co/contacto" },
    { empresa: "Ferretería Uno copia", web: "https://www.uno.co/", fuente: "https://otra.com" },
    { empresa: "Sin fuente", correo: "a@b.co" },
    { empresa: "Perfil", fuente: "https://www.linkedin.com/company/x" },
    { empresa: "Dos", correo: "no-es-correo", telefono: "123", fuente: "https://dos.com" },
  ] };
  const r = normalizeProspects(raw, 10);
  assert.deepEqual(r.map((x) => x.empresa), ["Ferretería Uno", "Dos"]);
  assert.equal(r[0].correo, "info@uno.co");
  assert.equal(r[0].telefono, "6045119828");
  assert.equal(r[0].web, "https://uno.co/");
  assert.equal(r[1].correo, "");
  assert.equal(r[1].telefono, "");
  assert.equal(normalizeProspects(raw, 1).length, 1);
  assert.deepEqual(normalizeProspects(null, 5), []);
  assert.equal(cleanPhone("+57 300 555 0101"), "+573005550101");
  assert.equal(prospectRequestSchema.safeParse({ query: "x" }).success, false);
  assert.equal(prospectRequestSchema.parse({ query: "ferreterías", location: " " }).location, undefined);
  assert.equal(prospectRequestSchema.safeParse({ query: "ferreterías", max: 50 }).success, false);
});

test("prospección: precios desde ajustes, orden de saldos y extensión del plan", async () => {
  const { prospectPricingFrom, DEFAULT_PROSPECT_PRICING, nextPool, remainingSearches, extendPlan } = await import("../dist-tests/features/appdata/core.js");
  assert.deepEqual(prospectPricingFrom([]), DEFAULT_PROSPECT_PRICING);
  const pr = prospectPricingFrom([{ key: "prospect_plan_price", value: 90000 }, { key: "prospect_single_price", value: "15000" }, { key: "prospect_trial_searches", value: -2 }]);
  assert.equal(pr.planPrice, 90000); assert.equal(pr.singlePrice, 15000); assert.equal(pr.planSearches, 20);
  assert.ok(pr.trialSearches >= 0);
  const b = { trial: { total: 3, used: 0 }, plan: { active: true, until: null, searches: 20, used: 0 }, credits: { bought: 2, used: 0 } };
  assert.equal(nextPool(b), "trial"); assert.equal(remainingSearches(b), 25);
  b.trial.used = 3; assert.equal(nextPool(b), "plan");
  b.plan.used = 20; assert.equal(nextPool(b), "credit"); assert.equal(remainingSearches(b), 2);
  b.credits.used = 2; assert.equal(nextPool(b), null); assert.equal(remainingSearches(b), 0);
  b.plan = { active: false, until: null, searches: 0, used: 5 }; b.credits.bought = 3;
  assert.equal(nextPool(b), "credit"); assert.equal(remainingSearches(b), 1);
  const now = new Date("2026-11-09T00:00:00Z");
  const fresh = extendPlan({ until: null, since: null, granted: 0 }, { planDays: 30, planSearches: 20 }, now);
  assert.deepEqual(fresh, { until: "2026-12-09T00:00:00.000Z", since: now.toISOString(), granted: 20 });
  const renew = extendPlan({ until: fresh.until, since: fresh.since, granted: 20 }, { planDays: 30, planSearches: 20 }, new Date("2026-11-20T00:00:00Z"));
  assert.deepEqual(renew, { until: "2027-01-08T00:00:00.000Z", since: fresh.since, granted: 40 });
  const expired = extendPlan({ until: "2026-10-01T00:00:00Z", since: "2026-09-01T00:00:00Z", granted: 20 }, { planDays: 30, planSearches: 20 }, now);
  assert.equal(expired.granted, 20); assert.equal(expired.since, now.toISOString());
});

test("db.ai: JSON tolerante en las respuestas de la IA", async () => {
  const { parseJsonLoose, appAiRequestSchema } = await import("../dist-tests/features/appdata/core.js");
  assert.deepEqual(parseJsonLoose('[{"a":1}]'), [{ a: 1 }]);
  assert.deepEqual(parseJsonLoose('Aquí tienes:\n```json\n{"x":[1,2]}\n```'), { x: [1, 2] });
  assert.deepEqual(parseJsonLoose('Resultado: [{"n":"A"},{"n":"B"}] listo'), [{ n: "A" }, { n: "B" }]);
  assert.equal(parseJsonLoose("sin json"), undefined);
  assert.equal(appAiRequestSchema.parse({ prompt: "hola" }).tier, "default");
  assert.equal(appAiRequestSchema.safeParse({ prompt: "" }).success, false);
});
