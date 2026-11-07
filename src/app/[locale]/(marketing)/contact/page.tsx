import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { CalendarClock, MessageCircle } from "lucide-react";
import { Container } from "@/components/ui/card";
import { LeadForm } from "@/components/site/lead-form";
import { LocalTimezone } from "@/components/site/local-timezone";
import { whatsappLink } from "@/lib/contact";
import { pageMetadata } from "@/lib/seo";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "site.meta" });
  return pageMetadata({ locale, path: "/contact", title: t("contactTitle"), description: t("contactDescription") });
}

export default async function ContactPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ solution?: string; intent?: string }> }) {
  const { locale } = await params;
  const { solution, intent } = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations("site.contact");
  const booking = process.env.NEXT_PUBLIC_BOOKING_URL;
  return (
    <div className="pt-28 sm:pt-32 pb-24">
      <Container>
        <div className="max-w-3xl">
          <p className="text-[13px] font-medium text-accent">{t("eyebrow")}</p>
          <h1 className="mt-3 text-4xl sm:text-5xl font-semibold tracking-tight text-balance">{t("title")}</h1>
          <p className="mt-5 text-lg text-fg-muted leading-relaxed">{t("subtitle")}</p>
        </div>
        <div className="mt-12 grid lg:grid-cols-[1.4fr_1fr] gap-8 items-start">
          <div className="relative rounded-[20px] border border-border bg-surface p-6 sm:p-8">
            <LeadForm initialSolution={solution} wantsMeeting={intent === "meeting"} />
          </div>
          <aside className="space-y-4 lg:sticky lg:top-24">
            <div id="meeting" className="rounded-[20px] border border-accent/40 bg-surface-2 p-6">
              <CalendarClock className="size-6 text-accent" aria-hidden />
              <h2 className="mt-3 text-lg font-semibold">{t("meetingTitle")}</h2>
              <p className="mt-1.5 text-[14.5px] text-fg-muted leading-relaxed">{t("meetingText")}</p>
              <p className="mt-3 text-[12.5px] text-fg-subtle"><LocalTimezone label={t.raw("timezone") as string} /></p>
              {booking ? (
                <a href={booking} target="_blank" rel="noreferrer" data-track="meeting_cta_clicked" data-track-label="contact_aside"
                  className="mt-4 inline-flex items-center justify-center gap-2 h-11 px-5 rounded-[12px] bg-fg text-bg text-[14.5px] font-medium hover:opacity-90">{t("meetingCta")}</a>
              ) : <p className="mt-4 text-[13.5px] text-fg-muted">{t("meetingPending")}</p>}
            </div>
            <div className="rounded-[20px] border border-border bg-surface p-6">
              <h2 className="font-semibold">{t("whatsapp")}</h2>
              <a href={whatsappLink(t("whatsappMessage"))} target="_blank" rel="noreferrer" data-track="meeting_cta_clicked" data-track-label="whatsapp"
                className="mt-3 inline-flex items-center gap-2 h-10 px-4 rounded-[10px] border border-border text-[14px] font-medium hover:border-border-strong"><MessageCircle className="size-4" aria-hidden /> {t("whatsappCta")}</a>
            </div>
          </aside>
        </div>
      </Container>
    </div>
  );
}
