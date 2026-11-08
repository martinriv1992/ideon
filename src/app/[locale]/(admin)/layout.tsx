import { connection } from "next/server";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { requirePlatformAdmin } from "@/features/admin/guard";
import { Logo } from "@/components/ui/logo";
import { AdminNav } from "@/components/admin/nav";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await connection();
  const { db } = await requirePlatformAdmin();
  const t = await getTranslations("admin.nav");
  const { count: pendingReviews } = await db.from("approvals").select("id", { count: "exact", head: true }).eq("kind", "deploy").eq("decision", "pending");
  const items = [
    { href: "/admin", label: t("overview") }, { href: "/admin/reviews", label: pendingReviews ? `${t("reviews")} (${pendingReviews})` : t("reviews") }, { href: "/admin/leads", label: t("leads") }, { href: "/admin/clients", label: t("clients") }, { href: "/admin/projects", label: t("projects") },
    { href: "/admin/runs", label: t("runs") }, { href: "/admin/ai", label: t("ai") }, { href: "/admin/pricing", label: t("pricing") },
    { href: "/admin/deployments", label: t("deployments") }, { href: "/admin/tickets", label: t("tickets") }, { href: "/admin/settings", label: t("settings") },
  ];
  return (
    <div className="min-h-dvh flex flex-col">
      <header className="h-14 border-b border-border flex items-center gap-4 px-5">
        <Link href="/admin"><Logo /></Link>
        <span className="text-[12px] uppercase tracking-wide text-accent font-medium">{t("backoffice")}</span>
        <span className="flex-1" />
        <Link href="/dashboard" className="text-[13px] text-fg-muted hover:text-fg">{t("backToApp")}</Link>
      </header>
      <div className="flex-1 flex">
        <AdminNav items={items} />
        <main className="flex-1 min-w-0 px-5 sm:px-8 py-8 max-w-6xl">{children}</main>
      </div>
    </div>
  );
}
