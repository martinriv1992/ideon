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
