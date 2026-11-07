import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ArrowRight, Bot, Code2, Globe, Workflow } from "lucide-react";
import { Container } from "@/components/ui/card";
import { CtaLink, HowWeWork, StartAndPricing } from "@/components/site/sections";
import { TrackOnView } from "@/components/site/site-analytics";
import { jsonLd, pageMetadata, serviceLd } from "@/lib/seo";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "site.meta" });
  return pageMetadata({ locale, path: "/custom-software", title: t("customTitle"), description: t("customDescription") });
}

const ICONS: Record<string, typeof Code2> = { business: Code2, ai: Bot, web: Globe, automation: Workflow };

export default async function CustomSoftwarePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("site.custom");
  const tm = await getTranslations("site.meta");
  const areas = t.raw("areas") as { id: string; title: string; text: string }[];
  return (
    <div className="pt-28 sm:pt-32">
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(serviceLd(locale, "/custom-software", tm("customTitle"), tm("customDescription")))} />
      <TrackOnView event="solution_viewed" params={{ solution: "custom" }} />
      <Container>
        <div className="max-w-3xl">
          <p className="text-[13px] font-medium text-accent">{t("eyebrow")}</p>
          <h1 className="mt-3 text-4xl sm:text-5xl font-semibold tracking-tight text-balance">{t("title")}</h1>
          <p className="mt-5 text-lg text-fg-muted leading-relaxed">{t("subtitle")}</p>
          <div className="mt-8 flex flex-col sm:flex-row gap-3">
            <CtaLink href={`/${locale}/contact?solution=custom&intent=meeting`} track="meeting_cta_clicked" trackLabel="custom_hero">{t("cta")} <ArrowRight className="size-4" aria-hidden /></CtaLink>
            <CtaLink href={`/${locale}#start`} variant="secondary">{t("ctaSelf")}</CtaLink>
          </div>
        </div>
        <h2 className="mt-20 text-2xl font-semibold tracking-tight">{t("areasTitle")}</h2>
        <div className="mt-8 grid sm:grid-cols-2 gap-4">
          {areas.map((a) => {
            const Icon = ICONS[a.id] ?? Code2;
            return (
              <div key={a.id} id={a.id} className="scroll-mt-24 rounded-[16px] border border-border bg-surface p-6">
                <Icon className="size-5 text-accent" aria-hidden />
                <h3 className="mt-3 text-[17px] font-semibold">{a.title}</h3>
                <p className="mt-1.5 text-[14.5px] text-fg-muted leading-relaxed">{a.text}</p>
                <a href={`/${locale}/contact?solution=${a.id === "business" ? "custom" : a.id}`} className="mt-4 inline-flex items-center gap-1.5 text-[13.5px] font-medium text-accent" data-track="proposal_requested" data-track-label={`custom_${a.id}`}>{t("cta")} <ArrowRight className="size-3.5" aria-hidden /></a>
              </div>
            );
          })}
        </div>
        <div className="mt-12 rounded-[18px] border border-border bg-surface-2 p-7 flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
          <div><h2 className="text-lg font-semibold">{t("selfTitle")}</h2><p className="mt-1 text-[14.5px] text-fg-muted">{t("selfText")}</p></div>
          <CtaLink href={`/${locale}#start`} variant="secondary" className="shrink-0">{t("ctaSelf")}</CtaLink>
        </div>
      </Container>
      <HowWeWork />
      <StartAndPricing />
    </div>
  );
}
