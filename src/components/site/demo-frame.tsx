"use client";

import { useEffect, useRef, useState } from "react";
import { ExternalLink, Loader2 } from "lucide-react";
import { track } from "@/lib/analytics";

/**
 * Demostración incrustada. Es un HTML estático servido en /demo/<slug>: los
 * datos son ficticios y solo viven en el navegador del visitante (localStorage),
 * sin acceso a la base de datos de producción. El iframe va sin allow-same-origin:
 * la demo no puede leer cookies ni almacenamiento del sitio principal.
 */
export function DemoFrame({ slug, title, loadingLabel, fullscreenLabel, event }: { slug: string; title: string; loadingLabel: string; fullscreenLabel: string; event?: "inventory_demo_opened" }) {
  const ref = useRef<HTMLIFrameElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // Carga diferida: el iframe se crea cuando la sección se acerca al viewport.
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const io = new IntersectionObserver((e) => { if (e.some((x) => x.isIntersecting)) { setVisible(true); io.disconnect(); } }, { rootMargin: "300px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  function onLoad() {
    setLoaded(true);
    if (event) track(event, { demo: slug });
  }

  // La demo corre aislada (origen opaco): se detecta la interacción cuando el foco entra en el iframe.
  useEffect(() => {
    let last = 0;
    const onBlur = () => {
      if (document.activeElement !== ref.current) return;
      const now = Date.now();
      if (now - last > 15_000) { last = now; track("demo_interaction", { demo: slug }); }
    };
    window.addEventListener("blur", onBlur);
    return () => window.removeEventListener("blur", onBlur);
  }, [slug]);

  return (
    <div ref={box} className="rounded-[18px] border border-border bg-surface overflow-hidden shadow-2xl shadow-black/30">
      <div className="flex items-center gap-2 px-4 h-10 border-b border-border bg-surface-2">
        <span className="size-2.5 rounded-full bg-[#ff5f57]" aria-hidden /><span className="size-2.5 rounded-full bg-[#febc2e]" aria-hidden /><span className="size-2.5 rounded-full bg-[#28c840]" aria-hidden />
        <span className="ml-3 text-[12px] text-fg-subtle truncate">{title}</span>
        <a href={`/demo/${slug}`} target="_blank" rel="noreferrer" className="ml-auto inline-flex items-center gap-1 text-[12px] text-fg-muted hover:text-fg shrink-0" data-track={event} data-track-label="fullscreen">
          {fullscreenLabel} <ExternalLink className="size-3" aria-hidden />
        </a>
      </div>
      <div className="relative h-[70vh] min-h-[520px] max-h-[820px] bg-white">
        {!loaded && <div className="absolute inset-0 flex items-center justify-center gap-2 text-[14px] text-zinc-500"><Loader2 className="size-4 animate-spin" aria-hidden /> {loadingLabel}</div>}
        {visible && <iframe ref={ref} src={`/demo/${slug}`} title={title} onLoad={onLoad} className="absolute inset-0 w-full h-full" loading="lazy" sandbox="allow-scripts allow-forms allow-modals allow-downloads allow-popups" />}
      </div>
    </div>
  );
}
