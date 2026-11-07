import { getLocale, getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentContext } from "@/features/organizations/queries";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { Badge, Card } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";

export default async function BillingPage() {
  const t = await getTranslations("app.pages");
  const locale = await getLocale();
  const ctx = (await getCurrentContext())!;
  const supabase = await createClient();
  const [{ data: payments }, { data: invoices }] = await Promise.all([
    supabase.from("payments").select("*").eq("organization_id", ctx.organization.id).order("created_at", { ascending: false }).limit(100),
    supabase.from("invoices").select("*").eq("organization_id", ctx.organization.id).order("issued_at", { ascending: false }).limit(100),
  ]);
  const money = (n: number, c: string) => new Intl.NumberFormat(locale, { style: "currency", currency: c, maximumFractionDigits: 0 }).format(n);
  const stripe = Boolean(process.env.STRIPE_SECRET_KEY);
  return (
    <PageBody>
      <PageHeader title={t("billing.title")} description={t("billing.subtitle")} />
      {!stripe && <div className="mt-6 rounded-[12px] border border-border bg-surface p-4 text-[13px] text-fg-muted">{t("billing.notConfigured")}</div>}
      <h2 className="mt-8 text-lg font-semibold">{t("billing.payments")}</h2>
      {!payments?.length ? <Card className="mt-3 p-8 text-center text-fg-muted">{t("billing.noPayments")}</Card> : (
        <div className="mt-3 space-y-2">{payments.map((p) => (
          <Card key={p.id} className="p-4 flex flex-wrap items-center gap-3"><span className="flex-1 text-[13px] text-fg-muted">{formatDate(p.created_at, locale)} · {p.provider}</span><span className="font-semibold">{money(Number(p.amount), p.currency)}</span><Badge tone={p.status === "paid" ? "success" : p.status === "failed" ? "danger" : "warning"}>{p.status}</Badge></Card>
        ))}</div>
      )}
      <h2 className="mt-10 text-lg font-semibold">{t("billing.invoices")}</h2>
      {!invoices?.length ? <Card className="mt-3 p-8 text-center text-fg-muted">{t("billing.noInvoices")}</Card> : (
        <div className="mt-3 space-y-2">{invoices.map((i) => (
          <Card key={i.id} className="p-4 flex flex-wrap items-center gap-3"><span className="font-mono text-[13px]">{i.number}</span><span className="flex-1 text-[13px] text-fg-muted">{formatDate(i.issued_at, locale)}</span><span className="font-semibold">{money(Number(i.amount), i.currency)}</span></Card>
        ))}</div>
      )}
    </PageBody>
  );
}
