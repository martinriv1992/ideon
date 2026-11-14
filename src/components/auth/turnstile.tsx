"use client";

import { useEffect, useRef, useState } from "react";

type TurnstileApi = { render: (el: HTMLElement, o: Record<string, unknown>) => string; reset: (id?: string) => void; remove: (id?: string) => void };
const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
const SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

/**
 * Captcha de Cloudflare Turnstile (casi siempre invisible). Deja el token en un campo oculto
 * «captchaToken» del formulario; `resetKey` lo renueva tras cada intento (el token es de un solo uso).
 * Sin NEXT_PUBLIC_TURNSTILE_SITE_KEY no se muestra nada.
 */
export function Turnstile({ resetKey, locale }: { resetKey?: unknown; locale?: string }) {
  const box = useRef<HTMLDivElement>(null);
  const widget = useRef<string | null>(null);
  const [token, setToken] = useState("");

  useEffect(() => {
    if (!SITE_KEY) return;
    let cancelled = false;
    const api = () => (window as unknown as { turnstile?: TurnstileApi }).turnstile;
    const mount = () => {
      if (cancelled || !box.current || widget.current || !api()) return;
      widget.current = api()!.render(box.current, {
        sitekey: SITE_KEY, language: locale === "en" ? "en" : "es", theme: "dark", size: "flexible",
        callback: (t: string) => setToken(t), "expired-callback": () => setToken(""), "error-callback": () => setToken(""),
      });
    };
    if (api()) mount();
    else {
      let s = document.querySelector<HTMLScriptElement>(`script[src="${SRC}"]`);
      if (!s) { s = document.createElement("script"); s.src = SRC; s.async = true; document.head.appendChild(s); }
      s.addEventListener("load", mount);
    }
    return () => { cancelled = true; if (widget.current && api()) { api()!.remove(widget.current); widget.current = null; } };
  }, [locale]);

  // Tras un intento (con error), pedir un token nuevo.
  useEffect(() => {
    const api = (window as unknown as { turnstile?: TurnstileApi }).turnstile;
    if (widget.current && api) { setToken(""); api.reset(widget.current); }
  }, [resetKey]);

  if (!SITE_KEY) return null;
  return (
    <div>
      <div ref={box} />
      <input type="hidden" name="captchaToken" value={token} />
    </div>
  );
}
