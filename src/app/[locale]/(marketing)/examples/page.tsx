import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ArrowRight, ExternalLink, Sparkles } from "lucide-react";
import data from "@/content/showcase/index.json";
import type { ShowcaseDemo } from "@/content/showcase/types";

type Demo = ShowcaseDemo;
const showcase = data as Demo[];

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "examples" });
  return { title: t("metaTitle"), description: t("subtitle") };
}

export default async function ExamplesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("examples");
  const tk = await getTranslations("app.workspace.kinds");
  const lang = locale === "en" ? "en" : "es";
  const createHref = (d: Demo) => `/${locale}?kind=${d.kind}&idea=${encodeURIComponent(d.idea)}#start`;

  return (
    <div className="mx-auto max-w-6xl px-5 sm:px-8 pt-32 pb-24">
      <div className="max-w-2xl">
        <p className="inline-flex items-center gap-1.5 text-[13px] text-accent font-medium"><Sparkles className="size-4" aria-hidden /> {t("eyebrow")}</p>
        <h1 className="mt-3 text-4xl sm:text-5xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="mt-4 text-lg text-fg-muted leading-relaxed">{t("subtitle")}</p>
      </div>

      <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {showcase.map((d) => (
          <article key={d.slug} className="group rounded-[20px] border border-border bg-surface overflow-hidden flex flex-col">
            <a href={`/demo/${d.slug}`} target="_blank" rel="noreferrer" className="block aspect-[16/10] bg-surface-2 overflow-hidden border-b border-border" aria-label={t("openDemo", { name: d.title[lang] })}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/showcase/${d.slug}.jpg`} alt="" loading="lazy" className="w-full h-full object-cover object-top transition-transform duration-500 group-hover:scale-[1.03]" />
            </a>
            <div className="p-5 flex-1 flex flex-col">
              <p className="text-[12px] uppercase tracking-wide text-fg-subtle">{tk(d.kind)}</p>
              <h2 className="mt-1 text-lg font-semibold tracking-tight">{d.title[lang]}</h2>
              <p className="mt-1.5 text-[14px] text-fg-muted leading-relaxed flex-1">{d.summary[lang]}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <a href={`/demo/${d.slug}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-[10px] bg-fg text-bg text-[13px] font-medium hover:opacity-90">
                  {t("tryDemo")} <ExternalLink className="size-3.5" aria-hidden />
                </a>
                <a href={createHref(d)} className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-[10px] border border-border text-[13px] font-medium text-fg-muted hover:text-fg hover:border-border-strong">
                  {t("createLike")} <ArrowRight className="size-3.5" aria-hidden />
                </a>
              </div>
            </div>
          </article>
        ))}
      </div>

      <p className="mt-10 text-[13px] text-fg-subtle max-w-3xl leading-relaxed">{t("note")}</p>
    </div>
  );
}
