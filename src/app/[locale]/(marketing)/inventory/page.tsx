import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { headers } from "next/headers";
import { ArrowRight, Check } from "lucide-react";
import { Container } from "@/components/ui/card";
import { CtaLink, OwnershipBand } from "@/components/site/sections";
import { DemoFrame } from "@/components/site/demo-frame";
import { TrackOnView } from "@/components/site/site-analytics";
import { PRICING, formatFrom, regionForCountry } from "@/content/commercial/pricing";
import { jsonLd, pageMetadata, serviceLd } from "@/lib/seo";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "site.meta" });
  return pageMetadata({ locale, path: "/inventory", title: t("inventoryTitle"), description: t("inventoryDescription") });
}

export default async function InventoryPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("site.inventory");
  const tm = await getTranslations("site.meta");
  const modules = t.raw("modules") as { title: string; text: string }[];
  const fit = t.raw("fit") as string[];
  const plan = PRICING[regionForCountry((await headers()).get("x-vercel-ip-country"))];
  const from = plan.tiers.find((x) => x.key === "systems")!.from;
  const demo = locale === "en" ? "nova-distribution-en" : "nova-distribution";
  return (
    <div className="pt-28 sm:pt-32">
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(serviceLd(locale, "/inventory", tm("inventoryTitle"), tm("inventoryDescription")))} />
      <TrackOnView event="solution_viewed" params={{ solution: "inventory" }} />
      <Container>
        <div className="max-w-3xl">
          <p className="text-[13px] font-medium text-accent">{t("eyebrow")}</p>
          <h1 className="mt-3 text-4xl sm:text-5xl font-semibold tracking-tight text-balance">{t("title")}</h1>
          <p className="mt-5 text-lg text-fg-muted leading-relaxed">{t("subtitle")}</p>
          <div className="mt-8 flex flex-col sm:flex-row gap-3">
            <CtaLink href="#demo">{t("ctaDemo")} <ArrowRight className="size-4" aria-hidden /></CtaLink>
            <CtaLink href={`/${locale}/contact?solution=inventory&intent=meeting`} variant="secondary" track="meeting_cta_clicked" trackLabel="inventory_hero">{t("cta")}</CtaLink>
          </div>
        </div>
      </Container>

      <section id="demo" className="mt-16 scroll-mt-20">
        <Container>
          <h2 className="text-2xl font-semibold tracking-tight">{t("demoTitle")}</h2>
          <p className="mt-2 text-[15px] text-fg-muted max-w-3xl">{t("demoText")}</p>
          <div className="mt-6"><DemoFrame slug={demo} title="NOVA Distribution" loadingLabel={t("demoLoading")} fullscreenLabel={t("demoFullscreen")} event="inventory_demo_opened" /></div>
        </Container>
      </section>

      <section className="py-20">
        <Container>
          <h2 className="text-2xl font-semibold tracking-tight">{t("modulesTitle")}</h2>
          <div className="mt-8 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {modules.map((m) => (
              <div key={m.title} className="rounded-[14px] border border-border bg-surface p-5">
                <h3 className="font-semibold">{m.title}</h3>
                <p className="mt-1.5 text-[14px] text-fg-muted leading-relaxed">{m.text}</p>
              </div>
            ))}
          </div>
        </Container>
      </section>

      <section id="pricing" className="pb-24 scroll-mt-20">
        <Container>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="rounded-[18px] border border-border bg-surface p-7">
              <h2 className="text-xl font-semibold">{t("fitTitle")}</h2>
              <ul className="mt-4 space-y-2.5">{fit.map((f) => <li key={f} className="flex gap-2.5 text-[14.5px] text-fg-muted"><Check className="size-4 mt-0.5 text-success shrink-0" aria-hidden />{f}</li>)}</ul>
            </div>
            <div className="rounded-[18px] border border-accent/40 bg-surface-2 p-7 flex flex-col">
              <h2 className="text-xl font-semibold">{t("priceTitle")}</h2>
              <p className="mt-3 text-[15px] text-fg-muted leading-relaxed flex-1">{t("priceText", { price: formatFrom(from, plan.currency, locale) })}</p>
              <div className="mt-6"><CtaLink href={`/${locale}/contact?solution=inventory`} track="proposal_requested" trackLabel="inventory_pricing">{t("cta")} <ArrowRight className="size-4" aria-hidden /></CtaLink></div>
            </div>
          </div>
          <div className="mt-6"><OwnershipBand /></div>
        </Container>
      </section>
    </div>
  );
}
