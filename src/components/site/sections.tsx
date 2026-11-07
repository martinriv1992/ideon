import { getLocale, getTranslations } from "next-intl/server";
import { headers } from "next/headers";
import {
  ArrowRight, Bot, Boxes, BriefcaseBusiness, Check, Code2, Compass, DraftingCompass, ExternalLink, FileCheck2, Gauge, Globe,
  KeyRound, Layers, Palette, Rocket, ShieldCheck, SlidersHorizontal, Sparkles, Users, Workflow, Eye, Scale, Handshake,
} from "lucide-react";
import { Badge, Card, Container, SectionHeading } from "@/components/ui/card";
import { Reveal } from "@/components/marketing/reveal";
import { HeroStart } from "@/components/marketing/hero-start";
import { PricingTable } from "./pricing-table";
import { regionForCountry } from "@/content/commercial/pricing";
import { cn } from "@/lib/utils";

/** Enlace con aspecto de botón (los CTA son enlaces reales, no botones decorativos). */
export function CtaLink({ href, children, variant = "primary", track, trackLabel, className, external }: {
  href: string; children: React.ReactNode; variant?: "primary" | "secondary" | "ghost"; track?: string; trackLabel?: string; className?: string; external?: boolean;
}) {
  return (
    <a href={href} data-track={track} data-track-label={trackLabel} {...(external ? { target: "_blank", rel: "noreferrer" } : {})}
      className={cn("inline-flex items-center justify-center gap-1.5 h-11 px-5 rounded-[12px] text-[14.5px] font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
        variant === "primary" && "bg-fg text-bg hover:opacity-90",
        variant === "secondary" && "border border-border bg-surface text-fg hover:border-border-strong",
        variant === "ghost" && "text-fg-muted hover:text-fg", className)}>
      {children}
    </a>
  );
}

/* ----------------------------------------------------------------------------- HERO */
export async function SiteHero({ isAuthenticated }: { isAuthenticated: boolean }) {
  const t = await getTranslations("site.hero");
  const locale = await getLocale();
  return (
    <section className="relative pt-32 pb-20 sm:pt-40 sm:pb-24 overflow-hidden">
      <div className="absolute inset-0 grid-fade pointer-events-none" aria-hidden />
      <div className="absolute left-1/2 top-0 -translate-x-1/2 w-[900px] h-[480px] rounded-full bg-accent/15 blur-[140px] opacity-60 pointer-events-none" aria-hidden />
      <Container className="relative">
        <div className="text-center max-w-4xl mx-auto">
          <Badge tone="accent" className="animate-fade-in"><span className="size-1.5 rounded-full bg-accent" />{t("badge")}</Badge>
          <h1 className="mt-6 text-4xl sm:text-6xl font-semibold tracking-[-0.03em] leading-[1.05] text-balance animate-fade-up">{t("title")}</h1>
          <p className="mt-6 mx-auto max-w-2xl text-base sm:text-lg text-fg-muted leading-relaxed text-pretty animate-fade-up [animation-delay:120ms]">{t("subtitle")}</p>
          <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center animate-fade-up [animation-delay:180ms]">
            <CtaLink href={`/${locale}/contact?intent=meeting`} track="meeting_cta_clicked" trackLabel="hero">{t("ctaPrimary")} <ArrowRight className="size-4" aria-hidden /></CtaLink>
            <CtaLink href={`/${locale}#solutions`} variant="secondary">{t("ctaSecondary")}</CtaLink>
          </div>
        </div>
        <div className="mt-16 animate-fade-up [animation-delay:260ms]">
          <p className="text-center text-[13.5px] text-fg-subtle mb-4">{t("selfServe")}</p>
          <HeroStart isAuthenticated={isAuthenticated} />
        </div>
      </Container>
    </section>
  );
}

/* ----------------------------------------------------------------------------- SOLUCIONES */
const SOLUTION_ICONS = { custom: Code2, inventory: Boxes, crm: Users, business: BriefcaseBusiness, ai: Bot, web: Globe, automation: Workflow } as const;
export const SOLUTION_KEYS = Object.keys(SOLUTION_ICONS) as (keyof typeof SOLUTION_ICONS)[];

