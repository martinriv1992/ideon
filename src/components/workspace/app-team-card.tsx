"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Copy, Database, Download, KeyRound, Loader2, Trash2, UserPlus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge, Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { ProjectDetail } from "@/features/projects/queries";

interface AppUserItem { id: string; email: string; name: string; role: "admin" | "member"; active: boolean; last_login_at: string | null; created_at: string }
interface Info { users: AppUserItem[]; url: string | null; usesData: boolean; records: number }
interface Credentials { name: string; email: string; password: string; url: string | null; emailed: boolean }

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, { ...init, headers: { "Content-Type": "application/json", ...(init?.headers || {}) } });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.error?.message || res.statusText);
  return body as T;
}

/** Ideon Data: equipo del cliente con acceso a la app publicada y copia de sus datos. */
export function AppTeamCard({ detail }: { detail: ProjectDetail }) {
  const t = useTranslations("app.appData");
  const locale = useLocale();
  const id = detail.project.id;
  const [info, setInfo] = useState<Info | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", email: "", role: "member" as "admin" | "member", sendEmail: true });
  const [busy, setBusy] = useState<string | null>(null);
  const [creds, setCreds] = useState<Credentials | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(() => api<Info>(`/api/projects/${id}/app-users`).then(setInfo).catch((e) => setError(e.message)), [id]);
  useEffect(() => { void load(); }, [load]);

  async function run(key: string, fn: () => Promise<void>) {
    setBusy(key); setError(null);
    try { await fn(); await load(); } catch (e) { setError((e as Error).message); } finally { setBusy(null); }
  }

  const add = () => run("add", async () => {
    const r = await api<{ user: AppUserItem; password: string; emailed: boolean; url: string | null }>(`/api/projects/${id}/app-users`, { method: "POST", body: JSON.stringify(form) });
    setCreds({ name: r.user.name, email: r.user.email, password: r.password, url: r.url, emailed: r.emailed });
    setForm({ name: "", email: "", role: "member", sendEmail: form.sendEmail });
  });
  const reset = (u: AppUserItem) => run(`reset-${u.id}`, async () => {
    const r = await api<{ user: AppUserItem; password: string; emailed: boolean }>(`/api/projects/${id}/app-users/${u.id}`, { method: "PATCH", body: JSON.stringify({ resetPassword: true, sendEmail: true }) });
    setCreds({ name: r.user.name, email: r.user.email, password: r.password, url: info?.url ?? null, emailed: r.emailed });
  });
  const patch = (u: AppUserItem, body: Record<string, unknown>) => run(`patch-${u.id}`, async () => { await api(`/api/projects/${id}/app-users/${u.id}`, { method: "PATCH", body: JSON.stringify(body) }); });
  const remove = (u: AppUserItem) => { if (window.confirm(t("confirmDelete", { name: u.name }))) void run(`del-${u.id}`, async () => { await api(`/api/projects/${id}/app-users/${u.id}`, { method: "DELETE" }); }); };

  async function copy() {
    if (!creds) return;
    const text = `${creds.url ?? ""}\n${t("email")}: ${creds.email}\n${t("password")}: ${creds.password}`;
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* sin portapapeles */ }
  }

  if (!info) return <Card className="p-3">{error ? <p className="text-[13px] text-danger">{error}</p> : <Loader2 className="size-4 animate-spin text-fg-subtle" />}</Card>;

  return (
    <Card className="p-3 space-y-3">
      <div className="flex items-center gap-2">
        <Users className="size-4 text-accent" />
        <b className="flex-1">{t("title")}</b>
        <Badge tone={info.usesData ? "success" : "warning"}>{info.usesData ? t("cloudOn") : t("cloudOff")}</Badge>
      </div>
      {info.usesData ? (
        <p className="text-[12px] text-fg-muted leading-relaxed">{t("help")}</p>
      ) : (
        <p className="text-[12px] text-warning leading-relaxed">{t("localOnly")}</p>
      )}

      {info.users.length > 0 && (
        <div className="rounded-[10px] border border-border divide-y divide-border">
          {info.users.map((u) => (
            <div key={u.id} className="px-3 py-2 flex flex-wrap items-center gap-2 text-[13px]">
              <div className="flex-1 min-w-[140px]">
                <p className={u.active ? "font-medium" : "font-medium text-fg-subtle line-through"}>{u.name}</p>
                <p className="text-[11.5px] text-fg-subtle truncate">{u.email} · {u.last_login_at ? t("lastLogin", { date: new Date(u.last_login_at).toLocaleDateString(locale) }) : t("neverLogged")}</p>
              </div>
              <select value={u.role} onChange={(e) => void patch(u, { role: e.target.value })} disabled={busy !== null} aria-label={t("role")}
                className="h-7 rounded-[8px] border border-border bg-surface px-1.5 text-[12px]">
                <option value="admin">{t("roles.admin")}</option>
                <option value="member">{t("roles.member")}</option>
              </select>
              <Button size="sm" variant="secondary" title={t("resetPasswordHelp")} loading={busy === `reset-${u.id}`} onClick={() => void reset(u)}><KeyRound className="size-3.5" /> {t("resetPassword")}</Button>
              <Button size="sm" variant="ghost" onClick={() => void patch(u, { active: !u.active })} loading={busy === `patch-${u.id}`}>{u.active ? t("deactivate") : t("activate")}</Button>
              <Button size="sm" variant="ghost" title={t("delete")} onClick={() => remove(u)} loading={busy === `del-${u.id}`}><Trash2 className="size-3.5" /></Button>
            </div>
          ))}
        </div>
      )}

      {creds && (
        <div className="rounded-[10px] border border-success/40 bg-success/5 p-3 text-[13px] space-y-1" role="status">
          <p className="font-medium">{t("credentialsTitle", { name: creds.name })}</p>
          {creds.url && <p>{t("address")}: <a href={creds.url} target="_blank" rel="noreferrer" className="text-accent underline break-all">{creds.url}</a></p>}
          <p>{t("email")}: <b>{creds.email}</b></p>
          <p>{t("password")}: <b className="font-mono">{creds.password}</b></p>
          <p className="text-[12px] text-fg-muted">{creds.emailed ? t("emailed") : t("notEmailed")}</p>
          <Button size="sm" variant="secondary" onClick={() => void copy()}><Copy className="size-3.5" /> {copied ? t("copied") : t("copy")}</Button>
        </div>
      )}

      <form className="grid grid-cols-2 gap-2" onSubmit={(e) => { e.preventDefault(); void add(); }}>
        <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={t("namePh")} aria-label={t("name")} className="h-8 text-[13px]" required />
        <Input value={form.email} type="email" onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder={t("emailPh")} aria-label={t("email")} className="h-8 text-[13px]" required />
        <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as "admin" | "member" })} aria-label={t("role")} className="h-8 rounded-[10px] border border-border bg-surface px-2 text-[13px]">
          <option value="member">{t("roles.member")}</option>
          <option value="admin">{t("roles.admin")}</option>
        </select>
        <Button size="sm" type="submit" loading={busy === "add"} disabled={!form.name.trim() || !form.email.trim()}><UserPlus className="size-4" /> {t("add")}</Button>
        <label className="col-span-2 inline-flex items-center gap-2 text-[12px] text-fg-muted">
          <input type="checkbox" checked={form.sendEmail} onChange={(e) => setForm({ ...form, sendEmail: e.target.checked })} /> {t("sendEmail")}
        </label>
      </form>
      {error && <p className="text-[12px] text-danger" role="alert">{error}</p>}

      <div className="flex flex-wrap items-center gap-3 pt-1 text-[12px] text-fg-muted">
        <span className="inline-flex items-center gap-1"><Database className="size-3.5" /> {t("records", { n: info.records })}</span>
        <a href={`/api/projects/${id}/app-data/export`} className="inline-flex items-center gap-1 text-accent hover:underline"><Download className="size-3.5" /> {t("export")}</a>
      </div>
    </Card>
  );
}
