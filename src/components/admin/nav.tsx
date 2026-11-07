"use client";

import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

export function AdminNav({ items }: { items: { href: string; label: string }[] }) {
  const pathname = usePathname();
  return (
    <nav className="w-52 shrink-0 border-r border-border p-3 hidden md:block">
      {items.map((i) => (
        <Link key={i.href} href={i.href} className={cn("block h-9 px-3 rounded-[8px] text-sm leading-9 transition-colors", (i.href === "/admin" ? pathname === "/admin" : pathname.startsWith(i.href)) ? "bg-white/8 text-fg" : "text-fg-muted hover:text-fg hover:bg-white/5")}>{i.label}</Link>
      ))}
    </nav>
  );
}
