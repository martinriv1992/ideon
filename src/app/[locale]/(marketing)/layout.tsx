import { isSupabaseConfigured } from "@/lib/env";
import { getCurrentUser } from "@/lib/supabase/server";
import { MarketingHeader } from "@/components/marketing/header";
import { Footer } from "@/components/marketing/sections";
import { WhatsAppButton } from "@/components/marketing/whatsapp-button";
import { SiteAnalytics } from "@/components/site/site-analytics";

export default async function MarketingLayout({ children }: { children: React.ReactNode }) {
  const user = isSupabaseConfigured ? await getCurrentUser() : null;
  return (
    <>
      <MarketingHeader isAuthenticated={Boolean(user)} />
      <main>{children}</main>
      <Footer />
      <WhatsAppButton />
      <SiteAnalytics />
    </>
  );
}
