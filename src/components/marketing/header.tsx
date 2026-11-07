"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Menu, X } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Logo } from "@/components/ui/logo";
import { Button } from "@/components/ui/button";
import { LocaleSwitcher } from "./locale-switcher";
import { cn } from "@/lib/utils";

export function MarketingHeader({ isAuthenticated }: { isAuthenticated: boolean }) {
  const t = useTranslations("nav");
  const locale = useLocale();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Enlaces absolutos: funcionan también desde páginas que no son la portada (p. ej. Ejemplos).
  const links = [
    { href: `/${locale}/business`, label: t("business") },
    { href: `/${locale}#start`, label: t("custom") },
    { href: `/${locale}/examples`, label: t("examples") },
    { href: `/${locale}#pricing`, label: t("pricing") },
    { href: `/${locale}#domains`, label: t("domains") },
    { href: `/${locale}#faq`, label: t("faq") },
  ];

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-[background-color,border-color,backdrop-filter] duration-300",
        scrolled || open
          ? "bg-bg/80 backdrop-blur-xl border-b border-border"
          : "bg-transparent border-b border-transparent",
      )}
    >
      <div className="mx-auto max-w-6xl px-5 sm:px-8 h-16 flex items-center justify-between gap-6">
        <Link href="/" aria-label="Ideon" className="shrink-0">
          <Logo />
        </Link>

        <nav className="hidden md:flex items-center gap-1" aria-label="Main">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="px-3 py-2 text-sm text-fg-muted hover:text-fg transition-colors rounded-md"
            >
              {l.label}
            </a>
          ))}
        </nav>

        <div className="hidden md:flex items-center gap-2">
          <LocaleSwitcher />
          {isAuthenticated ? (
            <Link href="/dashboard">
              <Button size="sm">{t("dashboard")}</Button>
            </Link>
          ) : (
            <>
              <Link href="/login">
                <Button size="sm" variant="ghost">
                  {t("login")}
                </Button>
              </Link>
              <a href={`/${locale}#start`}>
                <Button size="sm">{t("start")}</Button>
              </a>
            </>
          )}
        </div>

        <button
          type="button"
          className="md:hidden inline-flex size-9 items-center justify-center rounded-md text-fg-muted hover:text-fg hover:bg-white/5"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label="Menu"
        >
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>

      {open && (
        <div className="md:hidden border-t border-border bg-bg/95 backdrop-blur-xl">
          <div className="px-5 py-4 flex flex-col gap-1">
            {links.map((l) => (
              <a
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="px-3 py-2.5 text-[15px] text-fg-muted hover:text-fg rounded-md"
              >
                {l.label}
              </a>
            ))}
            <div className="mt-3 flex items-center gap-2">
              <LocaleSwitcher />
              {isAuthenticated ? (
                <Link href="/dashboard" className="flex-1">
                  <Button className="w-full">{t("dashboard")}</Button>
                </Link>
              ) : (
                <>
                  <Link href="/login" className="flex-1">
                    <Button variant="secondary" className="w-full">
                      {t("login")}
                    </Button>
                  </Link>
                  <a href={`/${locale}#start`} className="flex-1" onClick={() => setOpen(false)}>
                    <Button className="w-full">{t("start")}</Button>
                  </a>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
