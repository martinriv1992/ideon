"use client";

import { useLocale } from "next-intl";
import { Languages } from "lucide-react";
import { usePathname, useRouter } from "@/i18n/navigation";
import { locales } from "@/i18n/routing";
import { cn } from "@/lib/utils";

export function LocaleSwitcher({ className }: { className?: string }) {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  return (
    <div
      className={cn(
        "inline-flex items-center h-8 rounded-full border border-border bg-surface p-0.5 text-[12px] font-medium",
        className,
      )}
      role="group"
      aria-label="Language"
    >
      <Languages className="size-3.5 text-fg-subtle ml-2 mr-1" aria-hidden />
      {locales.map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => router.replace(pathname, { locale: l })}
          aria-pressed={l === locale}
          className={cn(
            "h-7 px-2.5 rounded-full uppercase tracking-wide transition-colors",
            l === locale ? "bg-white/10 text-fg" : "text-fg-subtle hover:text-fg",
          )}
        >
          {l}
        </button>
      ))}
    </div>
  );
}
