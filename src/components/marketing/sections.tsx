import { getLocale, getTranslations } from "next-intl/server";
import {
  ArrowRight,
  Check,
  Compass,
  DraftingCompass,
  Palette,
  Code2,
  ShieldCheck,
  Rocket,
  Zap,
  SlidersHorizontal,
  Sprout,
  Eye,
  KeyRound,
  Lock,
} from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Badge, Card, Container, SectionHeading } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CategoryIcon } from "@/components/ui/category-icon";
import { Logo } from "@/components/ui/logo";
import { getCategories, getPricingPlans, localized } from "@/features/catalog/queries";
import { IdeaComposer } from "./idea-composer";
import { Reveal } from "./reveal";
import { FaqList } from "./faq";
import { cn } from "@/lib/utils";

/* ----------------------------------------------------------------------------
 * HERO
 * ------------------------------------------------------------------------- */
export async function Hero({ isAuthenticated }: { isAuthenticated: boolean }) {
  const t = await getTranslations("hero");
  return (
    <section className="relative pt-36 pb-24 sm:pt-44 sm:pb-32 overflow-hidden">
      <div className="absolute inset-0 grid-fade pointer-events-none" aria-hidden />
      <div
        className="absolute left-1/2 top-0 -translate-x-1/2 w-[900px] h-[500px] rounded-full bg-accent/20 blur-[140px] opacity-60 pointer-events-none"
        aria-hidden
      />
      <Container className="relative">
        <div className="text-center">
          <Badge tone="accent" className="animate-fade-in">
            <span className="size-1.5 rounded-full bg-accent animate-pulse-soft" />
            {t("badge")}
          </Badge>
          <h1 className="mt-6 text-4xl sm:text-6xl lg:text-7xl font-semibold tracking-[-0.03em] leading-[1.05] text-balance animate-fade-up">
            <span className="text-gradient">{t("title")}</span>
          </h1>
          <p className="mt-6 mx-auto max-w-2xl text-base sm:text-lg lg:text-xl text-fg-muted leading-relaxed text-pretty animate-fade-up [animation-delay:120ms]">
            {t("subtitle")}
          </p>
        </div>
        <div className="mt-12 animate-fade-up [animation-delay:220ms]">
          <IdeaComposer isAuthenticated={isAuthenticated} />
        </div>
      </Container>
    </section>
  );
}

/* ----------------------------------------------------------------------------
 * CATEGORÍAS
 * ------------------------------------------------------------------------- */
export async function Categories() {
  const t = await getTranslations("categories");
  const locale = await getLocale();
  const categories = await getCategories();
  return (
    <section id="solutions" className="py-24 scroll-mt-16">
      <Container>
        <Reveal>
          <SectionHeading eyebrow={t("eyebrow")} title={t("title")} description={t("description")} />
        </Reveal>
        <div className="mt-14 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {categories.map((c, i) => {
            const l = localized(c, locale);
            return (
              <Reveal key={c.key} delay={Math.min(i * 0.03, 0.3)}>
                <Card hover className="h-full p-5">
                  <div className="size-9 rounded-[10px] bg-accent-soft text-accent flex items-center justify-center">
                    <CategoryIcon name={c.icon} className="size-[18px]" />
                  </div>
                  <h3 className="mt-4 text-[15px] font-medium text-fg">{l.name}</h3>
                  <p className="mt-1.5 text-[13px] text-fg-muted leading-relaxed">{l.description}</p>
                </Card>
              </Reveal>
            );
          })}
        </div>
      </Container>
    </section>
  );
}

/* ----------------------------------------------------------------------------
 * PROCESO (6 agentes)
 * ------------------------------------------------------------------------- */
const AGENT_ICONS = [Compass, DraftingCompass, Palette, Code2, ShieldCheck, Rocket];

export async function Process() {
  const t = await getTranslations("process");
  const steps = t.raw("steps") as { name: string; title: string; text: string }[];
  return (
    <section id="process" className="py-24 scroll-mt-16 border-t border-border bg-bg-elevated">
      <Container>
        <Reveal>
          <SectionHeading eyebrow={t("eyebrow")} title={t("title")} description={t("description")} />
        </Reveal>
        <ol className="mt-16 relative grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {steps.map((s, i) => {
            const Icon = AGENT_ICONS[i] ?? Compass;
            return (
              <Reveal key={s.name} delay={i * 0.06}>
                <li className="relative h-full">
                  <Card hover className="h-full p-6">
                    <div className="flex items-center justify-between">
                      <div className="size-10 rounded-[12px] bg-accent-gradient text-accent-fg flex items-center justify-center">
                        <Icon className="size-5" />
                      </div>
                      <span className="font-mono text-[12px] text-fg-subtle">0{i + 1}</span>
                    </div>
                    <p className="mt-5 text-[12px] uppercase tracking-wide text-accent font-medium">{s.name}</p>
                    <h3 className="mt-1 text-lg font-semibold tracking-tight">{s.title}</h3>
                    <p className="mt-2 text-[14px] text-fg-muted leading-relaxed">{s.text}</p>
                  </Card>
                </li>
              </Reveal>
            );
          })}
        </ol>
      </Container>
    </section>
  );
}

