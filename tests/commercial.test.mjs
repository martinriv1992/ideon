// Captación comercial y precios indicativos. Ejecutar: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { leadSchema, looksLikeSpam, toCsv, isOverdue, leadUpdateSchema, STAGES } from "../dist-tests/features/leads/schema.js";
import { PRICING, regionForCountry, formatFrom } from "../dist-tests/content/commercial/pricing.js";

const valid = { fullName: "Ana Pérez", company: "Distribuidora Sol", email: "ANA@sol.co ", country: "Colombia", solution: "inventory", problem: "Controlamos el inventario en Excel y perdemos ventas por falta de stock.", timeframe: "1-3m", consent: true };

test("lead válido: normaliza correo y aplica valores por defecto", () => {
  const r = leadSchema.parse(valid);
  assert.equal(r.email, "ana@sol.co");
  assert.equal(r.wantsMeeting, false);
  assert.equal(r.locale, "es");
  assert.deepEqual(r.attribution, {});
});

test("lead: errores con claves de traducción", () => {
  const r = leadSchema.safeParse({ ...valid, email: "x", problem: "corto", consent: false, solution: "nope", website: "no es web" });
  assert.equal(r.success, false);
  const f = Object.fromEntries(r.error.issues.map((i) => [i.path[0], i.message]));
  assert.equal(f.email, "email"); assert.equal(f.problem, "problem"); assert.equal(f.consent, "consent"); assert.equal(f.solution, "solution"); assert.equal(f.website, "website");
});

test("lead: web opcional válida y atribución recortada a 500", () => {
  const r = leadSchema.parse({ ...valid, website: "sol.co/tienda", attribution: { source: "linkedin", campaign: "x".repeat(400) } });
  assert.equal(r.website, "sol.co/tienda");
  assert.equal(r.attribution.source, "linkedin");
  assert.equal(leadSchema.safeParse({ ...valid, attribution: { source: "x".repeat(600) } }).success, false);
});

test("antispam: campo trampa o envío en menos de 3 s", () => {
  assert.equal(looksLikeSpam({ hp: "http://spam", elapsedMs: 10000 }), true);
  assert.equal(looksLikeSpam({ hp: "", elapsedMs: 1200 }), true);
  assert.equal(looksLikeSpam({ hp: "", elapsedMs: 8000 }), false);
  assert.equal(looksLikeSpam({}), false);
});

test("CSV: comillas escapadas y sin inyección de fórmulas", () => {
  const csv = toCsv([{ a: 'Hola "mundo"', b: "=HYPERLINK(1)", c: null }], ["a", "b", "c"]);
  assert.equal(csv, 'a,b,c\n"Hola ""mundo""","\'=HYPERLINK(1)",""');
});

test("seguimiento vencido solo en leads abiertos", () => {
  const now = new Date("2026-11-07T12:00:00Z");
  assert.equal(isOverdue({ stage: "contacted", next_follow_up_at: "2026-11-06T12:00:00Z" }, now), true);
  assert.equal(isOverdue({ stage: "won", next_follow_up_at: "2026-11-06T12:00:00Z" }, now), false);
  assert.equal(isOverdue({ stage: "new", next_follow_up_at: null }, now), false);
  assert.equal(STAGES.length, 9);
});

test("gestión del lead: etapa válida y fechas a ISO", () => {
  const r = leadUpdateSchema.parse({ stage: "meeting", estimatedValue: 1490000, estimatedCurrency: "cop", nextFollowUpAt: "2026-11-10T09:30" });
  assert.equal(r.estimatedCurrency, "COP");
  assert.match(r.nextFollowUpAt, /^2026-11-10T/);
  assert.equal(r.lastContactAt, null);
  assert.equal(leadUpdateSchema.safeParse({ stage: "ganado" }).success, false);
});

test("precios indicativos y región por país", () => {
  assert.deepEqual(PRICING.co.tiers.map((t) => t.from), [590000, 1490000, 2900000]);
  assert.deepEqual(PRICING.intl.tiers.map((t) => t.from), [350, 900, 1800]);
  assert.equal(regionForCountry("co"), "co");
  assert.equal(regionForCountry("ES"), "intl");
  assert.equal(regionForCountry(null), "intl");
  assert.match(formatFrom(590000, "COP", "es"), /590\.000 COP$/);
  assert.equal(formatFrom(350, "USD", "en"), "$350");
});
