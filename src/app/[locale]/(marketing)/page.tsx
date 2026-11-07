import { setRequestLocale } from "next-intl/server";
import { isSupabaseConfigured } from "@/lib/env";
import { getCurrentUser } from "@/lib/supabase/server";
import {
  Benefits,
  Categories,
  Faq,
  FinalCta,
  Hero,
  Pricing,
  Process,
  UseCases,
} from "@/components/marketing/sections";
import { BusinessPackages, TwoPaths } from "@/components/marketing/business";

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = isSupabaseConfigured ? await getCurrentUser() : null;

  return (
    <>
      <Hero isAuthenticated={Boolean(user)} />
      <TwoPaths />
      <BusinessPackages />
      <Process />
      <Categories />
      <Benefits />
      <UseCases />
      <Pricing />
      <Faq />
      <FinalCta />
    </>
  );
}
