import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Briefcase, MessageCircle } from "lucide-react";
import { BusinessPackages } from "@/components/marketing/business";
import { whatsappLink } from "@/lib/contact";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "business" });
  return { title: t("metaTitle"), description: t("description") };
}

export default async function BusinessPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("business");
  const steps = t.raw("steps") as { title: string; text: string }[];
  return (
    <div className="pt-28">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <div className="max-w-2xl">
          <p className="inline-flex items-center gap-1.5 text-[13px] text-accent font-medium"><Briefcase className="size-4" aria-hidden /> {t("eyebrow")}</p>
          <h1 className="mt-3 text-4xl sm:text-5xl font-semibold tracking-tight">{t("pageTitle")}</h1>
          <p className="mt-4 text-lg text-fg-muted leading-relaxed">{t("pageSubtitle")}</p>
        </div>
      </div>
      <BusinessPackages heading={false} />
      <div className="mx-auto max-w-6xl px-5 sm:px-8 pb-24">
        <h2 className="text-2xl font-semibold tracking-tight">{t("stepsTitle")}</h2>
        <ol className="mt-6 grid md:grid-cols-4 gap-4">
          {steps.map((s, i) => (
            <li key={s.title} className="rounded-[16px] border border-border bg-surface p-5">
              <span className="text-[12px] font-medium text-accent">0{i + 1}</span>
              <h3 className="mt-2 font-medium">{s.title}</h3>
              <p className="mt-1.5 text-[14px] text-fg-muted leading-relaxed">{s.text}</p>
            </li>
          ))}
        </ol>
        <div className="mt-10 rounded-[20px] border border-border bg-surface-2 p-6 flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
          <div>
            <h2 className="text-lg font-semibold">{t("talkTitle")}</h2>
            <p className="mt-1 text-[14px] text-fg-muted">{t("talkText")}</p>
          </div>
          <a href={whatsappLink(t("talkMessage"))} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-1.5 h-10 px-4 rounded-[10px] bg-fg text-bg text-[14px] font-medium hover:opacity-90 shrink-0">
            <MessageCircle className="size-4" aria-hidden /> {t("talkCta")}
          </a>
        </div>
      </div>
    </div>
  );
}
