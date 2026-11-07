"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Check, Globe, Loader2, Lock, Search, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge, Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { ProjectDetail } from "@/features/projects/queries";
import { cn } from "@/lib/utils";
import { money } from "@/lib/money";

interface Quote { items: { key: string; label: string; amount: number }[]; total: number; currency: string; renewal: number }
interface LaunchInfo { quote: Quote; pendingPrice: boolean; paid: boolean; freeChanges: number; freeChangesUsed: number; paymentsConfigured: boolean; domainsConfigured: boolean }
interface DomainResult { domain: string; available: boolean; price?: number; currency?: string; unsupported?: boolean }
interface Checkout { key: string; test: boolean; data: Record<string, string> }

type EpaycoWindow = Window & { ePayco?: { checkout: { configure: (o: { key: string; test: boolean }) => { open: (d: Record<string, string>) => void } } } };

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, { ...init, headers: { "Content-Type": "application/json", ...(init?.headers || {}) } });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.error?.message || res.statusText);
  return body as T;
}

/** Carga el checkout de ePayco y abre el pago. */
export async function openEpayco(checkout: Checkout) {
  const w = window as EpaycoWindow;
  if (!w.ePayco) {
    await new Promise<void>((resolve, reject) => {
      const s = document.createElement("script");
      s.src = "https://checkout.epayco.co/checkout.js";
      s.onload = () => resolve(); s.onerror = () => reject(new Error("No se pudo cargar ePayco"));
      document.head.appendChild(s);
    });
  }
  w.ePayco!.checkout.configure({ key: checkout.key, test: checkout.test }).open(checkout.data);
}

const EMPTY_CONTACT = { firstName: "", lastName: "", email: "", phone: "+57", address1: "", city: "", state: "", zip: "", country: "CO", companyName: "" };
type Contact = typeof EMPTY_CONTACT;

const STOP = new Set(["web", "app", "para", "de", "del", "la", "el", "los", "las", "en", "y", "con", "mi", "sitio", "pagina", "tienda", "for", "the", "my"]);
/** Sugerencia inicial a partir del nombre del proyecto: «Web para Panadería Trigo Dorado en Medellín» → «panaderiatrigodorado». */
const slugName = (name: string) => {
  const words = name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").split(/[^a-z0-9]+/).filter((w) => w && !STOP.has(w));
  return words.slice(0, 3).join("").slice(0, 30);
};
const cleanPhone = (p: string) => p.replace(/[\s-]/g, "");
const contactComplete = (c: Contact) => Object.entries(c).every(([k, v]) => k === "companyName" || v.trim().length > 0) && /^\+[1-9]\d{6,14}$/.test(cleanPhone(c.phone));

