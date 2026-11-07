"use client";

import { useEffect, useState } from "react";

/** Zona horaria del visitante (se calcula en su navegador). */
export function LocalTimezone({ label }: { label: string }) {
  const [tz, setTz] = useState<string | null>(null);
  useEffect(() => { try { setTz(Intl.DateTimeFormat().resolvedOptions().timeZone); } catch { setTz(null); } }, []);
  if (!tz) return null;
  return <>{label.replace("{tz}", tz.replace(/_/g, " "))}</>;
}
