"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { updateSettingsAction } from "@/features/settings/actions";
import type { ActionState } from "@/features/projects/actions";

interface Props {
  fullName: string;
  email: string;
  locale: string;
  orgName: string;
  role: string;
  canEditOrg: boolean;
}

export function SettingsForm(p: Props) {
  const t = useTranslations("app.settings");
  const [state, formAction, pending] = useActionState(updateSettingsAction, {} as ActionState);

  return (
    <form action={formAction} className="space-y-6">
      <Card className="p-6 space-y-5">
        <h2 className="text-base font-semibold tracking-tight">{t("profile")}</h2>
        <div>
          <Label htmlFor="fullName">{t("fullName")}</Label>
          <Input id="fullName" name="fullName" defaultValue={p.fullName} required minLength={2} />
        </div>
        <div>
          <Label htmlFor="email">{t("email")}</Label>
          <Input id="email" value={p.email} disabled />
        </div>
        <div>
          <Label htmlFor="locale">{t("locale")}</Label>
          <select
            id="locale"
            name="locale"
            defaultValue={p.locale}
            className="h-11 w-full bg-surface border border-border rounded-[10px] px-3.5 text-sm text-fg"
          >
            <option value="es">Español</option>
            <option value="en">English</option>
          </select>
        </div>
      </Card>

      <Card className="p-6 space-y-5">
        <h2 className="text-base font-semibold tracking-tight">{t("organization")}</h2>
        <div>
          <Label htmlFor="orgName">{t("orgName")}</Label>
          <Input id="orgName" name="orgName" defaultValue={p.orgName} disabled={!p.canEditOrg} required minLength={2} />
        </div>
        <div>
          <Label>{t("role")}</Label>
          <p className="text-sm text-fg-muted capitalize">{p.role}</p>
        </div>
      </Card>

      <div className="flex items-center gap-4">
        <Button type="submit" loading={pending}>
          {t("save")}
        </Button>
        {state.ok && <span className="text-[13px] text-success">{t("saved")}</span>}
        {state.error && <span className="text-[13px] text-danger">{state.error}</span>}
      </div>
    </form>
  );
}
