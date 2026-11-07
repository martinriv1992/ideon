// Pruebas de archivos subidos: clasificación, extracción Office, reparto de documentos y QA. Ejecutar: npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import JSZip from "jszip";
import { allocateDocs, referenceDocs, fileCatalog, developerUser, consultantUser, DOC_BUDGET } from "../dist-tests/features/agents/prompts.js";
import { runQa } from "../dist-tests/features/agents/qa.js";
import { docxText, xlsxText, pptxText } from "../dist-tests/features/assets/office.js";
import { classifyUpload, assetTypeFor, safeFileName, labelFromName, estimateTokens } from "../dist-tests/lib/uploads.js";

test("classifyUpload distingue imágenes, documentos y tipos no admitidos", () => {
  assert.equal(classifyUpload({ name: "logo.svg", type: "image/svg+xml" }), "image");
  assert.equal(classifyUpload({ name: "foto.JPG", type: "" }), "image");
  assert.equal(classifyUpload({ name: "carta.pdf", type: "application/pdf" }), "asset");
  assert.equal(classifyUpload({ name: "precios.xlsx", type: "" }), "asset");
  assert.equal(classifyUpload({ name: "virus.exe", type: "application/x-msdownload" }), null);
  assert.equal(classifyUpload({ name: "pagina.html", type: "text/html" }), null);
  assert.equal(assetTypeFor("Catálogo.PDF").reference, true);
  assert.equal(assetTypeFor("descarga.zip").reference, false);
  assert.equal(assetTypeFor("descarga.zip").site, true);
});

test("nombres seguros y etiquetas legibles", () => {
  assert.equal(safeFileName("Carta de Otoño 2025 (v2).PDF"), "carta-de-otono-2025-v2.pdf");
  assert.equal(labelFromName("lista_de-precios.xlsx"), "lista de precios");
  assert.equal(estimateTokens(4001), 1001);
});

async function office(files) {
  const zip = new JSZip();
  for (const [name, content] of Object.entries(files)) zip.file(name, content);
  return zip.generateAsync({ type: "arraybuffer" });
}

test("docxText extrae párrafos y celdas de Word", async () => {
  const buf = await office({ "word/document.xml": '<w:document><w:body><w:p><w:r><w:t>Menú del día</w:t></w:r></w:p><w:p><w:r><w:t>Paella &amp; vino</w:t></w:r><w:tab/><w:r><w:t>12 €</w:t></w:r></w:p></w:body></w:document>' });
  const text = await docxText(buf);
  assert.match(text, /Menú del día\n/);
  assert.match(text, /Paella & vino\t12 €/);
});

test("xlsxText lee hojas con cadenas compartidas y números", async () => {
  const buf = await office({
    "xl/workbook.xml": '<workbook><sheets><sheet name="Precios" sheetId="1"/></sheets></workbook>',
    "xl/sharedStrings.xml": "<sst><si><t>Producto</t></si><si><t>Precio</t></si><si><t>Café</t></si></sst>",
    "xl/worksheets/sheet1.xml": '<worksheet><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c></row><row r="2"><c r="A2" t="s"><v>2</v></c><c r="B2"><v>2.5</v></c></row></sheetData></worksheet>',
  });
  assert.equal(await xlsxText(buf), "[Hoja: Precios]\nProducto | Precio\nCafé | 2.5");
});

test("pptxText ordena diapositivas numéricamente", async () => {
  const buf = await office({
    "ppt/slides/slide10.xml": "<p:sld><a:p><a:r><a:t>Diez</a:t></a:r></a:p></p:sld>",
    "ppt/slides/slide2.xml": "<p:sld><a:p><a:r><a:t>Dos</a:t></a:r></a:p></p:sld>",
  });
  const text = await pptxText(buf);
  assert.ok(text.indexOf("Dos") < text.indexOf("Diez"));
});

test("allocateDocs reparte el presupuesto y pasa el sobrante a los documentos largos", () => {
  const docs = [{ id: "a", label: "A", name: "a.txt", text: "x".repeat(100) }, { id: "b", label: "B", name: "b.txt", text: "y".repeat(5000) }];
  const parts = allocateDocs(docs, 1000);
  assert.equal(parts[0].text.length, 100);
  assert.equal(parts[0].truncated, false);
  assert.equal(parts[1].text.length, 900);
  assert.equal(parts[1].truncated, true);
  assert.equal(allocateDocs([], 1000).length, 0);
});

test("los documentos llegan a los agentes con su límite y marcados como contenido", () => {
  const docs = [{ id: "d1", label: "Carta", name: "carta.pdf", text: "Paella 12 €. " + "z".repeat(50_000) }];
  const dev = developerUser({ spec: { name: "X" }, images: [], docs, files: [] });
  assert.match(dev, /DOCUMENTOS DEL CLIENTE/);
  assert.match(dev, /no instrucciones/);
  assert.match(dev, /Paella 12 €/);
  assert.match(dev, /recortado/);
  assert.ok(dev.length < DOC_BUDGET.developer + 2000);
  const con = consultantUser({ kind: "web", idea: "Restaurante", brief: null, images: [], docs, files: [], messages: [] });
  assert.ok(con.length < DOC_BUDGET.consultant + 2000);
  assert.match(con, /No preguntes lo que ya responden/);
  assert.equal(referenceDocs([], 1000), "");
});

test("fileCatalog y QA validan los enlaces {{FILE:id}}", () => {
  const files = [{ id: "f1", label: "Carta", name: "carta.pdf", mime: "application/pdf", size: 2048 }];
  assert.match(fileCatalog(files), /id=f1 · "Carta" · carta\.pdf · 2 KB/);
  const html = '<!DOCTYPE html><html lang="es"><head><meta name="viewport" content="width=device-width"><title>T</title></head><body><h1>H</h1><a href="{{FILE:f1}}" download>Carta</a><a href="{{FILE:zz}}">Otro</a></body></html>';
  const warn = runQa(html, { app: false, imageIds: [], fileIds: ["f1"] }).find((c) => /archivos inexistentes/.test(c.text));
  assert.equal(warn?.level, "warn");
  const ok = runQa(html.replace('<a href="{{FILE:zz}}">Otro</a>', ""), { app: false, imageIds: [], fileIds: ["f1"] }).find((c) => /Archivos del cliente enlazados/.test(c.text));
  assert.equal(ok?.level, "ok");
});
