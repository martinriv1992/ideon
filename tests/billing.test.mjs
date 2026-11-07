// Pruebas de precios del lanzamiento, dominios y firma de ePayco. Ejecutar: npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { createHash } from "node:crypto";
import { billingFromSettings, DEFAULT_BILLING, domainCandidates, domainCostUsd, domainSalePrice, launchQuote, parseDomainQuery, roundPrice, subscriptionState, toBilling } from "../dist-tests/features/billing/pricing.js";
import { epaycoSignature, epaycoState, sameAmount, verifyEpaycoSignature } from "../dist-tests/features/billing/epayco-sign.js";

test("los ajustes de la plataforma se leen con valores por defecto seguros", () => {
  const s = billingFromSettings([{ key: "hosting_price_year", value: 300000 }, { key: "domain_tlds", value: [".COM", "co"] }, { key: "usd_to_billing_rate", value: "4100" }, { key: "free_preview_changes", value: -3 }]);
  assert.equal(s.hostingYear, 300000);
  assert.deepEqual(s.tlds, ["com", "co"]);
  assert.equal(s.usdRate, 4100);
  assert.equal(s.freeChanges, DEFAULT_BILLING.freeChanges); // un valor negativo se ignora
  assert.equal(billingFromSettings([]).currency, "COP");
});

test("el dominio se cotiza con el mayor entre compra y renovación, con margen y redondeo", () => {
  assert.equal(domainCostUsd({ purchasePrice: 1.49, renewalPrice: 44 }), 44);
  assert.equal(domainCostUsd({ purchasePrice: 12.03, renewalPrice: 12.03 }), 12.03);
  // 12.03 USD × 4000 × 1.30 = 62 556 → 63 000 COP
  assert.equal(domainSalePrice(12.03, DEFAULT_BILLING), 63000);
  assert.equal(roundPrice(1001, "COP"), 2000);
  assert.equal(roundPrice(10.2, "USD"), 11);
  assert.equal(toBilling(100, "USD", DEFAULT_BILLING), 400000);
  assert.throws(() => toBilling(100, "EUR", DEFAULT_BILLING));
});

test("launchQuote suma desarrollo + hosting + dominio y calcula la renovación sin el desarrollo", () => {
  const q = launchQuote({ development: { title: "Web La Huerta", price: 300, currency: "USD" }, domain: { name: "lahuerta.co", salePrice: 156000 } }, DEFAULT_BILLING);
  assert.deepEqual(q.items.map((i) => i.key), ["development", "hosting", "domain"]);
  assert.equal(q.items[0].amount, 1_200_000);
  assert.equal(q.total, 1_200_000 + 240_000 + 156_000);
  assert.equal(q.renewal, 240_000 + 156_000);
  assert.equal(q.currency, "COP");
  const noDomain = launchQuote({ development: null, domain: null }, DEFAULT_BILLING);
  assert.equal(noDomain.total, 240_000);
  assert.equal(noDomain.renewal, 240_000);
});

test("parseDomainQuery y domainCandidates normalizan lo que escribe el cliente", () => {
  assert.deepEqual(parseDomainQuery("https://www.Panadería-Lúa.com/inicio"), { label: "panaderia-lua", tld: "com" });
  assert.deepEqual(parseDomainQuery("mi tienda"), { label: "mi-tienda", tld: null });
  assert.equal(parseDomainQuery("-mal"), null);
  assert.equal(parseDomainQuery("a"), null);
  assert.deepEqual(domainCandidates("lahuerta.co", ["com", "co", "net"]), ["lahuerta.co", "lahuerta.com", "lahuerta.net"]);
  assert.deepEqual(domainCandidates("lahuerta.xyz", ["com", "co"]), ["lahuerta.com", "lahuerta.co"]);
});

test("subscriptionState: activo, en gracia y suspendido", () => {
  const now = new Date("2026-06-01T00:00:00Z");
  assert.equal(subscriptionState("2026-07-01T00:00:00Z", 15, now), "active");
  assert.equal(subscriptionState("2026-05-25T00:00:00Z", 15, now), "grace");
  assert.equal(subscriptionState("2026-05-01T00:00:00Z", 15, now), "suspended");
  assert.equal(subscriptionState(null, 15, now), "none");
});

test("firma de ePayco: sha256 de los campos unidos por ^ y comparación segura", () => {
  const p = { x_ref_payco: "123", x_transaction_id: "abc", x_amount: "240000", x_currency_code: "COP" };
  const expected = createHash("sha256").update("9001^secret^123^abc^240000^COP").digest("hex");
  assert.equal(epaycoSignature("9001", "secret", p), expected);
  assert.equal(verifyEpaycoSignature("9001", "secret", { ...p, x_signature: expected }), true);
  assert.equal(verifyEpaycoSignature("9001", "secret", { ...p, x_amount: "1", x_signature: expected }), false);
  assert.equal(verifyEpaycoSignature("9001", "secret", { ...p, x_signature: "corta" }), false);
});

test("estados e importes de ePayco", () => {
  assert.equal(epaycoState("1"), "paid");
  assert.equal(epaycoState("3"), "pending");
  assert.equal(epaycoState("2"), "failed");
  assert.equal(epaycoState(undefined), "failed");
  assert.equal(sameAmount("240000.00", 240000), true);
  assert.equal(sameAmount("240000", "239999"), false);
});
