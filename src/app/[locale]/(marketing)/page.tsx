import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { isSupabaseConfigured } from "@/lib/env";
import { getCurrentUser } from "@/lib/supabase/server";
import { Faq } from "@/components/marketing/sections";
import {
  FeaturedInventory, HowWeWork, PortfolioGrid, SiteFinalCta, SiteHero, Solutions, StartAndPricing, WhyIdeonapp,
} from "@/components/site/sections";
import { jsonLd, organizationLd, pageMetadata, SITE_URL } from "@/lib/seo";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "site.meta" });
  return pageMetadata({ locale, path: "/", title: t("homeTitle"), description: t("homeDescription") });
}

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = isSupabaseConfigured ? await getCurrentUser() : null;
  const website = { "@context": "https://schema.org", "@type": "WebSite", name: "Ideonapp", url: SITE_URL, inLanguage: locale };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(organizationLd(locale))} />
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(website)} />
      <SiteHero isAuthenticated={Boolean(user)} />
      <Solutions />
      <FeaturedInventory />
      <HowWeWork />
      <WhyIdeonapp />
      <PortfolioGrid />
      <StartAndPricing />
      <Faq />
      <SiteFinalCta />
    </>
  );
}