/** Buscador de dominios + datos del titular (Colombia por defecto). */
function DomainPicker({ initialQuery, picked, onPick, contact, onContact }: {
  initialQuery: string; picked: DomainResult | null; onPick: (r: DomainResult | null) => void; contact: Contact; onContact: (fn: (c: Contact) => Contact) => void;
}) {
  const t = useTranslations("app.launch");
  const locale = useLocale();
  const [query, setQuery] = useState(initialQuery);
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<DomainResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  async function search() {
    setSearching(true); setError(null); onPick(null);
    try { const r = await api<{ results: DomainResult[] }>(`/api/domains/search?q=${encodeURIComponent(query)}`); setResults(r.results); }
    catch (e) { setError((e as Error).message); setResults(null); }
    finally { setSearching(false); }
  }
  const field = (k: keyof Contact, opts: { type?: string; placeholder?: string; span?: boolean } = {}) => (
    <label className={cn("block", opts.span && "col-span-2")}>
      <span className="text-[11px] text-fg-subtle">{t(`contact.${k}`)}</span>
      <Input value={contact[k]} type={opts.type} placeholder={opts.placeholder} className="h-8 text-[13px]" maxLength={k === "country" ? 2 : 120}
        onChange={(e) => onContact((c) => ({ ...c, [k]: k === "country" ? e.target.value.toUpperCase() : e.target.value }))} />
    </label>
  );
  return (
    <>
      <form className="flex gap-1.5" onSubmit={(e) => { e.preventDefault(); void search(); }}>
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="minegocio" className="h-9" aria-label={t("searchLabel")} />
        <Button size="sm" type="submit" variant="secondary" loading={searching} disabled={query.trim().length < 2}><Search className="size-4" /> {t("search")}</Button>
      </form>
      {error && <p className="text-[13px] text-danger" role="alert">{error}</p>}
      {results && (
        <div className="space-y-1">
          {results.map((r) => (
            <button key={r.domain} type="button" disabled={!r.available} onClick={() => onPick(r)}
              className={cn("w-full flex items-center gap-2 rounded-[10px] border px-3 py-2 text-left transition-colors",
                picked?.domain === r.domain ? "border-accent bg-accent-soft" : "border-border bg-surface hover:border-border-strong",
                !r.available && "opacity-50 cursor-not-allowed")}>
              <Globe className="size-4 text-fg-subtle shrink-0" />
              <span className="flex-1 min-w-0 truncate font-medium" title={r.domain}>{r.domain}</span>
              {r.available && r.price != null ? <span className="tabular-nums shrink-0">{money(r.price, r.currency!, locale)}<span className="text-fg-subtle text-[11px]">/{t("year")}</span></span> : <span className="text-[12px] text-fg-subtle shrink-0">{t("taken")}</span>}
              {picked?.domain === r.domain && <Check className="size-4 text-accent shrink-0" />}
            </button>
          ))}
        </div>
      )}
      {picked && (
        <Card className="p-3 space-y-2">
          <p className="text-[12px] text-fg-muted leading-relaxed">{t("contactHelp")}</p>
          <div className="grid grid-cols-2 gap-2">
            {field("firstName")}{field("lastName")}
            {field("email", { type: "email", span: true })}
            {field("phone", { placeholder: "+573001234567" })}{field("companyName")}
            {field("address1", { span: true })}
            {field("city")}{field("state")}
            {field("zip")}{field("country", { placeholder: "CO" })}
          </div>
        </Card>
      )}
    </>
  );
}

