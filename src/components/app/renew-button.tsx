"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { openEpayco } from "@/components/workspace/launch-panel";

/** Paga la renovación anual (hosting + dominio) con ePayco. */
export function RenewButton({ subscriptionId, label }: { subscriptionId: string; label: string }) {
  const t = useTranslations("app.launch");
  const locale = useLocale();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function renew() {
    setBusy(true); setError(null);
    try {
      const res = await fetch(`/api/subscriptions/${subscriptionId}/renew`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ locale }) });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error?.message || t("renewFailed"));
      await openEpayco(body.checkout);
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  return (
    <span className="inline-flex flex-col items-end gap-1">
      <Button size="sm" onClick={() => void renew()} loading={busy}><RefreshCw className="size-3.5" /> {label}</Button>
      {error && <span className="text-[12px] text-danger">{error}</span>}
    </span>
  );
}