export async function Solutions() {
  const t = await getTranslations("site.solutions");
  const locale = await getLocale();
  const href: Record<keyof typeof SOLUTION_ICONS, string> = {
    custom: `/${locale}/custom-software`, inventory: `/${locale}/inventory`, crm: `/${locale}/crm`, business: `/${locale}/business`,
    ai: `/${locale}/contact?solution=ai`, web: `/${locale}#start`, automation: `/${locale}/contact?solution=automation`,
  };
  return (
    <section id="solutions" className="py-24 scroll-mt-16 border-t border-border">
      <Container>
        <Reveal><SectionHeading eyebrow={t("eyebrow")} title={t("title")} description={t("description")} /></Reveal>
        <div className="mt-14 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {SOLUTION_KEYS.map((k, i) => {
            const Icon = SOLUTION_ICONS[k];
            return (
              <Reveal key={k} delay={Math.min(i * 0.04, 0.24)} className={cn(k === "custom" && "lg:col-span-1")}>
                <a href={href[k]} className="group block h-full" data-track={k === "inventory" || k === "crm" ? undefined : "proposal_requested"} data-track-label={k}>
                  <Card hover className="h-full p-6 flex flex-col">
                    <div className="size-10 rounded-[12px] bg-accent-soft text-accent flex items-center justify-center"><Icon className="size-5" aria-hidden /></div>
                    <h3 className="mt-5 text-[17px] font-semibold tracking-tight">{t(`items.${k}.title`)}</h3>
                    <p className="mt-2 text-[14px] text-fg-muted leading-relaxed flex-1">{t(`items.${k}.text`)}</p>
                    <span className="mt-5 inline-flex items-center gap-1.5 text-[13.5px] font-medium text-accent">{t(`items.${k}.cta`)} <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden /></span>
                  </Card>
                </a>
              </Reveal>
            );
          })}
        </div>
      </Container>
    </section>
  );
}

