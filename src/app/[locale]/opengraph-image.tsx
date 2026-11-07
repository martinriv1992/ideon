import { ImageResponse } from "next/og";

export const alt = "Ideonapp · AI Software Studio";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Imagen para redes sociales, en el idioma de la página. */
export default async function OgImage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const en = locale === "en";
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 72, background: "linear-gradient(135deg,#0b0b10 0%,#16131f 60%,#1d1730 100%)", color: "#fff", fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ width: 56, height: 56, borderRadius: 14, background: "#7c6cf2", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 30, fontWeight: 700 }}>i</div>
          <div style={{ fontSize: 34, fontWeight: 600 }}>Ideonapp</div>
          <div style={{ marginLeft: 12, fontSize: 20, color: "#b9b2f7", border: "1px solid #3b3460", borderRadius: 999, padding: "6px 16px" }}>AI Software Studio</div>
        </div>
        <div style={{ fontSize: 64, fontWeight: 700, lineHeight: 1.1, letterSpacing: -1.5, maxWidth: 1000 }}>
          {en ? "We build the software your business actually needs." : "Construimos el software que tu empresa realmente necesita."}
        </div>
        <div style={{ fontSize: 26, color: "#a1a1aa" }}>
          {en ? "Custom software · Inventory · CRM · AI applications" : "Software a medida · Inventarios · CRM · Aplicaciones con IA"}
        </div>
      </div>
    ),
    size,
  );
}
