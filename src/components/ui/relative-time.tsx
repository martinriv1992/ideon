"use client";

import { useEffect, useState } from "react";
import { useLocale } from "next-intl";
import { formatDate, formatRelative } from "@/lib/utils";

/**
 * Fecha relativa ("hace 2 minutos") calculada en el cliente tras montar.
 * En servidor se renderiza la fecha absoluta para evitar desajustes de hidratación.
 */
export function RelativeTime({ value, className }: { value: string; className?: string }) {
  const locale = useLocale();
  const [text, setText] = useState(() => formatDate(value, locale));

  useEffect(() => {
    setText(formatRelative(value, locale));
    const id = setInterval(() => setText(formatRelative(value, locale)), 60_000);
    return () => clearInterval(id);
  }, [value, locale]);

  return (
    <time dateTime={value} className={className} suppressHydrationWarning>
      {text}
    </time>
  );
}