/* ----------------------------------------------------------------------------- PRODUCTO DESTACADO */
export async function FeaturedInventory() {
  const t = await getTranslations("site.featured");
  const locale = await getLocale();
  const points = t.raw("points") as string[];
  const demo = locale === "en" ? "nova-distribution-en" : "nova-distribution";
  return (
    <section id="featured" className="py-24 scroll-mt-16 border-t border-border bg-bg-elevated">
      <Container>
        <div className="grid lg:grid-cols-[1fr_1.15fr] gap-12 items-center">
          <Reveal>
            <p className="text-[13px] font-medium text-accent">{t("eyebrow")}</p>
            <h2 className="mt-3 text-3xl sm:text-4xl font-semibold tracking-tight text-balance">{t("title")}</h2>
            <p className="mt-4 text-[16px] text-fg-muted leading-relaxed">{t("text")}</p>
            <ul className="mt-6 space-y-2.5">
              {points.map((p) => <li key={p} className="flex items-start gap-2.5 text-[14.5px] text-fg-muted"><Check className="size-4 mt-0.5 text-success shrink-0" aria-hidden />{p}</li>)}
            </ul>
            <div className="mt-8 flex flex-wrap gap-3">
              <CtaLink href={`/${locale}/inventory#demo`} track="inventory_demo_opened" trackLabel="home_featured">{t("cta")} <ArrowRight className="size-4" aria-hidden /></CtaLink>
              <CtaLink href={`/${locale}/inventory#pricing`} variant="secondary">{t("secondary")}</CtaLink>
            </div>
          </Reveal>
          <Reveal delay={0.08}>
            <a href={`/${locale}/inventory#demo`} data-track="inventory_demo_opened" data-track-label="home_screenshot" className="block group">
              <figure className="rounded-[18px] border border-border bg-surface overflow-hidden shadow-2xl shadow-black/30">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/showcase/${demo}.jpg`} alt={t("demoLabel")} width={1280} height={800} loading="lazy" className="w-full h-auto transition-transform duration-500 group-hover:scale-[1.01]" />
                <figcaption className="px-4 py-2.5 text-[12px] text-fg-subtle border-t border-border">{t("demoLabel")}</figcaption>
              </figure>
            </a>
          </Reveal>
        </div>
      </Container>
    </section>
  );
}

/* ----------------------------------------------------------------------------- CÓMO TRABAJAMOS */
const STEP_ICONS = [Compass, DraftingCompass, Palette, Code2, ShieldCheck, Rocket];
export async function HowWeWork() {
  const t = await getTranslations("site.how");
  const steps = t.raw("steps") as { title: string; text: string }[];
  return (
    <section id="process" className="py-24 scroll-mt-16 border-t border-border">
      <Container>
        <Reveal><SectionHeading eyebrow={t("eyebrow")} title={t("title")} description={t("description")} /></Reveal>
        <div role="list" className="mt-14 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {steps.map((s, i) => {
            const Icon = STEP_ICONS[i] ?? Sparkles;
            return (
              <Reveal key={s.title} delay={i * 0.04}>
                <div role="listitem" className="h-full rounded-[16px] border border-border bg-surface p-6">
                  <div className="flex items-center gap-3">
                    <span className="size-9 rounded-[10px] bg-accent-soft text-accent flex items-center justify-center"><Icon className="size-[18px]" aria-hidden /></span>
                    <span className="text-[12px] font-medium text-fg-subtle tabular-nums">0{i + 1}</span>
                  </div>
                  <h3 className="mt-4 text-[16px] font-semibold">{s.title}</h3>
                  <p className="mt-1.5 text-[14px] text-fg-muted leading-relaxed">{s.text}</p>
                </div>
              </Reveal>
            );
          })}
        </div>
      </Container>
    </section>
  );
}

/* ----------------------------------------------------------------------------- POR QUÉ IDEONAPP */
const WHY_ICONS = [SlidersHorizontal, Sparkles, Scale, Eye, Layers, Gauge, FileCheck2, KeyRound];
export async function WhyIdeonapp() {
  const t = await getTranslations("site.why");
  const items = t.raw("items") as { title: string; text: string }[];
  return (
    <section id="why" className="py-24 scroll-mt-16 border-t border-border bg-bg-elevated">
      <Container>
        <Reveal><SectionHeading eyebrow={t("eyebrow")} title={t("title")} /></Reveal>
        <div className="mt-14 grid sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-8">
          {items.map((it, i) => {
            const Icon = WHY_ICONS[i] ?? Handshake;
            return (
              <Reveal key={it.title} delay={Math.min(i * 0.03, 0.2)}>
                <Icon className="size-5 text-accent" aria-hidden />
                <h3 className="mt-3 text-[15px] font-semibold">{it.title}</h3>
                <p className="mt-1.5 text-[14px] text-fg-muted leading-relaxed">{it.text}</p>
              </Reveal>
            );
          })}
        </div>
      </Container>
    </section>
  );
}

/* ----------------------------------------------------------------------------- PORTAFOLIO */
export async function PortfolioGrid({ heading = true }: { heading?: boolean }) {
  const t = await getTranslations("site.portfolio");
  const locale = await getLocale();
  const items = [
    { key: "inventory", slug: locale === "en" ? "nova-distribution-en" : "nova-distribution", page: `/${locale}/inventory#demo`, spanishOnly: false },
    { key: "crm", slug: "ideon-crm", page: `/demo/ideon-crm`, spanishOnly: locale === "en" },
    { key: "business", slug: "ideon-suite", page: `/demo/ideon-suite`, spanishOnly: locale === "en" },
  ];
  return (
    <section id="portfolio" className="py-24 scroll-mt-16 border-t border-border">
      <Container>
        {heading && <Reveal><SectionHeading eyebrow={t("eyebrow")} title={t("title")} description={t("description")} /></Reveal>}
        <div className={cn("grid md:grid-cols-3 gap-5", heading && "mt-14")}>
          {items.map((d, i) => (
            <Reveal key={d.key} delay={i * 0.05}>
              <article className="group h-full rounded-[18px] border border-border bg-surface overflow-hidden flex flex-col">
                <a href={d.page} {...(d.page.startsWith("/demo") ? { target: "_blank", rel: "noreferrer" } : {})} data-track={d.key === "inventory" ? "inventory_demo_opened" : undefined} data-track-label="portfolio" className="block aspect-[16/10] bg-surface-2 overflow-hidden border-b border-border">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/showcase/${d.slug}.jpg`} alt={t(`items.${d.key}.title`)} width={1280} height={800} loading="lazy" className="w-full h-full object-cover object-top transition-transform duration-500 group-hover:scale-[1.03]" />
                </a>
                <div className="p-5 flex-1 flex flex-col">
                  <Badge tone="neutral" className="self-start">{t("badge")}</Badge>
                  <h3 className="mt-3 text-[17px] font-semibold tracking-tight">{t(`items.${d.key}.title`)}</h3>
                  <p className="mt-1.5 text-[14px] text-fg-muted leading-relaxed flex-1">{t(`items.${d.key}.text`)}</p>
                  {d.spanishOnly && <p className="mt-2 text-[12px] text-fg-subtle">{t("spanishOnly")}</p>}
                  <a href={d.page} {...(d.page.startsWith("/demo") ? { target: "_blank", rel: "noreferrer" } : {})} className="mt-4 inline-flex items-center gap-1.5 text-[13.5px] font-medium text-accent">{t("open")} <ExternalLink className="size-3.5" aria-hidden /></a>
                </div>
              </article>
            </Reveal>
          ))}
        </div>
        {heading && <p className="mt-8 text-center"><a href={`/${locale}/portfolio`} className="text-[14px] text-fg-muted hover:text-fg inline-flex items-center gap-1.5">{t("more")} <ArrowRight className="size-3.5" aria-hidden /></a></p>}
      </Container>
    </section>
  );
}

/* ----------------------------------------------------------------------------- CÓMO EMPEZAR Y PRECIOS */
export async function StartAndPricing() {
  const t = await getTranslations("site.pricing");
  const locale = await getLocale();
  const steps = t.raw("steps") as { title: string; text: string }[];
  const country = (await headers()).get("x-vercel-ip-country");
  return (
    <section id="pricing" className="py-24 scroll-mt-16 border-t border-border bg-bg-elevated">
      <Container>
        <Reveal><SectionHeading eyebrow={t("eyebrow")} title={t("title")} /></Reveal>
        <ol className="mt-12 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {steps.map((s, i) => (
            <li key={s.title} className="list-none rounded-[14px] border border-border bg-surface p-5">
              <span className="text-[12px] font-medium text-accent tabular-nums">0{i + 1}</span>
              <h3 className="mt-2 font-semibold">{s.title}</h3>
              <p className="mt-1 text-[14px] text-fg-muted leading-relaxed">{s.text}</p>
            </li>
          ))}
        </ol>
        <div className="mt-12">
          <PricingTable defaultRegion={regionForCountry(country)} />
        </div>
        <div className="mt-8 text-center">
          <CtaLink href={`/${locale}/contact`} track="proposal_requested" trackLabel="pricing">{t("cta")} <ArrowRight className="size-4" aria-hidden /></CtaLink>
        </div>
      </Container>
    </section>
  );
}

/* ----------------------------------------------------------------------------- CTA FINAL */
export async function SiteFinalCta() {
  const t = await getTranslations("site.finalCta");
  const locale = await getLocale();
  return (
    <section className="py-24 border-t border-border">
      <Container>
        <div className="rounded-[24px] border border-border bg-surface-2 px-6 py-14 sm:px-12 text-center">
          <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight text-balance">{t("title")}</h2>
          <p className="mt-4 text-[16px] text-fg-muted max-w-xl mx-auto">{t("text")}</p>
          <div className="mt-8"><CtaLink href={`/${locale}/contact`} track="proposal_requested" trackLabel="final_cta">{t("cta")} <ArrowRight className="size-4" aria-hidden /></CtaLink></div>
        </div>
      </Container>
    </section>
  );
}
