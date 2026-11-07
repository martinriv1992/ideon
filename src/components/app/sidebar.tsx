"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  LayoutDashboard,
  FolderKanban,
  Plus,
  FileText,
  Receipt,
  RefreshCw,
  Files,
  LifeBuoy,
  Settings,
  LogOut,
  ArrowUpRight,
  Menu,
  X,
} from "lucide-react";
import { Link, usePathname } from "@/i18n/navigation";
import { Logo } from "@/components/ui/logo";
import { LocaleSwitcher } from "@/components/marketing/locale-switcher";
import { cn } from "@/lib/utils";

interface Props {
  userName: string;
  orgName: string;
  logout: () => Promise<void>;
}

export function AppSidebar({ userName, orgName, logout }: Props) {
  const t = useTranslations("app.nav");
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const primary = [
    { href: "/dashboard", label: t("dashboard"), icon: LayoutDashboard },
    { href: "/projects", label: t("projects"), icon: FolderKanban },
  ];
  const secondary = [
    { href: "/proposals", label: t("proposals"), icon: FileText },
    { href: "/files", label: t("files"), icon: Files },
    { href: "/billing", label: t("billing"), icon: Receipt },
    { href: "/subscriptions", label: t("subscriptions"), icon: RefreshCw },
    { href: "/support", label: t("support"), icon: LifeBuoy },
    { href: "/settings", label: t("settings"), icon: Settings },
  ];

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  const nav = (
    <>
      <div className="px-3 pt-1">
        <Link
          href="/projects/new"
          onClick={() => setOpen(false)}
          className="flex items-center gap-2 h-10 px-3 rounded-[10px] bg-fg text-bg text-sm font-medium hover:bg-white/90 transition-colors"
        >
          <Plus className="size-4" />
          {t("newProject")}
        </Link>
      </div>
      <nav className="mt-4 px-3 space-y-0.5" aria-label="Primary">
        {primary.map((item) => (
          <NavLink key={item.href} {...item} active={isActive(item.href)} onClick={() => setOpen(false)} />
        ))}
      </nav>
      <nav className="mt-6 px-3 space-y-0.5" aria-label="Secondary">
        {secondary.map((item) => (
          <NavLink key={item.href} {...item} active={isActive(item.href)} onClick={() => setOpen(false)} />
        ))}
      </nav>
      <div className="mt-auto px-3 pb-4 space-y-3">
        <LocaleSwitcher className="w-full justify-center" />
        <div className="rounded-[12px] border border-border bg-surface p-3">
          <p className="text-[13px] font-medium text-fg truncate">{userName}</p>
          <p className="text-[12px] text-fg-subtle truncate">{orgName}</p>
          <div className="mt-3 flex items-center justify-between">
            <Link href="/" className="inline-flex items-center gap-1 text-[12px] text-fg-muted hover:text-fg">
              {t("backToSite")} <ArrowUpRight className="size-3" />
            </Link>
            <form action={logout}>
              <button type="submit" className="inline-flex items-center gap-1 text-[12px] text-fg-muted hover:text-danger">
                <LogOut className="size-3.5" /> {t("logout")}
              </button>
            </form>
          </div>
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* Desktop */}
      <aside className="hidden lg:flex w-64 shrink-0 flex-col border-r border-border bg-bg-elevated">
        <div className="h-16 flex items-center px-6">
          <Link href="/dashboard">
            <Logo />
          </Link>
        </div>
        {nav}
      </aside>

      {/* Mobile top bar */}
      <div className="lg:hidden fixed inset-x-0 top-0 z-40 h-14 border-b border-border bg-bg/90 backdrop-blur flex items-center justify-between px-4">
        <Link href="/dashboard">
          <Logo size={24} />
        </Link>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label="Menu"
          aria-expanded={open}
          className="size-9 inline-flex items-center justify-center rounded-md text-fg-muted hover:text-fg hover:bg-white/5"
        >
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>
      {open && (
        <div className="lg:hidden fixed inset-0 z-30 bg-bg pt-16 flex flex-col">{nav}</div>
      )}
    </>
  );
}

function NavLink({
  href,
  label,
  icon: Icon,
  active,
  onClick,
}: {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-center gap-2.5 h-9 px-3 rounded-[8px] text-sm transition-colors",
        active ? "bg-white/8 text-fg" : "text-fg-muted hover:text-fg hover:bg-white/5",
      )}
    >
      <Icon className={cn("size-4", active ? "text-accent" : "")} />
      {label}
    </Link>
  );
}