/* ----------------------------------------------------------------------------
 * BENEFICIOS
 * ------------------------------------------------------------------------- */
const BENEFIT_ICONS = [Zap, SlidersHorizontal, Sprout, Eye, KeyRound, Lock];

export async function Benefits() {
  const t = await getTranslations("benefits");
  const items = t.raw("items") as { title: string; text: string }[];
  return (
    <section className="py-24 border-t border-border">
      <Container>
        <Reveal>
          <SectionHeading eyebrow={t("eyebrow")} title={t("title")} />
        </Reveal>
        <div className="mt-14 grid sm:grid-cols-2 lg:grid-cols-3 gap-x-10 gap-y-12">
          {items.map((b, i) => {
            const Icon = BENEFIT_ICONS[i] ?? Zap;
            return (
              <Reveal key={b.title} delay={i * 0.05}>
                <div>
                  <Icon className="size-5 text-accent" />
                  <h3 className="mt-4 text-base font-semibold tracking-tight">{b.title}</h3>
                  <p className="mt-2 text-[14px] text-fg-muted leading-relaxed">{b.text}</p>
                </div>
              </Reveal>
            );
          })}
        </div>
      </Container>
    </section>
  );
}

/* ----------------------------------------------------------------------------
 * CASOS DE USO
 * ------------------------------------------------------------------------- */
export async function UseCases() {
  const t = await getTranslations("useCases");
  const items = t.raw("items") as { sector: string; text: string }[];
  return (
    <section className="py-24 border-t border-border bg-bg-elevated">
      <Container>
        <Reveal>
          <SectionHeading eyebrow={t("eyebrow")} title={t("title")} />
        </Reveal>
        <div className="mt-14 grid sm:grid-cols-2 gap-4">
          {items.map((u, i) => (
            <Reveal key={u.sector} delay={i * 0.05}>
              <Card hover className="p-6 h-full flex gap-4">
                <div className="w-1 rounded-full bg-accent-gradient shrink-0" />
                <div>
                  <h3 className="text-base font-semibold tracking-tight">{u.sector}</h3>
                  <p className="mt-2 text-[14px] text-fg-muted leading-relaxed">{u.text}</p>
                </div>
              </Card>
            </Reveal>
          ))}
        </div>
        <div className="mt-10 text-center">
          <Link href="/examples" className="inline-flex items-center gap-2 h-11 px-5 rounded-[12px] border border-border-strong bg-surface text-[14px] font-medium hover:bg-surface-hover transition-colors">
            {t("seeExamples")} <ArrowRight className="size-4" aria-hidden />
          </Link>
        </div>
      </Container>
    </section>
  );
}

/* ----------------------------------------------------------------------------
 * PLANES
 * ------------------------------------------------------------------------- */
export async function Pricing() {
  const t = await getTranslations("pricing");
  const locale = await getLocale();
  const plans = await getPricingPlans();

  return (
    <section id="pricing" className="py-24 scroll-mt-16 border-t border-border">
      <Container>
        <Reveal>
          <SectionHeading eyebrow={t("eyebrow")} title={t("title")} description={t("description")} />
        </Reveal>
        <div className="mt-14 grid md:grid-cols-3 gap-4">
          {plans.map((p, i) => {
            const l = localized(p, locale);
            const featured = p.key === "pro";
            const features = Array.isArray(p.features) ? (p.features as string[]) : [];
            return (
              <Reveal key={p.key} delay={i * 0.06}>
                <Card
                  className={cn(
                    "h-full p-7 flex flex-col",
                    featured && "border-accent/50 glow-accent bg-surface-2",
                  )}
                >
                  <div className="flex items-center justify-between">
                    <h3 className="text-xl font-semibold tracking-tight">{l.name}</h3>
                    {featured && <Badge tone="accent">Popular</Badge>}
                  </div>
                  <p className="mt-2 text-[14px] text-fg-muted leading-relaxed min-h-[42px]">{l.description}</p>
                  <p className="mt-6 text-2xl font-semibold tracking-tight">
                    {p.price_from != null
                      ? t("fromLabel", {
                          price: new Intl.NumberFormat(locale, {
                            style: "currency",
                            currency: p.currency,
                            maximumFractionDigits: 0,
                          }).format(Number(p.price_from)),
                        })
                      : t("quoteLabel")}
                  </p>
                  <ul className="mt-6 space-y-2.5 flex-1">
                    {features.map((f) => (
                      <li key={f} className="flex items-start gap-2.5 text-[14px] text-fg-muted">
                        <Check className="size-4 mt-0.5 text-success shrink-0" />
                        {t.has(`features.${f}`) ? t(`features.${f}`) : f}
                      </li>
                    ))}
                  </ul>
                  <a href="#start" className="mt-8">
                    <Button variant={featured ? "primary" : "secondary"} className="w-full">
                      {t("cta")}
                    </Button>
                  </a>
                </Card>
              </Reveal>
            );
          })}
        </div>
        <p className="mt-6 text-center text-[13px] text-fg-subtle">{t("footnote")}</p>
      </Container>
    </section>
  );
}