export function LaunchPanel({ detail }: { detail: ProjectDetail }) {
  const t = useTranslations("app.launch");
  const locale = useLocale();
  const router = useRouter();
  const { project } = detail;
  const [info, setInfo] = useState<LaunchInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [wantDomain, setWantDomain] = useState(true);
  const [picked, setPicked] = useState<DomainResult | null>(null);
  const [contact, setContact] = useState(EMPTY_CONTACT);
  const [paying, setPaying] = useState(false);
  const [waiting, setWaiting] = useState(false);

  useEffect(() => { api<LaunchInfo>(`/api/projects/${project.id}/launch`).then(setInfo).catch((e) => setError(e.message)); }, [project.id]);

  // Al volver de ePayco, esperamos la confirmación (llega servidor a servidor).
  useEffect(() => {
    if (typeof window === "undefined" || !new URLSearchParams(window.location.search).has("payment")) return;
    setWaiting(true);
    const iv = setInterval(() => router.refresh(), 4000);
    const stop = setTimeout(() => clearInterval(iv), 180_000);
    return () => { clearInterval(iv); clearTimeout(stop); };
  }, [router]);

  async function pay() {
    setPaying(true); setError(null);
    try {
      const domain = wantDomain ? picked?.domain ?? null : null;
      const r = await api<{ checkout: Checkout }>(`/api/projects/${project.id}/launch`, {
        method: "POST", body: JSON.stringify({ domain, contact: domain ? { ...contact, phone: cleanPhone(contact.phone) } : undefined, locale }),
      });
      await openEpayco(r.checkout);
    } catch (e) { setError((e as Error).message); }
    finally { setPaying(false); }
  }

  if (!project.current_version_id) return <p className="text-fg-muted">{t("needsVersion")}</p>;
  if (!info) return error ? <p className="text-danger text-[13px]">{error}</p> : <Loader2 className="size-4 animate-spin text-fg-subtle" />;

  const freeLeft = Math.max(0, info.freeChanges - info.freeChangesUsed);
  const domainPrice = wantDomain && picked?.price ? picked.price : 0;
  const base = info.quote.items.filter((i) => i.key !== "domain");
  const total = base.reduce((n, i) => n + i.amount, 0) + domainPrice;
  const renewal = info.quote.renewal + domainPrice;
  const contactOk = !wantDomain || (picked && contactComplete(contact));
  const canPay = info.paymentsConfigured && !info.pendingPrice && (!wantDomain || Boolean(picked)) && contactOk;

  return (
    <div className="space-y-5">
      {waiting && (
        <Card className="p-3 flex items-center gap-2 border-accent/40"><Loader2 className="size-4 animate-spin text-accent" /> {t("waitingPayment")}</Card>
      )}
      <Card className="p-4 space-y-1.5 border-accent/30 bg-accent-soft">
        <p className="font-semibold flex items-center gap-1.5"><Sparkles className="size-4 text-accent" /> {t("previewTitle")}</p>
        <p className="text-fg-muted leading-relaxed">{t("previewText", { n: info.freeChanges })}</p>
        <p className="text-[12px]"><Badge tone={freeLeft ? "success" : "warning"}>{t("freeLeft", { n: freeLeft, total: info.freeChanges })}</Badge></p>
      </Card>

      <div className="space-y-2">
        <p className="font-semibold">{t("domainTitle")}</p>
        <div className="flex flex-wrap gap-3 text-[13px]">
          <label className="inline-flex items-center gap-1.5"><input type="radio" checked={wantDomain} onChange={() => setWantDomain(true)} /> {t("withDomain")}</label>
          <label className="inline-flex items-center gap-1.5"><input type="radio" checked={!wantDomain} onChange={() => setWantDomain(false)} /> {t("withoutDomain")}</label>
        </div>
        {wantDomain && (!info.domainsConfigured ? <p className="text-fg-muted">{t("domainsNotConfigured")}</p> : (
          <>
            <DomainPicker initialQuery={slugName(project.name)} picked={picked} onPick={setPicked} contact={contact} onContact={setContact} />
          </>
        ))}
      </div>

      <div className="space-y-1.5">
        <p className="font-semibold">{t("summary")}</p>
        {info.pendingPrice && <p className="text-[13px] text-warning">{t("pendingPrice")}</p>}
        <div className="rounded-[10px] border border-border divide-y divide-border">
          {base.map((i) => <div key={i.key} className="flex justify-between gap-3 px-3 py-2"><span>{i.label}</span><span className="tabular-nums">{money(i.amount, info.quote.currency, locale)}</span></div>)}
          {wantDomain && picked?.price != null && <div className="flex justify-between gap-3 px-3 py-2"><span>{t("domainLine", { domain: picked.domain })}</span><span className="tabular-nums">{money(picked.price, info.quote.currency, locale)}</span></div>}
          <div className="flex justify-between gap-3 px-3 py-2 font-semibold"><span>{t("total")}</span><span className="tabular-nums">{money(total, info.quote.currency, locale)}</span></div>
        </div>
        <p className="text-[12px] text-fg-subtle">{t("renewalNote", { amount: money(renewal, info.quote.currency, locale) })}</p>
      </div>

      {!info.paymentsConfigured && <p className="text-[13px] text-fg-muted">{t("paymentsNotConfigured")}</p>}
      {error && <p className="text-[13px] text-danger" role="alert">{error}</p>}
      <Button className="w-full" loading={paying} disabled={!canPay} onClick={() => void pay()}><Lock className="size-4" /> {t("pay", { amount: money(total, info.quote.currency, locale) })}</Button>
      <p className="text-[11px] text-fg-subtle text-center">{t("payNote")}</p>
    </div>
  );
}

