"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { PRICING, formatFrom, type PricingRegion } from "@/content/commercial/pricing";
import { cn } from "@/lib/utils";

/** Precios indicativos con selector de región (Colombia en COP · internacional en USD). */
export function PricingTable({ defaultRegion }: { defaultRegion: PricingRegion }) {
  const t = useTranslations("site.pricing");
  const locale = useLocale();
  const [region, setRegion] = useState<PricingRegion>(defaultRegion);
  const plan = PRICING[region];
  return (
    <div>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <span className="text-[13px] text-fg-subtle">{t("regionLabel")}</span>
        <div className="inline-flex rounded-full border border-border bg-surface p-1" role="tablist">
          {(Object.keys(PRICING) as PricingRegion[]).map((r) => (
            <button key={r} type="button" role="tab" aria-selected={region === r} onClick={() => setRegion(r)}
              className={cn("h-8 px-3.5 rounded-full text-[13px] font-medium transition-colors", region === r ? "bg-fg text-bg" : "text-fg-muted hover:text-fg")}>
              {t(`regions.${r}`)}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-6 grid md:grid-cols-3 gap-4">
        {plan.tiers.map((tier) => (
          <div key={tier.key} className={cn("rounded-[16px] border bg-surface p-6", tier.key === "systems" ? "border-accent/50" : "border-border")}>
            <h3 className="font-semibold">{t(`tiers.${tier.key}.title`)}</h3>
            <p className="mt-1 text-[14px] text-fg-muted min-h-[42px]">{t(`tiers.${tier.key}.text`)}</p>
            <p className="mt-4 text-[13px] text-fg-subtle">{t("from")}</p>
            <p className="text-2xl font-semibold tracking-tight tabular-nums">{formatFrom(tier.from, plan.currency, locale)}</p>
          </div>
        ))}
      </div>
      <p className="mt-5 text-center text-[13px] text-fg-subtle max-w-3xl mx-auto leading-relaxed">{t("note")}</p>
    </div>
  );
}
