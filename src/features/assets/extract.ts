import "server-only";
import { docxText, normalize, pptxText, xlsxText } from "./office";

/**
 * Extracción de texto de los documentos del cliente para que los agentes los lean.
 * PDF con unpdf; DOCX/XLSX/PPTX leyendo el XML del paquete Office; texto plano tal cual.
 */

export const MAX_STORED_CHARS = 60_000;

export type ExtractResult = { status: "ok" | "empty" | "failed" | "unsupported"; text: string | null };

export async function extractText(ext: string, data: ArrayBuffer): Promise<ExtractResult> {
  try {
    let text: string;
    switch (ext) {
      case "pdf": text = await pdfText(data); break;
      case "docx": text = await docxText(data); break;
      case "xlsx": text = await xlsxText(data); break;
      case "pptx": text = await pptxText(data); break;
      case "txt": case "md": case "csv": case "json":
        text = new TextDecoder("utf-8", { fatal: false }).decode(data); break;
      default: return { status: "unsupported", text: null };
    }
    text = normalize(text);
    if (!text) return { status: "empty", text: null };
    return { status: "ok", text: text.slice(0, MAX_STORED_CHARS) };
  } catch {
    return { status: "failed", text: null };
  }
}

async function pdfText(data: ArrayBuffer) {
  const { extractText: pdf, getDocumentProxy } = await import("unpdf");
  const doc = await getDocumentProxy(new Uint8Array(data));
  const { text } = await pdf(doc, { mergePages: false });
  return (text as string[]).map((p, i) => `[Página ${i + 1}]\n${p}`).join("\n\n");
}
