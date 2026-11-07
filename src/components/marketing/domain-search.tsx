"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Check, Globe, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { money } from "@/lib/money";
import { cn } from "@/lib/utils";

interface Result { domain: string; available: boolean; price?: number; currency?: string; unsupported?: boolean }

/** Buscador público de dominios: disponibilidad y precio anual. La compra se hace al activar el proyecto. */
export function DomainSearch() {
  const t = useTranslations("domains");
  const locale = useLocale();
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<Result[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function search() {
    setBusy(true); setError(null);
    try {
      const res = await fetch(`/api/domains/search?q=${encodeURIComponent(q)}`);
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error?.message || t("error"));
      setResults(body.results as Result[]);
    } catch (e) { setError((e as Error).message); setResults(null); }
    finally { setBusy(false); }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (q.trim().length >= 2) void search(); }}>
        <div className="relative flex-1">
          <Globe className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-fg-subtle" aria-hidden />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("placeholder")} className="h-12 pl-9 text-[15px]" aria-label={t("label")} maxLength={63} />
        </div>
        <Button type="submit" size="lg" loading={busy} disabled={q.trim().length < 2}><Search className="size-4" /> {t("search")}</Button>
      </form>
      {error && <p className="mt-3 text-[13px] text-danger" role="alert">{error}</p>}
      {results && (
        <div className="mt-4 space-y-1.5">
          {results.map((r) => (
            <div key={r.domain} className={cn("flex items-center gap-3 rounded-[12px] border px-4 py-3", r.available ? "border-border bg-surface" : "border-border/60 bg-surface/50")}>
              {r.available ? <Check className="size-4 text-success shrink-0" /> : <X className="size-4 text-fg-subtle shrink-0" />}
              <span className={cn("flex-1 font-medium", !r.available && "text-fg-subtle")}>{r.domain}</span>
              {r.available && r.price != null
                ? <span className="tabular-nums text-[14px]">{money(r.price, r.currency!, locale)}<span className="text-fg-subtle text-[12px]">/{t("year")}</span></span>
                : <span className="text-[13px] text-fg-subtle">{t("taken")}</span>}
            </div>
          ))}
          <p className="pt-2 text-[13px] text-fg-muted text-center leading-relaxed">{t("how")}</p>
          <div className="pt-1 flex justify-center">
            <a href={`/${locale}#start`}><Button variant="secondary">{t("cta")}</Button></a>
          </div>
        </div>
      )}
    </div>
  );
}
