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