/** Estado del dominio comprado (se consulta hasta que queda conectado). */
export function DomainOrderCard({ detail }: { detail: ProjectDetail }) {
  const t = useTranslations("app.launch");
  const router = useRouter();
  const order = detail.domainOrder;
  const inFlight = order && (order.status === "purchasing" || order.status === "configuring" || order.status === "awaiting_payment");
  useEffect(() => {
    if (!inFlight) return;
    const iv = setInterval(async () => { await fetch(`/api/projects/${detail.project.id}/domain/sync`, { method: "POST" }).catch(() => null); router.refresh(); }, 8000);
    return () => clearInterval(iv);
  }, [inFlight, detail.project.id, router]);
  if (!order) return null;
  const tone = order.status === "active" ? "success" : order.status === "failed" ? "danger" : "warning";
  return (
    <Card className="p-3 space-y-1">
      <div className="flex items-center gap-2"><Globe className="size-4" /><b>{order.domain}</b><Badge tone={tone}>{t(`orderStatus.${order.status}`)}</Badge>{inFlight && <Loader2 className="size-3.5 animate-spin text-fg-subtle" />}</div>
      {order.status === "active" && <a className="text-accent hover:underline text-[13px]" href={`https://${order.domain}`} target="_blank" rel="noreferrer">https://{order.domain}</a>}
      {order.status === "failed" && <p className="text-[12px] text-danger">{t("orderFailed")}</p>}
      {detail.subscription?.current_period_end && <p className="text-[12px] text-fg-subtle">{t("planUntil", { date: new Date(detail.subscription.current_period_end).toLocaleDateString() })}</p>}
    </Card>
  );
}

/** Cambios por chat del plan anual y compra de paquetes adicionales. */
export function ChangesCard({ detail }: { detail: ProjectDetail }) {
  const t = useTranslations("app.launch");
  const locale = useLocale();
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const sub = detail.subscription;
  if (!sub) return null;
  const total = detail.includedChanges + sub.extra_changes;
  const left = Math.max(0, total - sub.changes_used);
  async function buy(i: number) {
    setBusy(i); setError(null);
    try {
      const r = await api<{ checkout: Checkout }>(`/api/projects/${detail.project.id}/changes`, { method: "POST", body: JSON.stringify({ pack: i, locale }) });
      await openEpayco(r.checkout);
    } catch (e) { setError((e as Error).message); } finally { setBusy(null); }
  }
  return (
    <Card className="p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <b>{t("changesTitle")}</b>
        <Badge tone={left > 3 ? "success" : left > 0 ? "warning" : "danger"}>{t("changesLeft", { left, total })}</Badge>
      </div>
      <p className="text-[12px] text-fg-muted">{t("changesHelp", { n: detail.includedChanges })}</p>
      <div className="flex flex-wrap gap-2">
        {detail.changePacks.map((p, i) => (
          <Button key={i} size="sm" variant="secondary" loading={busy === i} onClick={() => void buy(i)}>
            {t("buyPack", { qty: p.qty, price: money(p.price, detail.billingCurrency, locale) })}
          </Button>
        ))}
      </div>
      {error && <p className="text-[12px] text-danger">{error}</p>}
    </Card>
  );
}

/** Proyecto ya activado sin dominio: buscarlo y comprarlo ahora (se suma a la renovación anual). */
export function BuyDomainCard({ detail }: { detail: ProjectDetail }) {
  const t = useTranslations("app.launch");
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<DomainResult | null>(null);
  const [contact, setContact] = useState(EMPTY_CONTACT);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const order = detail.domainOrder;
  const hasDomain = Boolean(detail.subscription?.domain) || (order && ["purchasing", "configuring", "active"].includes(order.status));
  if (!detail.subscription || hasDomain) return null;

  async function pay() {
    if (!picked) return;
    setPaying(true); setError(null);
    try {
      const r = await api<{ checkout: Checkout }>(`/api/projects/${detail.project.id}/domain/buy`, {
        method: "POST", body: JSON.stringify({ domain: picked.domain, contact: { ...contact, phone: cleanPhone(contact.phone) }, locale }),
      });
      await openEpayco(r.checkout);
    } catch (e) { setError((e as Error).message); }
    finally { setPaying(false); }
  }

  return (
    <Card className="p-3 space-y-2 border-accent/30">
      <div className="flex items-center justify-between gap-2">
        <b className="flex items-center gap-1.5"><Globe className="size-4 text-accent" /> {t("buyDomainTitle")}</b>
        {!open && <Button size="sm" onClick={() => setOpen(true)}><Search className="size-4" /> {t("buyDomainCta")}</Button>}
      </div>
      <p className="text-[12px] text-fg-muted leading-relaxed">{t("buyDomainHelp")}</p>
      {open && (
        <div className="space-y-2">
          <DomainPicker initialQuery={slugName(detail.project.name)} picked={picked} onPick={setPicked} contact={contact} onContact={setContact} />
          {error && <p className="text-[13px] text-danger" role="alert">{error}</p>}
          {picked?.price != null && (
            <>
              <Button className="w-full" loading={paying} disabled={!contactComplete(contact)} onClick={() => void pay()}>
                <Lock className="size-4" /> {t("pay", { amount: money(picked.price, picked.currency!, locale) })}
              </Button>
              <p className="text-[11px] text-fg-subtle text-center">{t("buyDomainNote")}</p>
            </>
          )}
        </div>
      )}
    </Card>
  );
}
