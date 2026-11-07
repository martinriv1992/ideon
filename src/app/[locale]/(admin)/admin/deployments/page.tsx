import { getLocale, getTranslations } from "next-intl/server";
import { requirePlatformAdmin } from "@/features/admin/guard";
import { Table } from "@/components/admin/table";
import { Badge } from "@/components/ui/card";

export default async function AdminDeployments() {
  const t = await getTranslations("admin");
  const locale = await getLocale();
  const { db } = await requirePlatformAdmin();
  const [{ data: deps }, { data: sites }] = await Promise.all([
    db.from("deployments").select("*, projects(name)").order("created_at", { ascending: false }).limit(200),
    db.from("published_sites").select("*, projects(name)").order("published_at", { ascending: false }),
  ]);
  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold tracking-tight">{t("nav.deployments")}</h1>
      <section><h2 className="text-base font-semibold mb-3">{t("deployments.sites")}</h2>
        <Table head={[t("deployments.project"), "Slug", t("deployments.domain"), t("deployments.domainStatus"), t("deployments.published")]} rows={(sites ?? []).map((s) => [(s.projects as unknown as { name: string } | null)?.name ?? "—", s.slug, s.custom_domain ?? "—", s.domain_status ?? "—", new Date(s.published_at).toLocaleString(locale)])} empty={t("deployments.noSites")} /></section>
      <section><h2 className="text-base font-semibold mb-3">{t("deployments.history")}</h2>
        <Table head={[t("deployments.date"), t("deployments.project"), t("deployments.target"), t("deployments.status"), "URL"]} rows={(deps ?? []).map((d) => [new Date(d.created_at).toLocaleString(locale), (d.projects as unknown as { name: string } | null)?.name ?? "—", d.target, <Badge key={d.id} tone={d.status === "live" ? "success" : d.status === "failed" ? "danger" : "warning"}>{d.status}</Badge>, d.url ? <a key={d.id + "u"} className="text-accent hover:underline" href={d.url} target="_blank" rel="noreferrer">{d.url}</a> : d.logs?.slice(0, 80) ?? "—"])} empty={t("deployments.none")} /></section>
    </div>
  );
}
