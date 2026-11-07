import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ArrowRight } from "lucide-react";
import { Container } from "@/components/ui/card";
import { CtaLink, PortfolioGrid, SiteFinalCta } from "@/components/site/sections";
import { pageMetadata } from "@/lib/seo";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "site.meta" });
  return pageMetadata({ locale, path: "/portfolio", title: t("portfolioTitle"), description: t("portfolioDescription") });
}

export default async function PortfolioPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("site.portfolio");
  return (
    <div className="pt-28 sm:pt-32">
      <Container>
        <div className="max-w-3xl">
          <p className="text-[13px] font-medium text-accent">{t("eyebrow")}</p>
          <h1 className="mt-3 text-4xl sm:text-5xl font-semibold tracking-tight">{t("title")}</h1>
          <p className="mt-5 text-lg text-fg-muted leading-relaxed">{t("description")}</p>
        </div>
      </Container>
      <PortfolioGrid heading={false} />
      <Container>
        <div className="-mt-8 mb-4 text-center"><CtaLink href={`/${locale}/examples`} variant="secondary">{t("more")} <ArrowRight className="size-4" aria-hidden /></CtaLink></div>
      </Container>
      <SiteFinalCta />
    </div>
  );
}
