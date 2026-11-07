import JSZip from "jszip";

/**
 * Lectura de texto de documentos Office (DOCX/XLSX/PPTX) desde su XML interno.
 * Módulo puro (sin dependencias de servidor) para poder probarlo de forma aislada.
 */

export function normalize(s: string) {
  return s.replace(/\r\n?/g, "\n").replace(/[ \t ]+/g, " ").replace(/ *\n */g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

function decodeXml(s: string) {
  return s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_m, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_m, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&amp;/g, "&");
}

export async function docxText(data: ArrayBuffer) {
  const zip = await JSZip.loadAsync(data);
  const xml = await zip.file("word/document.xml")?.async("string");
  if (!xml) return "";
  return decodeXml(xml
    .replace(/<w:tab\/>/g, "\t")
    .replace(/<w:br[^>]*\/>/g, "\n")
    .replace(/<\/w:p>/g, "\n")
    .replace(/<\/w:tc>/g, " | ")
    .replace(/<[^>]+>/g, ""));
}

export async function pptxText(data: ArrayBuffer) {
  const zip = await JSZip.loadAsync(data);
  const slides = Object.keys(zip.files)
    .filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n))
    .sort((a, b) => Number(a.match(/(\d+)\.xml$/)![1]) - Number(b.match(/(\d+)\.xml$/)![1]));
  const out: string[] = [];
  for (const [i, name] of slides.entries()) {
    const xml = await zip.file(name)!.async("string");
    const text = decodeXml(xml.replace(/<\/a:p>/g, "\n").replace(/<[^>]+>/g, ""));
    out.push(`[Diapositiva ${i + 1}]\n${text}`);
  }
  return out.join("\n\n");
}

export async function xlsxText(data: ArrayBuffer) {
  const zip = await JSZip.loadAsync(data);
  const sharedXml = (await zip.file("xl/sharedStrings.xml")?.async("string")) ?? "";
  const shared = [...sharedXml.matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => decodeXml(m[1].replace(/<rPh[\s\S]*?<\/rPh>/g, "").replace(/<[^>]+>/g, "")));
  const workbook = (await zip.file("xl/workbook.xml")?.async("string")) ?? "";
  const names = [...workbook.matchAll(/<sheet [^>]*name="([^"]*)"/g)].map((m) => decodeXml(m[1]));
  const sheets = Object.keys(zip.files)
    .filter((n) => /^xl\/worksheets\/sheet\d+\.xml$/.test(n))
    .sort((a, b) => Number(a.match(/(\d+)\.xml$/)![1]) - Number(b.match(/(\d+)\.xml$/)![1]));
  const out: string[] = [];
  for (const [i, name] of sheets.entries()) {
    const xml = await zip.file(name)!.async("string");
    const rows: string[] = [];
    for (const row of xml.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)) {
      const cells: string[] = [];
      for (const c of row[1].matchAll(/<c ([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
        const attrs = c[1]; const inner = c[2] ?? "";
        const type = /t="([^"]+)"/.exec(attrs)?.[1];
        const v = /<v>([\s\S]*?)<\/v>/.exec(inner)?.[1];
        let val = "";
        if (type === "s" && v != null) val = shared[Number(v)] ?? "";
        else if (type === "inlineStr") val = decodeXml(inner.replace(/<[^>]+>/g, ""));
        else if (v != null) val = decodeXml(v);
        cells.push(val.replace(/\s+/g, " ").trim());
      }
      while (cells.length && !cells[cells.length - 1]) cells.pop();
      if (cells.length) rows.push(cells.join(" | "));
    }
    if (rows.length) out.push(`[Hoja: ${names[i] ?? i + 1}]\n${rows.join("\n")}`);
  }
  return out.join("\n\n");
}
