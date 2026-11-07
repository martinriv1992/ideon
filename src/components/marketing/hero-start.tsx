"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Globe, Sparkles } from "lucide-react";
import { IdeaComposer } from "./idea-composer";
import { DomainSearch } from "./domain-search";
import { cn } from "@/lib/utils";

/** Punto de partida de la portada: describir la idea o buscar el dominio, en el mismo lugar. */
export function HeroStart({ isAuthenticated }: { isAuthenticated: boolean }) {
  const t = useTranslations("hero");
  const [tab, setTab] = useState<"idea" | "domain">("idea");
  const [chosen, setChosen] = useState<string | null>(null);

  // El enlace «Dominios» del menú (/#domains) o ?tab=domain abren directamente el buscador.
  useEffect(() => {
    const sync = () => { if (window.location.hash === "#domains" || new URLSearchParams(window.location.search).get("tab") === "domain") setTab("domain"); };
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);

  const tabs = [
    { key: "idea" as const, icon: Sparkles, label: t("tabIdea") },
    { key: "domain" as const, icon: Globe, label: t("tabDomain") },
  ];
  return (
    <div id="domains" className="scroll-mt-28">
      <div className="mb-5 flex justify-center">
        <div className="inline-flex rounded-full border border-border bg-surface p-1" role="tablist">
          {tabs.map((x) => (
            <button key={x.key} type="button" role="tab" aria-selected={tab === x.key} onClick={() => setTab(x.key)}
              className={cn("inline-flex items-center gap-1.5 h-9 px-4 rounded-full text-[13.5px] font-medium transition-colors",
                tab === x.key ? "bg-fg text-bg" : "text-fg-muted hover:text-fg")}>
              <x.icon className="size-4" aria-hidden /> {x.label}
            </button>
          ))}
        </div>
      </div>
      {tab === "idea" ? (
        <>
          {chosen && <p className="mb-3 text-center text-[13.5px] text-success">{t("domainChosen", { domain: chosen })}</p>}
          <IdeaComposer isAuthenticated={isAuthenticated} />
        </>
      ) : (
        <div id="start-domain" className="w-full max-w-3xl mx-auto">
          <DomainSearch onChosen={(d) => { setChosen(d); setTab("idea"); }} />
        </div>
      )}
    </div>
  );
}
