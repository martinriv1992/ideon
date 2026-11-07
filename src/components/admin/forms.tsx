"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { updatePlanAction, updatePolicyAction, updateSettingAction } from "@/features/admin/actions";
import type { ActionState } from "@/features/projects/actions";

export function PlanForm({ plan, labels }: { plan: { key: string; name_es: string; price_from: number | null; currency: string; is_active: boolean }; labels: { price: string; currency: string; active: string; save: string; saved: string } }) {
  const [state, action, pending] = useActionState(updatePlanAction, {} as ActionState);
  return (
    <form action={action} className="bg-surface border border-border rounded-[14px] p-4 space-y-3">
      <input type="hidden" name="key" value={plan.key} />
      <p className="font-semibold">{plan.name_es} <span className="text-fg-subtle font-normal">({plan.key})</span></p>
      <div className="grid grid-cols-2 gap-3">
        <div><Label htmlFor={`p-${plan.key}`}>{labels.price}</Label><Input id={`p-${plan.key}`} name="price_from" type="number" min={0} step="1" defaultValue={plan.price_from ?? ""} placeholder="—" /></div>
        <div><Label htmlFor={`c-${plan.key}`}>{labels.currency}</Label><Input id={`c-${plan.key}`} name="currency" defaultValue={plan.currency} maxLength={3} /></div>
      </div>
      <label className="flex items-center gap-2 text-[13px]"><input type="checkbox" name="is_active" defaultChecked={plan.is_active} /> {labels.active}</label>
      <div className="flex items-center gap-3"><Button size="sm" type="submit" loading={pending}>{labels.save}</Button>{state.ok && <span className="text-[13px] text-success">{labels.saved}</span>}{state.error && <span className="text-[13px] text-danger">{state.error}</span>}</div>
    </form>
  );
}

export function PolicyForm({ policy, labels }: { policy: { task: string; model: string; max_output_tokens: number; input_cost_per_mtok: number; output_cost_per_mtok: number }; labels: { model: string; maxTokens: string; inCost: string; outCost: string; save: string; saved: string } }) {
  const [state, action, pending] = useActionState(updatePolicyAction, {} as ActionState);
  return (
    <form action={action} className="bg-surface border border-border rounded-[14px] p-4 space-y-3">
      <input type="hidden" name="task" value={policy.task} />
      <p className="font-semibold capitalize">{policy.task}</p>
      <div className="grid sm:grid-cols-2 gap-3">
        <div><Label>{labels.model}</Label><Input name="model" defaultValue={policy.model} /></div>
        <div><Label>{labels.maxTokens}</Label><Input name="max_output_tokens" type="number" defaultValue={policy.max_output_tokens} /></div>
        <div><Label>{labels.inCost}</Label><Input name="input_cost_per_mtok" type="number" step="0.01" defaultValue={policy.input_cost_per_mtok} /></div>
        <div><Label>{labels.outCost}</Label><Input name="output_cost_per_mtok" type="number" step="0.01" defaultValue={policy.output_cost_per_mtok} /></div>
      </div>
      <div className="flex items-center gap-3"><Button size="sm" type="submit" loading={pending}>{labels.save}</Button>{state.ok && <span className="text-[13px] text-success">{labels.saved}</span>}{state.error && <span className="text-[13px] text-danger">{state.error}</span>}</div>
    </form>
  );
}

export function SettingForm({ setting, help, labels }: { setting: { key: string; value: unknown }; help: string; labels: { save: string; saved: string } }) {
  const [state, action, pending] = useActionState(updateSettingAction, {} as ActionState);
  return (
    <form action={action} className="bg-surface border border-border rounded-[14px] p-4 space-y-2">
      <input type="hidden" name="key" value={setting.key} />
      <p className="font-mono text-[13px]">{setting.key}</p>
      <p className="text-[12px] text-fg-muted">{help}</p>
      <div className="flex gap-2"><Input name="value" defaultValue={JSON.stringify(setting.value)} className="font-mono text-[13px]" /><Button size="sm" type="submit" loading={pending}>{labels.save}</Button></div>
      {state.ok && <span className="text-[13px] text-success">{labels.saved}</span>}{state.error && <span className="text-[13px] text-danger">{state.error}</span>}
    </form>
  );
}
