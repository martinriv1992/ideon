import { getLocale, getTranslations } from "next-intl/server";
import { ArrowRight, Briefcase, Check, ExternalLink, LayoutTemplate } from "lucide-react";
import { Card, Container, SectionHeading } from "@/components/ui/card";
import { Reveal } from "./reveal";
import { PACKAGES, packagePrice } from "@/features/packages/catalog";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { money } from "@/lib/money";
import { cn } from "@/lib/utils";

/** Precios vigentes de los paquetes (filas pkg_* de pricing_plans; si no, los de referencia). */
async function packagePlans() {
  if (!isSupabaseConfigured) return [];
  try {
    const supabase = await createClient();
    const { data } = await supabase.from("pricing_plans").select("key,price_from,currency,is_active").like("key", "pkg_%");
    return data ?? [];
  } catch {
    return [];
  }
}

/* ----------------------------------------------------------------------------
 * DOS LÍNEAS: soluciones empresariales · webs y apps a medida
 * ------------------------------------------------------------------------- */
export async function TwoPaths() {
  const t = await getTranslations("paths");
  const locale = await getLocale();
  const cards = [
    { icon: Briefcase, key: "business", href: `/${locale}/business`, featured: true },
    { icon: LayoutTemplate, key: "custom", href: `/${locale}#start`, featured: false },
  ] as const;
  return (
    <section id="paths" className="py-20 scroll-mt-16 border-t border-border">
      <Container>
        <Reveal>
          <SectionHeading eyebrow={t("eyebrow")} title={t("title")} description={t("description")} />
        </Reveal>
        <div className="mt-12 grid md:grid-cols-2 gap-4">
          {cards.map((c, i) => (
            <Reveal key={c.key} delay={i * 0.06}>
              <a href={c.href} className="block h-full group">
                <Card hover className={cn("h-full p-7 flex flex-col", c.featured && "border-accent/50 glow-accent bg-surface-2")}>
                  <div className="size-10 rounded-[12px] bg-accent-soft text-accent flex items-center justify-center"><c.icon className="size-5" /></div>
                  <h3 className="mt-5 text-2xl font-semibold tracking-tight">{t(`${c.key}.title`)}</h3>
                  <p className="mt-2 text-[15px] text-fg-muted leading-relaxed">{t(`${c.key}.text`)}</p>
                  <ul className="mt-5 space-y-2 flex-1">
                    {(t.raw(`${c.key}.points`) as string[]).map((p) => (
                      <li key={p} className="flex items-start gap-2.5 text-[14px] text-fg-muted"><Check className="size-4 mt-0.5 text-success shrink-0" />{p}</li>
                    ))}
                  </ul>
                  <span className="mt-6 inline-flex items-center gap-1.5 text-[14px] font-medium text-accent">{t(`${c.key}.cta`)} <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" /></span>
                </Card>
              </a>
            </Reveal>
          ))}
        </div>
      </Container>
    </section>
  );
}

/* ----------------------------------------------------------------------------
 * PAQUETES EMPRESARIALES (portada y /business)
 * ------------------------------------------------------------------------- */
export async function BusinessPackages({ heading = true }: { heading?: boolean }) {
  const t = await getTranslations("business");
  const locale = await getLocale();
  const lang = locale === "en" ? "en" : "es";
  const plans = await packagePlans();
  return (
    <section id="business" className="py-20 scroll-mt-16">
      <Container>
        {heading && (
          <Reveal>
            <SectionHeading eyebrow={t("eyebrow")} title={t("title")} description={t("description")} />
          </Reveal>
        )}
        <div className={cn("grid lg:grid-cols-3 gap-5", heading && "mt-12")}>
          {PACKAGES.map((p, i) => {
            const { price, currency } = packagePrice(p, plans);
            const featured = p.key === "suite";
            return (
              <Reveal key={p.key} delay={i * 0.06}>
                <article className={cn("group h-full rounded-[20px] border bg-surface overflow-hidden flex flex-col", featured ? "border-accent/50 glow-accent" : "border-border")}>
                  <a href={`/demo/${p.demo}`} target="_blank" rel="noreferrer" className="block aspect-[16/10] bg-surface-2 overflow-hidden border-b border-border" aria-label={t("tryDemo")}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`/showcase/${p.demo}.jpg`} alt="" loading="lazy" className="w-full h-full object-cover object-top transition-transform duration-500 group-hover:scale-[1.03]" />
                  </a>
                  <div className="p-6 flex-1 flex flex-col">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-xl font-semibold tracking-tight">{p.name}</h3>
                      {featured && <span className="text-[11px] font-medium rounded-full bg-accent-soft text-accent px-2 py-0.5">{t("complete")}</span>}
                    </div>
                    <p className="mt-2 text-[14px] text-fg-muted leading-relaxed">{p.tagline[lang]}</p>
                    <p className="mt-5 text-2xl font-semibold tracking-tight tabular-nums">{money(price, currency, locale)}</p>
                    <p className="text-[12px] text-fg-subtle">{t("priceNote")}</p>
                    <ul className="mt-5 space-y-2 flex-1">
                      {p.modules.map((m) => (
                        <li key={m.es} className="flex items-start gap-2.5 text-[14px] text-fg-muted"><Check className="size-4 mt-0.5 text-success shrink-0" />{m[lang]}</li>
                      ))}
                    </ul>
                    <div className="mt-6 grid grid-cols-2 gap-2">
                      <a href={`/demo/${p.demo}`} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-1.5 h-10 rounded-[10px] border border-border text-[13px] font-medium text-fg-muted hover:text-fg hover:border-border-strong">
                        {t("tryDemo")} <ExternalLink className="size-3.5" aria-hidden />
                      </a>
                      <a href={`/${locale}/projects/new?package=${p.key}`} className="inline-flex items-center justify-center gap-1.5 h-10 rounded-[10px] bg-fg text-bg text-[13px] font-medium hover:opacity-90">
                        {t("want")} <ArrowRight className="size-3.5" aria-hidden />
                      </a>
                    </div>
                  </div>
                </article>
              </Reveal>
            );
          })}
        </div>
        <p className="mt-6 text-center text-[13px] text-fg-subtle max-w-3xl mx-auto leading-relaxed">{t("footnote")}</p>
      </Container>
    </section>
  );
}
