import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { headers } from "next/headers";
import { ArrowRight, ExternalLink } from "lucide-react";
import { Container } from "@/components/ui/card";
import { CtaLink, OwnershipBand } from "@/components/site/sections";
import { TrackOnView } from "@/components/site/site-analytics";
import { PRICING, formatFrom, regionForCountry } from "@/content/commercial/pricing";
import { jsonLd, pageMetadata, serviceLd } from "@/lib/seo";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "site.meta" });
  return pageMetadata({ locale, path: "/crm", title: t("crmTitle"), description: t("crmDescription") });
}

export default async function CrmPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("site.crm");
  const tm = await getTranslations("site.meta");
  const tp = await getTranslations("site.portfolio");
  const modules = t.raw("modules") as { title: string; text: string }[];
  const plan = PRICING[regionForCountry((await headers()).get("x-vercel-ip-country"))];
  const from = plan.tiers.find((x) => x.key === "systems")!.from;
  return (
    <div className="pt-28 sm:pt-32 pb-24">
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(serviceLd(locale, "/crm", tm("crmTitle"), tm("crmDescription")))} />
      <TrackOnView event="solution_viewed" params={{ solution: "crm" }} />
      <Container>
        <div className="grid lg:grid-cols-[1fr_1.1fr] gap-12 items-center">
          <div>
            <p className="text-[13px] font-medium text-accent">{t("eyebrow")}</p>
            <h1 className="mt-3 text-4xl sm:text-5xl font-semibold tracking-tight text-balance">{t("title")}</h1>
            <p className="mt-5 text-lg text-fg-muted leading-relaxed">{t("subtitle")}</p>
            <div className="mt-8 flex flex-col sm:flex-row gap-3">
              <CtaLink href={`/${locale}/contact?solution=crm&intent=meeting`} track="meeting_cta_clicked" trackLabel="crm_hero">{t("cta")} <ArrowRight className="size-4" aria-hidden /></CtaLink>
              <CtaLink href="/demo/ideon-crm" variant="secondary" external>{t("ctaDemo")} <ExternalLink className="size-4" aria-hidden /></CtaLink>
            </div>
            {locale === "en" && <p className="mt-3 text-[13px] text-fg-subtle">{tp("spanishOnly")}</p>}
          </div>
          <a href="/demo/ideon-crm" target="_blank" rel="noreferrer" className="block group">
            <figure className="rounded-[18px] border border-border bg-surface overflow-hidden shadow-2xl shadow-black/30">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/showcase/ideon-crm.jpg" alt={t("demoText")} width={1280} height={800} className="w-full h-auto" />
              <figcaption className="px-4 py-2.5 text-[12px] text-fg-subtle border-t border-border">{t("demoTitle")} · {t("demoText")}</figcaption>
            </figure>
          </a>
        </div>
        <h2 className="mt-20 text-2xl font-semibold tracking-tight">{t("modulesTitle")}</h2>
        <div className="mt-8 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {modules.map((m) => (
            <div key={m.title} className="rounded-[14px] border border-border bg-surface p-5">
              <h3 className="font-semibold">{m.title}</h3>
              <p className="mt-1.5 text-[14px] text-fg-muted leading-relaxed">{m.text}</p>
            </div>
          ))}
        </div>
        <div className="mt-12 rounded-[18px] border border-accent/40 bg-surface-2 p-7 flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
          <p className="text-[15px] text-fg-muted">{t("priceText", { price: formatFrom(from, plan.currency, locale) })}</p>
          <CtaLink href={`/${locale}/contact?solution=crm`} track="proposal_requested" trackLabel="crm_pricing" className="shrink-0">{t("cta")}</CtaLink>
        </div>
        <div className="mt-6"><OwnershipBand /></div>
      </Container>
    </div>
  );
}