/* ----------------------------------------------------------------------------
 * FAQ
 * ------------------------------------------------------------------------- */
export async function Faq() {
  const t = await getTranslations("faq");
  const items = t.raw("items") as { q: string; a: string }[];
  return (
    <section id="faq" className="py-24 scroll-mt-16 border-t border-border bg-bg-elevated">
      <Container className="max-w-3xl">
        <Reveal>
          <SectionHeading eyebrow={t("eyebrow")} title={t("title")} />
        </Reveal>
        <Reveal className="mt-12">
          <FaqList items={items} />
        </Reveal>
      </Container>
    </section>
  );
}

/* ----------------------------------------------------------------------------
 * CTA FINAL
 * ------------------------------------------------------------------------- */
export async function FinalCta() {
  const t = await getTranslations("finalCta");
  return (
    <section className="py-28 border-t border-border relative overflow-hidden">
      <div
        className="absolute left-1/2 bottom-0 -translate-x-1/2 w-[800px] h-[400px] rounded-full bg-accent-2/15 blur-[140px] pointer-events-none"
        aria-hidden
      />
      <Container className="relative text-center">
        <Reveal>
          <h2 className="text-3xl sm:text-5xl font-semibold tracking-tight text-balance">
            <span className="text-gradient">{t("title")}</span>
          </h2>
          <p className="mt-5 text-base sm:text-lg text-fg-muted max-w-xl mx-auto">{t("description")}</p>
          <a href="#start" className="inline-block mt-10">
            <Button size="lg" className="group">
              {t("cta")}
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </Button>
          </a>
        </Reveal>
      </Container>
    </section>
  );
}

/* ----------------------------------------------------------------------------
 * FOOTER
 * ------------------------------------------------------------------------- */
export async function Footer() {
  const t = await getTranslations("footer");
  const nav = await getTranslations("nav");
  return (
    <footer className="border-t border-border py-14">
      <Container>
        <div className="grid gap-10 md:grid-cols-[1.5fr_1fr_1fr]">
          <div>
            <Logo />
            <p className="mt-4 text-[14px] text-fg-muted max-w-xs">{t("tagline")}</p>
          </div>
          <div>
            <p className="text-[13px] font-medium text-fg mb-3">{t("product")}</p>
            <ul className="space-y-2 text-[14px] text-fg-muted">
              <li><a href="#process" className="hover:text-fg transition-colors">{nav("process")}</a></li>
              <li><a href="#solutions" className="hover:text-fg transition-colors">{nav("solutions")}</a></li>
              <li><a href="#pricing" className="hover:text-fg transition-colors">{nav("pricing")}</a></li>
              <li><Link href="/login" className="hover:text-fg transition-colors">{nav("login")}</Link></li>
            </ul>
          </div>
          <div>
            <p className="text-[13px] font-medium text-fg mb-3">{t("legal")}</p>
            <ul className="space-y-2 text-[14px] text-fg-muted">
              <li><Link href="/privacy" className="hover:text-fg transition-colors">{t("privacy")}</Link></li>
              <li><Link href="/terms" className="hover:text-fg transition-colors">{t("terms")}</Link></li>
              <li><a href="mailto:hola@ideon.app" className="hover:text-fg transition-colors">{t("contact")}</a></li>
            </ul>
          </div>
        </div>
        <p className="mt-12 text-[12px] text-fg-subtle">{t("rights", { year: new Date().getFullYear() })}</p>
      </Container>
    </footer>
  );
}
