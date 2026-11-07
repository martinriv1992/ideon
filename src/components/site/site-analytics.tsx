"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { captureAttribution, getConsent, setConsent, track, type AnalyticsEvent } from "@/lib/analytics";

const GA_ID = process.env.NEXT_PUBLIC_GA_ID;

function loadGa(id: string) {
  if (document.getElementById("ga4")) return;
  const w = window as Window & { dataLayer?: unknown[]; gtag?: (...a: unknown[]) => void };
  w.dataLayer ??= [];
  // gtag exige el objeto `arguments` (no un array) en dataLayer.
  // eslint-disable-next-line prefer-rest-params
  w.gtag = function gtag() { (w.dataLayer as unknown[]).push(arguments); };
  w.gtag("js", new Date());
  // Páginas vistas manuales (navegación SPA) y sin datos personales.
  w.gtag("config", id, { send_page_view: false, anonymize_ip: true });
  const s = document.createElement("script");
  s.id = "ga4"; s.async = true; s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`;
  document.head.appendChild(s);
}

/**
 * Analítica del sitio público: origen del visitante, páginas vistas, clics con
 * data-track="evento" y aviso de cookies (solo si hay GA4 configurado).
 */
export function SiteAnalytics() {
  const pathname = usePathname();
  const locale = useLocale();
  const t = useTranslations("site.cookies");
  const [consent, setC] = useState<"granted" | "denied" | null | "unknown">("unknown");

  useEffect(() => {
    captureAttribution();
    const c = getConsent(); setC(c);
    if (GA_ID && c === "granted") loadGa(GA_ID);
    const onClick = (e: MouseEvent) => {
      const el = (e.target as HTMLElement | null)?.closest<HTMLElement>("[data-track]");
      if (el) track(el.dataset.track as AnalyticsEvent, { label: el.dataset.trackLabel, locale });
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, [locale]);

  useEffect(() => { track("page_view", { page_path: pathname, locale }); }, [pathname, locale]);

  if (!GA_ID || consent !== null) return null;
  return (
    <div role="dialog" aria-live="polite" className="fixed z-50 inset-x-3 bottom-3 sm:left-6 sm:right-auto sm:max-w-md rounded-[14px] border border-border bg-surface-2 p-4 shadow-xl shadow-black/30">
      <p className="text-[13px] text-fg-muted leading-relaxed">{t("text")}</p>
      <div className="mt-3 flex gap-2 justify-end">
        <Button size="sm" variant="ghost" onClick={() => { setConsent("denied"); setC("denied"); }}>{t("reject")}</Button>
        <Button size="sm" onClick={() => { setConsent("granted"); setC("granted"); loadGa(GA_ID); track("page_view", { page_path: pathname, locale }); }}>{t("accept")}</Button>
      </div>
    </div>
  );
}

/** Registra un evento al montar (p. ej. solution_viewed en una página de producto). */
export function TrackOnView({ event, params }: { event: AnalyticsEvent; params?: Record<string, string> }) {
  useEffect(() => { track(event, params); }, [event, params]);
  return null;
}
