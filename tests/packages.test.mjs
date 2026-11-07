import { test } from "node:test";
import assert from "node:assert/strict";
import { PACKAGES, getPackage, packagePrice, packagePromptBlock } from "../dist-tests/features/packages/catalog.js";
import { withPackage } from "../dist-tests/features/agents/prompts.js";

test("catálogo: tres paquetes con su tipo y demo", () => {
  assert.deepEqual(PACKAGES.map((p) => p.key), ["inventory", "crm", "suite"]);
  assert.equal(getPackage("suite").kind, "erp");
  assert.equal(getPackage("nope"), null);
  assert.equal(getPackage(null), null);
  for (const p of PACKAGES) assert.ok(p.modules.length >= 5 && p.demo.startsWith("ideon-"));
});

test("precio: el de pricing_plans si está fijado; si no, el de referencia", () => {
  const crm = getPackage("crm");
  assert.deepEqual(packagePrice(crm, []), { price: 1490000, currency: "COP" });
  assert.deepEqual(packagePrice(crm, [{ key: "pkg_crm", price_from: "1690000.00", currency: "cop", is_active: true }]), { price: 1690000, currency: "COP" });
  assert.deepEqual(packagePrice(crm, [{ key: "pkg_crm", price_from: null, currency: "COP" }]), { price: 1490000, currency: "COP" });
  assert.deepEqual(packagePrice(crm, [{ key: "pkg_crm", price_from: 900000, currency: "COP", is_active: false }]), { price: 1490000, currency: "COP" });
});

test("prompts: el paquete se añade solo cuando existe", () => {
  assert.equal(withPackage("SYS", null, "consultant"), "SYS");
  const block = packagePromptBlock(getPackage("inventory"));
  const c = withPackage("SYS", block, "consultant");
  assert.match(c, /Ideon Inventory/);
  assert.match(c, /NO preguntes por las funcionalidades base/);
  assert.match(withPackage("SYS", block, "architect"), /TODOS los módulos base/);
});
