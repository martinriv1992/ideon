"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import {
  Archive, ArchiveRestore, Bot, Check, ChevronLeft, Download, ExternalLink, FilePlus, Globe, History, ImagePlus, Loader2, MessageSquare,
  Monitor, MonitorOff, RefreshCw, Rocket, Send, Smartphone, Trash2, User, X,
} from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Badge, Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { RelativeTime } from "@/components/ui/relative-time";
import { StatusBadge } from "@/components/app/status-badge";
import { setCurrentVersionAction, setProjectArchivedAction } from "@/features/projects/actions";
import type { ProjectDetail } from "@/features/projects/queries";
import type { Json, Message } from "@/types/database.types";
import { cn, formatDate } from "@/lib/utils";
import { uploadToProject } from "@/lib/upload-client";
import { DomainOrderCard, LaunchPanel } from "@/components/workspace/launch-panel";
import { ASSET_ACCEPT, IMAGE_ACCEPT, MAX_ASSETS, MAX_IMAGES, assetTypeFor, classifyUpload, estimateTokens } from "@/lib/uploads";

type LeftTab = "conversation" | "history";
type RightTab = "overview" | "proposal" | "spec" | "versions" | "images" | "files" | "qa" | "publish";
type Device = "desktop" | "mobile";

interface Question { text: string; options: string[]; multi: boolean }
interface MsgJson { question?: Question | null; progress?: { step: number; total: number } | null; retry?: string; proposal_id?: string; version_id?: string; qa?: { ok: number; bad: number; total: number } }

async function api(path: string, init?: RequestInit) {
  const res = await fetch(path, { ...init, headers: { "Content-Type": "application/json", ...(init?.headers || {}) } });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(body?.error?.message || res.statusText), { code: body?.error?.code || "error" });
  return body;
}

export function Workspace({ detail }: { detail: ProjectDetail }) {
  const t = useTranslations("app.workspace");
  const router = useRouter();
  const { project, messages, events, proposal, versions, site, activeRun, aiConfigured } = detail;
  const [leftTab, setLeftTab] = useState<LeftTab>("conversation");
  const [rightTab, setRightTab] = useState<RightTab>(project.status === "proposal" ? "proposal" : "overview");
  const [device, setDevice] = useState<Device>("desktop");
  const [previewVersion, setPreviewVersion] = useState<string | null>(project.current_version_id);
  const [frameKey, setFrameKey] = useState(0);
  const [busy, setBusy] = useState<string | null>(activeRun ? activeRun.step : null);
  const [error, setError] = useState<string | null>(null);
  const [archiving, startArchive] = useTransition();
  const isArchived = Boolean(project.archived_at);

  // Mientras hay una ejecución en curso (en este u otro cliente), refrescar para ver el progreso.
  useEffect(() => {
    if (!busy && !activeRun) return;
    const id = setInterval(() => router.refresh(), 3000);
    return () => clearInterval(id);
  }, [busy, activeRun, router]);
  useEffect(() => { setPreviewVersion(project.current_version_id); setFrameKey((k) => k + 1); }, [project.current_version_id]);
  useEffect(() => { if (!activeRun && busy && !busyLocal.current) setBusy(null); }, [activeRun, busy]);
  const busyLocal = useRef(false);
  const kicked = useRef(false);
  useEffect(() => {
    const onlyIdea = messages.length === 1 && messages[0].role === "user";
    if (kicked.current || !onlyIdea || activeRun || !aiConfigured || !["draft", "discovery"].includes(project.status)) return;
    kicked.current = true;
    run("consultant", () => api(`/api/projects/${project.id}/start`, { method: "POST" }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const run = useCallback(async (label: string, fn: () => Promise<unknown>) => {
    setBusy(label); setError(null); busyLocal.current = true;
    try { await fn(); } catch (e) { setError(errCopy(e, t)); } finally { busyLocal.current = false; setBusy(null); router.refresh(); }
  }, [router, t]);

  const sendMessage = (content: string) => run("message", () => api(`/api/projects/${project.id}/message`, { method: "POST", body: JSON.stringify({ content }) }));
  const approve = () => proposal && run("build", () => api(`/api/projects/${project.id}/approve`, { method: "POST", body: JSON.stringify({ proposalId: proposal.id }) }));
  const rebuild = () => run("build", () => api(`/api/projects/${project.id}/build`, { method: "POST" }));

  const currentVersion = versions.find((v) => v.id === project.current_version_id) ?? null;
  const previewing = versions.find((v) => v.id === previewVersion) ?? currentVersion;

  return (
    <div className="flex flex-col lg:h-dvh">
      <div className="h-14 shrink-0 border-b border-border flex items-center gap-3 px-4 sm:px-6">
        <Link href="/projects" className="text-fg-muted hover:text-fg" aria-label="Back"><ChevronLeft className="size-5" /></Link>
        <h1 className="text-[15px] font-semibold tracking-tight truncate">{project.name}</h1>
        <StatusBadge status={project.status} />
        <Badge>{t(`kinds.${project.kind}`)}</Badge>
        {isArchived && <Badge tone="warning">{t("archived")}</Badge>}
        <span className="flex-1" />
        {site && <a href={`${detail.siteBaseUrl}/s/${site.slug}`} target="_blank" rel="noreferrer" className="hidden sm:inline-flex"><Button size="sm" variant="secondary"><Globe className="size-4" /> {t("viewLive")}</Button></a>}
        {currentVersion && (project.paid_at || detail.isPlatformAdmin) && <a href={`/api/projects/${project.id}/download`} className="hidden sm:inline-flex"><Button size="sm" variant="ghost"><Download className="size-4" /> ZIP</Button></a>}
      </div>

      {!aiConfigured && (
        <div className="shrink-0 border-b border-warning/30 bg-warning/10 px-4 py-2 text-[13px] text-warning">{t("aiNotConfigured")}</div>
      )}

      <div className="lg:flex-1 lg:min-h-0 grid grid-cols-1 lg:grid-cols-[380px_1fr_320px] xl:grid-cols-[420px_1fr_340px]">
        {/* IZQUIERDA */}
        <section className="h-[72vh] lg:h-auto lg:min-h-0 flex flex-col border-b lg:border-b-0 lg:border-r border-border">
          <Tabs value={leftTab} onChange={setLeftTab} items={[{ key: "conversation", label: t("conversation"), icon: MessageSquare }, { key: "history", label: t("history"), icon: History }]} />
          {leftTab === "conversation" ? (
            <Conversation
              messages={messages}
              busy={busy ?? (activeRun ? activeRun.step : null)}
              error={error}
              disabled={isArchived || !aiConfigured}
              canAnswer={!project.current_version_id && project.status !== "proposal"}
              onSend={sendMessage}
              onRetryBuild={rebuild}
              onOpenProposal={() => setRightTab("proposal")}
              waitingApproval={project.status === "proposal"}
              previewNote={project.current_version_id && !project.paid_at && !detail.isPlatformAdmin
                ? t("freeChangesLeft", { n: Math.max(0, detail.freeChanges - project.free_changes_used), total: detail.freeChanges }) : null}
              onOpenPublish={() => setRightTab("publish")}
            />
          ) : (
            <div className="flex-1 overflow-y-auto p-4">
              {events.length === 0 ? <p className="text-[13px] text-fg-subtle">{t("noEvents")}</p> : (
                <ol className="space-y-3">
                  {events.map((e) => (
                    <li key={e.id} className="flex gap-3 text-[13px]">
                      <span className="mt-1.5 size-1.5 rounded-full bg-accent shrink-0" />
                      <div>
                        <p className="text-fg">{t.has(`eventTypes.${e.type}`) ? t(`eventTypes.${e.type}`, { to: String((e.payload as Record<string, unknown>)?.to ?? ""), n: String((e.payload as Record<string, unknown>)?.number ?? "") }) : e.type}</p>
                        <p className="text-fg-subtle"><RelativeTime value={e.created_at} /></p>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          )}
        </section>

        {/* CENTRO */}
        <section className="min-h-[420px] lg:min-h-0 flex flex-col bg-bg-elevated">
          <div className="h-11 shrink-0 border-b border-border flex items-center justify-between gap-2 px-3">
            <span className="text-[13px] font-medium text-fg-muted truncate">{t("preview")}{previewing ? ` · v${previewing.number}` : ""}</span>
            <div className="flex items-center gap-2">
              <div className="inline-flex h-8 items-center rounded-full border border-border bg-surface p-0.5">
                {(["desktop", "mobile"] as Device[]).map((d) => (
                  <button key={d} type="button" onClick={() => setDevice(d)} aria-pressed={device === d} className={cn("h-7 px-3 rounded-full text-[12px] inline-flex items-center gap-1.5 transition-colors", device === d ? "bg-white/10 text-fg" : "text-fg-subtle hover:text-fg")}>
                    {d === "desktop" ? <Monitor className="size-3.5" /> : <Smartphone className="size-3.5" />}{t(d)}
                  </button>
                ))}
              </div>
              {previewing && <Button size="sm" variant="ghost" onClick={() => setFrameKey((k) => k + 1)} aria-label={t("refresh")}><RefreshCw className="size-4" /></Button>}
              {previewing && <a href={`/api/projects/${project.id}/preview?v=${previewing.id}`} target="_blank" rel="noreferrer"><Button size="sm" variant="ghost" aria-label="Abrir"><ExternalLink className="size-4" /></Button></a>}
            </div>
          </div>
          <div className="flex-1 min-h-0 p-3 sm:p-5 flex items-stretch justify-center">
            {previewing ? (
              <div className={cn("h-full min-h-[380px] rounded-[14px] border border-border-strong bg-white overflow-hidden transition-[width] duration-300", device === "desktop" ? "w-full" : "w-[390px] max-w-full")}>
                <iframe key={`${previewing.id}-${frameKey}`} title={t("preview")} src={`/api/projects/${project.id}/preview?v=${previewing.id}`} className="w-full h-full border-0 bg-white" sandbox="allow-scripts allow-forms allow-popups allow-modals" />
              </div>
            ) : (
              <div className={cn("h-full min-h-[380px] rounded-[14px] border border-dashed border-border-strong bg-surface/60 flex items-center justify-center transition-[width] duration-300", device === "desktop" ? "w-full" : "w-[390px] max-w-full")}>
                <div className="text-center px-6 max-w-sm">
                  {busy === "build" || activeRun?.step === "developer" ? <Loader2 className="mx-auto size-6 text-accent animate-spin" /> : <MonitorOff className="mx-auto size-6 text-fg-subtle" />}
                  <p className="mt-3 text-[15px] font-medium">{busy === "build" || activeRun?.step === "developer" ? t("building") : t("previewPending.title")}</p>
                  <p className="mt-1.5 text-[13px] text-fg-muted leading-relaxed">{t("previewPending.text")}</p>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* DERECHA */}
        <section className="lg:min-h-0 flex flex-col border-t lg:border-t-0 lg:border-l border-border">
          <Tabs value={rightTab} onChange={setRightTab} compact items={[
            { key: "overview", label: t("overview") },
            { key: "proposal", label: t("proposalTab"), dot: project.status === "proposal" },
            { key: "spec", label: t("structure") },
            { key: "versions", label: t("versions") },
            { key: "images", label: t("images") },
            { key: "files", label: t("files") },
            { key: "qa", label: "QA" },
            { key: "publish", label: t("publish"), dot: Boolean(currentVersion && !site) },
          ]} />
          <div className="flex-1 overflow-y-auto p-4 text-[13px]">
            {rightTab === "overview" && <Overview detail={detail} isArchived={isArchived} archiving={archiving} onArchive={() => startArchive(() => void setProjectArchivedAction(project.id, !isArchived))} />}
            {rightTab === "proposal" && <ProposalPanel detail={detail} busy={Boolean(busy)} onApprove={approve} onRebuild={rebuild} />}
            {rightTab === "spec" && <SpecPanel detail={detail} />}
            {rightTab === "versions" && <VersionsPanel detail={detail} previewVersion={previewing?.id ?? null} onPreview={(id) => { setPreviewVersion(id); setFrameKey((k) => k + 1); }} />}
            {rightTab === "images" && <ImagesPanel detail={detail} />}
            {rightTab === "files" && <FilesPanel detail={detail} />}
            {rightTab === "qa" && <QaPanel detail={detail} version={previewing} />}
            {rightTab === "publish" && <PublishPanel detail={detail} />}
          </div>
        </section>
      </div>
    </div>
  );
}

/* --------------------------------------------------------------------------- */

function errCopy(e: unknown, t: ReturnType<typeof useTranslations>) {
  const code = (e as { code?: string })?.code;
  if (code === "ai_not_configured") return t("errors.aiNotConfigured");
  if (code === "busy") return t("errors.busy");
  if (code === "invalid_json") return t("errors.invalidJson");
  if (code === "truncated") return t("errors.truncated");
  return t("errors.generic", { message: (e as Error)?.message ?? "" });
}

function Tabs<T extends string>({ value, onChange, items, compact }: { value: T; onChange: (v: T) => void; items: { key: T; label: string; icon?: React.ComponentType<{ className?: string }>; dot?: boolean }[]; compact?: boolean }) {
  return (
    <div className="h-11 shrink-0 border-b border-border flex items-center px-2 gap-1 overflow-x-auto" role="tablist">
      {items.map((it) => (
        <button key={it.key} role="tab" type="button" aria-selected={value === it.key} onClick={() => onChange(it.key)}
          className={cn("relative h-8 rounded-[8px] inline-flex items-center gap-1.5 font-medium whitespace-nowrap transition-colors", compact ? "px-2.5 text-[12px]" : "px-3 text-[13px]", value === it.key ? "bg-white/8 text-fg" : "text-fg-muted hover:text-fg")}>
          {it.icon && <it.icon className="size-3.5" />}{it.label}
          {it.dot && <span className="absolute -top-0.5 -right-0.5 size-1.5 rounded-full bg-accent" />}
        </button>
      ))}
    </div>
  );
}

function Field({ label, children }: { label: string; children?: React.ReactNode }) {
  return <div><p className="text-[11px] uppercase tracking-wide text-fg-subtle mb-1.5">{label}</p>{children}</div>;
}

/* ------------------------------------------------------------- conversación */
function Conversation({ messages, busy, error, disabled, canAnswer, onSend, onRetryBuild, onOpenProposal, waitingApproval, previewNote, onOpenPublish }: {
  messages: Message[]; busy: string | null; error: string | null; disabled: boolean; canAnswer: boolean;
  onSend: (c: string) => void; onRetryBuild: () => void; onOpenProposal: () => void; waitingApproval: boolean;
  previewNote: string | null; onOpenPublish: () => void;
}) {
  const t = useTranslations("app.workspace");
  const [text, setText] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [other, setOther] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => { bottomRef.current?.scrollIntoView({ block: "end" }); }, [messages.length, busy]);

  const lastUserIdx = messages.map((m) => m.role).lastIndexOf("user");
  const lastQuestionMsg = [...messages].reverse().find((m) => (m.content_json as MsgJson | null)?.question);
  const questionActive = Boolean(lastQuestionMsg && canAnswer && !busy && messages.indexOf(lastQuestionMsg) > lastUserIdx);

  const submit = (content: string) => { const c = content.trim(); if (!c || busy || disabled) return; setText(""); setSelected([]); setOther(false); onSend(c); };

  return (
    <>
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((m) => {
          const j = (m.content_json as MsgJson | null) ?? {};
          const isUser = m.role === "user";
          const isLastQ = m === lastQuestionMsg;
          return (
            <div key={m.id} className="flex gap-3">
              <div className={cn("size-7 shrink-0 rounded-full flex items-center justify-center", isUser ? "bg-white/8 text-fg-muted" : "bg-accent-gradient text-accent-fg")}>{isUser ? <User className="size-3.5" /> : <Bot className="size-3.5" />}</div>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] text-fg-subtle mb-1 flex items-center gap-1.5 flex-wrap">
                  {isUser ? t("you") : <Badge tone="accent" className="h-[18px] text-[11px]">{m.agent_type ? t(`agents.${m.agent_type}`) : "Ideon"}</Badge>}
                  {j.progress && <Badge className="h-[18px] text-[11px]">{t("step", { step: j.progress.step, total: j.progress.total })}</Badge>}
                  · <RelativeTime value={m.created_at} />
                </p>
                <p className="text-[14px] leading-relaxed whitespace-pre-wrap break-words">{m.content}</p>
                {j.question && (
                  <div className={cn("mt-2.5 rounded-[12px] border p-3", isLastQ && questionActive ? "border-accent/40 bg-accent-soft" : "border-border bg-surface opacity-70")}>
                    <p className="font-semibold mb-2">{j.question.text}</p>
                    {j.question.multi && isLastQ && questionActive && <p className="text-[12px] text-fg-subtle mb-2">{t("multiHelp")}</p>}
                    <div className="flex flex-col gap-1.5">
                      {j.question.options.map((o) => {
                        const active = isLastQ && questionActive;
                        const sel = selected.includes(o);
                        return (
                          <button key={o} type="button" disabled={!active} onClick={() => j.question!.multi ? setSelected((s) => sel ? s.filter((x) => x !== o) : [...s, o]) : submit(o)}
                            className={cn("text-left px-3 py-2 rounded-[10px] border text-[13px] leading-snug transition-colors", sel ? "border-accent bg-accent-soft shadow-[inset_0_0_0_1px_var(--accent)]" : "border-border-strong bg-surface", active ? "hover:border-accent hover:bg-surface-hover" : "cursor-default")}>{o}</button>
                        );
                      })}
                      {isLastQ && questionActive && (
                        <button type="button" onClick={() => setOther((v) => !v)} className="text-left px-3 py-2 rounded-[10px] border border-dashed border-border-strong text-[13px] text-fg-muted hover:border-accent">{t("other")}</button>
                      )}
                    </div>
                    {isLastQ && questionActive && other && (
                      <form className="mt-2 flex gap-1.5" onSubmit={(e) => { e.preventDefault(); const all = [...selected, text.trim()].filter(Boolean); submit(all.join(", ")); }}>
                        <Input autoFocus value={text} onChange={(e) => setText(e.target.value)} placeholder={t("otherPlaceholder")} className="h-9" maxLength={300} />
                        <Button type="submit" size="sm">{t("send")}</Button>
                      </form>
                    )}
                    {isLastQ && questionActive && (
                      <div className="mt-2.5 flex flex-wrap items-center gap-2">
                        {j.question.multi && <Button size="sm" onClick={() => selected.length ? submit(selected.join(", ")) : null} disabled={!selected.length}>{t("continue")}</Button>}
                        <Button size="sm" variant="ghost" onClick={() => submit(t("decideForMe"))}>{t("decideForMeBtn")}</Button>
                      </div>
                    )}
                  </div>
                )}
                {j.proposal_id && waitingApproval && !busy && (
                  <Button size="sm" className="mt-2.5" onClick={onOpenProposal}>{t("reviewProposal")}</Button>
                )}
                {j.retry === "build" && !busy && m === messages[messages.length - 1] && (
                  <Button size="sm" variant="secondary" className="mt-2.5" onClick={onRetryBuild}>{t("retryBuild")}</Button>
                )}
              </div>
            </div>
          );
        })}

        {busy && (
          <div className="flex gap-3">
            <div className="size-7 shrink-0 rounded-full bg-accent-gradient text-accent-fg flex items-center justify-center"><Bot className="size-3.5" /></div>
            <div className="min-w-0">
              <p className="text-[11px] text-fg-subtle mb-1"><Badge tone="accent" className="h-[18px] text-[11px]">{t.has(`agents.${busy}`) ? t(`agents.${busy}`) : t("agents.consultant")}</Badge></p>
              <p className="text-[14px] text-fg-muted inline-flex items-center gap-2"><Loader2 className="size-4 animate-spin text-accent" /> {t.has(`working.${busy}`) ? t(`working.${busy}`) : t("working.message")}</p>
            </div>
          </div>
        )}
        {error && <p className="text-[13px] text-danger" role="alert">{error}</p>}
        {messages.length === 0 && !busy && <p className="text-[13px] text-fg-subtle">{t("noMessages")}</p>}
        <div ref={bottomRef} />
      </div>

      <form className="shrink-0 border-t border-border p-3" onSubmit={(e) => { e.preventDefault(); submit(text); }}>
        {previewNote && (
          <p className="mb-2 flex items-center justify-between gap-2 text-[12px] text-fg-muted">
            <span>{previewNote}</span>
            <button type="button" onClick={onOpenPublish} className="text-accent hover:underline shrink-0">{t("activateProject")}</button>
          </p>
        )}
        <div className="rounded-[12px] border border-border bg-surface focus-within:border-accent/60 transition-colors">
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} maxLength={20000} disabled={disabled || Boolean(busy)}
            placeholder={waitingApproval ? t("inputWaitingApproval") : canAnswer ? t("inputAnswer") : t("inputChange")}
            onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") submit(text); }}
            className="w-full bg-transparent resize-none outline-none px-3.5 pt-3 pb-1 text-[14px] leading-relaxed placeholder:text-fg-subtle disabled:opacity-50" />
          <div className="flex items-center justify-between px-2 pb-2">
            <span className="pl-1.5 text-[12px] text-fg-subtle">⌘↵</span>
            <Button size="sm" type="submit" loading={Boolean(busy)} disabled={disabled}><Send className="size-3.5" /> {t("send")}</Button>
          </div>
        </div>
      </form>
    </>
  );
}

/* ------------------------------------------------------------- paneles */
function Overview({ detail, isArchived, archiving, onArchive }: { detail: ProjectDetail; isArchived: boolean; archiving: boolean; onArchive: () => void }) {
  const t = useTranslations("app.workspace");
  const locale = useLocale();
  const { project } = detail;
  const brief = (project.brief as Record<string, unknown> | null) ?? {};
  const str = (v: unknown) => (Array.isArray(v) ? v.join(", ") : typeof v === "string" ? v : "");
  return (
    <div className="space-y-5">
      <Field label={t("kind")}><p>{t(`kinds.${project.kind}`)}</p></Field>
      <Field label={t("idea")}><p className="leading-relaxed whitespace-pre-wrap">{project.initial_idea}</p></Field>
      <Field label={t("goal")}><p className={str(brief.goal) ? "" : "text-fg-muted"}>{str(brief.goal) || t("definedWithConsultant")}</p></Field>
      <Field label={t("audience")}><p className={str(brief.audience) ? "" : "text-fg-muted"}>{str(brief.audience) || t("tbd")}</p></Field>
      <Field label={t("style")}><p className={str(brief.style) ? "" : "text-fg-muted"}>{str(brief.style) || t("tbd")}</p></Field>
      {str(brief.sections || brief.features) && <Field label={t("features")}><p>{str(brief.sections || brief.features)}</p></Field>}
      <Field label={t("complexity")}><p className="capitalize text-fg-muted">{project.complexity ?? t("tbd")}</p></Field>
      <Field label={t("createdAt")}><p className="text-fg-muted">{formatDate(project.created_at, locale)}</p></Field>
      <Card className="p-4">
        <Button variant={isArchived ? "secondary" : "danger"} size="sm" loading={archiving} onClick={onArchive}>
          {isArchived ? <ArchiveRestore className="size-4" /> : <Archive className="size-4" />}{isArchived ? t("restore") : t("archive")}
        </Button>
      </Card>
    </div>
  );
}

function ProposalPanel({ detail, busy, onApprove, onRebuild }: { detail: ProjectDetail; busy: boolean; onApprove: () => void; onRebuild: () => void }) {
  const t = useTranslations("app.workspace");
  const locale = useLocale();
  const { proposal, project } = detail;
  if (!proposal) return <p className="text-fg-subtle">{t("noProposal")}</p>;
  const items = (proposal.items as { name: string; description: string; effort_days: number }[]) ?? [];
  const ext = (proposal.external_costs as { name: string; amount: number | null; currency: string; period: string; note?: string }[]) ?? [];
  const maint = proposal.maintenance_option as { price: number | null; currency: string; period: string; includes: string[] } | null;
  const money = (n: number | null, c: string) => n == null ? t("priceByScope") : new Intl.NumberFormat(locale, { style: "currency", currency: c, maximumFractionDigits: 0 }).format(n);
  return (
    <div className="space-y-5">
      <div>
        <div className="flex items-center justify-between gap-2"><h3 className="text-[15px] font-semibold">{proposal.title}</h3><Badge tone={proposal.status === "approved" ? "success" : "info"}>{t(`proposalStatus.${proposal.status}`)}</Badge></div>
        <p className="mt-1 text-fg-muted leading-relaxed">{proposal.summary}</p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Card className="p-3"><p className="text-[11px] uppercase tracking-wide text-fg-subtle">{t("plan")}</p><p className="mt-1 font-semibold capitalize">{proposal.plan_key ?? proposal.complexity}</p></Card>
        <Card className="p-3"><p className="text-[11px] uppercase tracking-wide text-fg-subtle">{t("estimatedTime")}</p><p className="mt-1 font-semibold">{t("days", { n: proposal.estimated_days ?? 0 })}</p></Card>
        <Card className="p-3 col-span-2"><p className="text-[11px] uppercase tracking-wide text-fg-subtle">{t("price")}</p><p className="mt-1 text-xl font-semibold">{money(proposal.price == null ? null : Number(proposal.price), proposal.currency)}</p>{proposal.price == null && <p className="text-[12px] text-fg-subtle mt-1">{t("priceByScopeNote")}</p>}</Card>
      </div>
      <Field label={t("deliverables")}>
        <ul className="space-y-1.5">{items.map((i, k) => <li key={k} className="flex gap-2"><Check className="size-4 text-success shrink-0 mt-0.5" /><span><b>{i.name}</b>{i.description ? ` — ${i.description}` : ""}</span></li>)}</ul>
      </Field>
      <Field label={t("externalCosts")}>
        <ul className="space-y-1 text-fg-muted">{ext.map((c, k) => <li key={k}>{c.name}: <b className="text-fg">{c.amount == null ? t("variable") : c.amount === 0 ? t("included") : `${c.amount} ${c.currency}/${c.period}`}</b>{c.note ? ` · ${c.note}` : ""}</li>)}</ul>
      </Field>
      {maint && <Field label={t("maintenance")}><p className="text-fg-muted">{maint.includes.join(" · ")} — {money(maint.price, maint.currency)}/{maint.period}</p></Field>}
      {proposal.status === "sent" && project.status === "proposal" && (
        <div className="space-y-2">
          <Button className="w-full" loading={busy} onClick={onApprove}><Check className="size-4" /> {t("approveAndBuild")}</Button>
          <p className="text-[12px] text-fg-subtle leading-relaxed">{t("approveNote")}</p>
        </div>
      )}
      {proposal.status === "approved" && (
        project.paid_at
          ? <Badge tone="success">{t("paid")}</Badge>
          : <p className="text-[12px] text-fg-subtle leading-relaxed">{t("payOnActivate")}</p>
      )}
      {proposal.status === "approved" && ["approved", "review"].includes(project.status) && (
        <Button variant="secondary" size="sm" loading={busy} onClick={onRebuild}><RefreshCw className="size-4" /> {project.current_version_id ? t("regenerate") : t("retryBuild")}</Button>
      )}
    </div>
  );
}

function SpecPanel({ detail }: { detail: ProjectDetail }) {
  const t = useTranslations("app.workspace");
  const s = detail.specification?.content as { name?: string; tagline?: string; pages?: { title: string; sections?: { heading?: string; type?: string }[] }[]; entities?: { label?: string; name?: string; fields?: unknown[] }[]; workflows?: string[]; style?: { mood?: string; font?: string; palette?: Record<string, string> }; cta?: string } | undefined;
  if (!s) return <p className="text-fg-subtle">{t("noSpec")}</p>;
  return (
    <div className="space-y-5">
      <Field label={t("name")}><p className="font-semibold">{s.name}</p><p className="text-fg-muted">{s.tagline}</p></Field>
      <Field label={detail.project.kind === "web" ? t("pagesSections") : t("modulesViews")}>
        {(s.pages ?? []).map((pg, i) => <div key={i} className="mb-2"><b>{pg.title}</b><ul className="mt-1 ml-4 list-disc text-fg-muted">{(pg.sections ?? []).map((sec, k) => <li key={k}>{sec.heading || sec.type}</li>)}</ul></div>)}
      </Field>
      {s.entities?.length ? <Field label={t("entities")}><ul className="ml-4 list-disc text-fg-muted">{s.entities.map((e, i) => <li key={i}><b className="text-fg">{e.label || e.name}</b> · {(e.fields ?? []).length} {t("fields")}</li>)}</ul></Field> : null}
      {s.workflows?.length ? <Field label={t("workflows")}><ul className="ml-4 list-disc text-fg-muted">{s.workflows.map((w, i) => <li key={i}>{w}</li>)}</ul></Field> : null}
      <Field label={t("style")}><p className="text-fg-muted">{[s.style?.mood, s.style?.font, s.style?.palette && Object.values(s.style.palette).join(" · ")].filter(Boolean).join(" · ")}</p></Field>
      <Field label={t("cta")}><p>{s.cta || "—"}</p></Field>
    </div>
  );
}

function VersionsPanel({ detail, previewVersion, onPreview }: { detail: ProjectDetail; previewVersion: string | null; onPreview: (id: string) => void }) {
  const t = useTranslations("app.workspace");
  const [pending, start] = useTransition();
  const { versions, project } = detail;
  if (!versions.length) return <p className="text-fg-subtle">{t("noVersions")}</p>;
  return (
    <div className="space-y-2">
      {versions.map((v) => {
        const qa = (v.qa_report as { level: string }[] | null) ?? [];
        const bad = qa.filter((c) => c.level === "bad").length;
        const isCurrent = v.id === project.current_version_id;
        return (
          <div key={v.id} className={cn("rounded-[10px] border p-3 bg-surface", v.id === previewVersion ? "border-accent/50" : "border-border")}>
            <div className="flex items-center gap-2">
              <span className="font-mono text-[12px]">v{v.number}</span>
              <span className="flex-1 truncate" title={v.summary ?? ""}>{v.summary}</span>
              {isCurrent ? <Badge tone="success">{t("current")}</Badge> : null}
            </div>
            <div className="mt-1.5 flex items-center gap-2 text-[12px] text-fg-subtle">
              <RelativeTime value={v.created_at} /> · QA {qa.length - bad}/{qa.length}
              <span className="flex-1" />
              {v.id !== previewVersion && <button type="button" className="text-fg-muted hover:text-fg" onClick={() => onPreview(v.id)}>{t("view")}</button>}
              {!isCurrent && <button type="button" className="text-accent hover:underline disabled:opacity-50" disabled={pending} onClick={() => start(() => void setCurrentVersionAction(project.id, v.id))}>{t("makeCurrent")}</button>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ImagesPanel({ detail }: { detail: ProjectDetail }) {
  const t = useTranslations("app.workspace");
  const router = useRouter();
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { images, project } = detail;

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setError(null);
    const list = Array.from(files).slice(0, MAX_IMAGES - images.length);
    for (const [i, f] of list.entries()) {
      setStatus(t("uploadingN", { n: i + 1, total: list.length }));
      try { await uploadToProject(project.id, f); }
      catch (e) { setError(e instanceof Error ? e.message : t("uploadFailed")); }
    }
    setStatus(null); if (inputRef.current) inputRef.current.value = ""; router.refresh();
  }
  async function remove(id: string) { await api(`/api/projects/${project.id}/images`, { method: "DELETE", body: JSON.stringify({ imageId: id }) }).catch(() => null); router.refresh(); }
  async function rename(id: string, label: string) { await api(`/api/projects/${project.id}/images`, { method: "PATCH", body: JSON.stringify({ imageId: id, label }) }).catch(() => null); }

  return (
    <div className="space-y-4">
      <p className="text-fg-muted leading-relaxed">{t("imagesHelp")}</p>
      <input ref={inputRef} type="file" accept={IMAGE_ACCEPT} multiple className="hidden" onChange={(e) => upload(e.target.files)} />
      <div className="flex items-center gap-2">
        <Button size="sm" variant="secondary" onClick={() => inputRef.current?.click()} disabled={images.length >= MAX_IMAGES || Boolean(status)}>{status ? <Loader2 className="size-4 animate-spin" /> : <ImagePlus className="size-4" />} {t("uploadPhotos")}</Button>
        <span className="text-[12px] text-fg-subtle">{status ?? `${images.length}/${MAX_IMAGES} · ${t("imageFormats")}`}</span>
      </div>
      {error && <p className="text-[12px] text-danger" role="alert">{error}</p>}
      <div className="space-y-2">
        {images.map((img) => (
          <div key={img.id} className="grid grid-cols-[56px_1fr_auto] gap-2 items-center rounded-[10px] border border-border bg-surface p-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/api/images/${img.id}`} alt="" className="w-14 h-11 object-cover rounded-md bg-surface-2" />
            <div className="min-w-0">
              <Input defaultValue={img.label} maxLength={80} className="h-8 text-[13px]" onBlur={(e) => e.target.value.trim() && e.target.value.trim() !== img.label && rename(img.id, e.target.value.trim())} aria-label={t("photoName")} />
              <p className="text-[11px] text-fg-subtle mt-1">{img.width ? `${img.width}×${img.height} · ` : ""}{Math.round((img.size ?? 0) / 1024)} KB</p>
            </div>
            <Button size="sm" variant="ghost" onClick={() => remove(img.id)} aria-label={t("remove")}><Trash2 className="size-4" /></Button>
          </div>
        ))}
        {!images.length && <p className="text-fg-subtle">{t("noImages")}</p>}
      </div>
    </div>
  );
}

function FilesPanel({ detail }: { detail: ProjectDetail }) {
  const t = useTranslations("app.workspace");
  const router = useRouter();
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { assets, project } = detail;
  // Cambios de casillas aplicados al instante; se descartan si el servidor los rechaza.
  const [flags, setFlags] = useState<Record<string, { useReference?: boolean; useSite?: boolean }>>({});
  const flag = (a: (typeof assets)[number], k: "useReference" | "useSite") => flags[a.id]?.[k] ?? (k === "useReference" ? a.use_reference : a.use_site);
  const refTokens = estimateTokens(assets.filter((a) => flag(a, "useReference")).reduce((n, a) => n + a.text_chars, 0));

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setError(null);
    const list = Array.from(files).slice(0, MAX_ASSETS - assets.length);
    for (const [i, f] of list.entries()) {
      setStatus(t("uploadingN", { n: i + 1, total: list.length }));
      try {
        if (classifyUpload(f) !== "asset") throw new Error(t("filesUnsupported", { name: f.name }));
        await uploadToProject(project.id, f);
      } catch (e) { setError(e instanceof Error ? e.message : t("uploadFailed")); }
    }
    setStatus(null); if (inputRef.current) inputRef.current.value = ""; router.refresh();
  }
  async function patch(assetId: string, body: { label?: string; useReference?: boolean; useSite?: boolean }) {
    setError(null);
    const toggles = { ...(body.useReference !== undefined && { useReference: body.useReference }), ...(body.useSite !== undefined && { useSite: body.useSite }) };
    if (Object.keys(toggles).length) setFlags((f) => ({ ...f, [assetId]: { ...f[assetId], ...toggles } }));
    try { await api(`/api/projects/${project.id}/assets`, { method: "PATCH", body: JSON.stringify({ assetId, ...body }) }); router.refresh(); }
    catch (e) {
      setFlags((f) => { const n = { ...f }; delete n[assetId]; return n; });
      setError(e instanceof Error ? e.message : t("uploadFailed"));
    }
  }
  async function remove(assetId: string) { await api(`/api/projects/${project.id}/assets`, { method: "DELETE", body: JSON.stringify({ assetId }) }).catch(() => null); router.refresh(); }

  return (
    <div className="space-y-4">
      <p className="text-fg-muted leading-relaxed">{t("filesHelp")}</p>
      <input ref={inputRef} type="file" accept={ASSET_ACCEPT} multiple className="hidden" onChange={(e) => upload(e.target.files)} />
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="secondary" onClick={() => inputRef.current?.click()} disabled={assets.length >= MAX_ASSETS || Boolean(status)}>{status ? <Loader2 className="size-4 animate-spin" /> : <FilePlus className="size-4" />} {t("uploadFiles")}</Button>
        <span className="text-[12px] text-fg-subtle">{status ?? `${assets.length}/${MAX_ASSETS} · ${t("fileFormats")}`}</span>
      </div>
      {error && <p className="text-[12px] text-danger" role="alert">{error}</p>}
      {refTokens > 0 && <p className="text-[12px] text-fg-subtle">{t("filesTokens", { tokens: refTokens.toLocaleString() })}</p>}
      <div className="space-y-2">
        {assets.map((a) => {
          const type = assetTypeFor(a.name);
          return (
            <div key={a.id} className="rounded-[10px] border border-border bg-surface p-2.5 space-y-2">
              <div className="grid grid-cols-[auto_1fr_auto] gap-2 items-center">
                <span className="w-11 h-9 rounded-md bg-surface-2 flex items-center justify-center font-mono text-[10px] uppercase text-fg-muted">{type?.ext ?? "?"}</span>
                <div className="min-w-0">
                  <Input defaultValue={a.label} maxLength={80} className="h-8 text-[13px]" aria-label={t("fileName")}
                    onBlur={(e) => e.target.value.trim() && e.target.value.trim() !== a.label && patch(a.id, { label: e.target.value.trim() })} />
                  <p className="text-[11px] text-fg-subtle mt-1 truncate">{a.name} · {Math.max(1, Math.round(a.size / 1024))} KB · {extractLabel(a, t)}</p>
                </div>
                <Button size="sm" variant="ghost" onClick={() => remove(a.id)} aria-label={t("remove")}><Trash2 className="size-4" /></Button>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 pl-1">
                {type?.reference && (
                  <label className={cn("inline-flex items-center gap-1.5 text-[12px]", a.extract_status !== "ok" && "opacity-50")}>
                    <input type="checkbox" checked={flag(a, "useReference")} disabled={a.extract_status !== "ok"} onChange={(e) => patch(a.id, { useReference: e.target.checked })} />
                    {t("useReference")}
                  </label>
                )}
                {type?.site && (
                  <label className="inline-flex items-center gap-1.5 text-[12px]">
                    <input type="checkbox" checked={flag(a, "useSite")} onChange={(e) => patch(a.id, { useSite: e.target.checked })} />
                    {t("useSite")}
                  </label>
                )}
              </div>
            </div>
          );
        })}
        {!assets.length && <p className="text-fg-subtle">{t("noFiles")}</p>}
      </div>
    </div>
  );
}

function extractLabel(a: ProjectDetail["assets"][number], t: ReturnType<typeof useTranslations>) {
  switch (a.extract_status) {
    case "ok": return t("extractOk", { tokens: estimateTokens(a.text_chars).toLocaleString() });
    case "empty": return t("extractEmpty");
    case "failed": return t("extractFailed");
    default: return t("extractNone");
  }
}

function QaPanel({ detail, version }: { detail: ProjectDetail; version: ProjectDetail["versions"][number] | null }) {
  const t = useTranslations("app.workspace");
  const qa = (version?.qa_report as { level: "ok" | "warn" | "bad"; text: string }[] | null) ?? null;
  if (!qa) return <p className="text-fg-subtle">{t("noQa")}</p>;
  return (
    <div className="space-y-2">
      <p className="text-fg-muted">v{version?.number} · {qa.filter((c) => c.level === "ok").length}/{qa.length} {t("checks")}</p>
      {qa.map((c, i) => <div key={i} className="flex gap-2"><span className={c.level === "ok" ? "text-success" : c.level === "warn" ? "text-warning" : "text-danger"}>{c.level === "ok" ? "✓" : c.level === "warn" ? "!" : "✕"}</span><span>{c.text}</span></div>)}
      <p className="text-[12px] text-fg-subtle pt-2">{detail.project.kind === "web" ? t("qaNoteWeb") : t("qaNoteApp")}</p>
    </div>
  );
}

function PublishPanel({ detail }: { detail: ProjectDetail }) {
  if (!detail.project.paid_at && !detail.isPlatformAdmin) return <LaunchPanel detail={detail} />;
  return <PublishPanelUnlocked detail={detail} />;
}

function PublishPanelUnlocked({ detail }: { detail: ProjectDetail }) {
  const t = useTranslations("app.workspace");
  const router = useRouter();
  const { project, site, deployments, vercelConfigured, siteBaseUrl } = detail;
  const [slug, setSlug] = useState(site?.slug ?? "");
  const [domain, setDomain] = useState(site?.custom_domain ?? "");
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [dnsDetail, setDnsDetail] = useState<string | null>(null);
  const canPublish = Boolean(project.current_version_id);
  const go = async (label: string, fn: () => Promise<unknown>) => { setBusy(label); setMsg(null); try { await fn(); } catch (e) { setMsg((e as Error).message); } finally { setBusy(null); router.refresh(); } };
  const verification = site?.domain_verification as { type?: string; name?: string; value?: string; note?: string } | null;

  return (
    <div className="space-y-5">
      <DomainOrderCard detail={detail} />
      <Field label={t("publishOnIdeon")}>
        <p className="text-fg-muted leading-relaxed mb-2">{t("publishHelp")}</p>
        <div className="flex gap-1.5">
          <Input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="mi-negocio" className="h-9" maxLength={40} />
          <Button size="sm" loading={busy === "ideon"} disabled={!canPublish} onClick={() => go("ideon", () => api(`/api/projects/${project.id}/publish`, { method: "POST", body: JSON.stringify({ target: "ideon", slug: slug || undefined }) }))}><Rocket className="size-4" /> {site ? t("republish") : t("publishNow")}</Button>
        </div>
        {!canPublish && <p className="text-[12px] text-fg-subtle mt-1.5">{t("publishNeedsVersion")}</p>}
        {site && <p className="mt-2"><a className="text-accent hover:underline inline-flex items-center gap-1" href={`${siteBaseUrl}/s/${site.slug}`} target="_blank" rel="noreferrer">{siteBaseUrl}/s/{site.slug} <ExternalLink className="size-3" /></a><span className="text-fg-subtle"> · <RelativeTime value={site.published_at} /></span></p>}
      </Field>

      <Field label={t("customDomain")}>
        {!site ? <p className="text-fg-muted">{t("domainNeedsPublish")}</p> : (
          <>
            <div className="flex gap-1.5">
              <Input value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="www.minegocio.com" className="h-9" />
              <Button size="sm" variant="secondary" loading={busy === "domain"} disabled={!domain.trim()} onClick={() => go("domain", () => api(`/api/projects/${project.id}/domain`, { method: "POST", body: JSON.stringify({ domain }) }))}><Globe className="size-4" /> {t("connect")}</Button>
            </div>
            {site.custom_domain && (
              <Card className="mt-2 p-3 space-y-2">
                <div className="flex items-center gap-2"><b>{site.custom_domain}</b><Badge tone={site.domain_status === "verified" ? "success" : "warning"}>{site.domain_status === "verified" ? t("domainVerified") : t("domainPending")}</Badge></div>
                {verification && <p className="text-fg-muted leading-relaxed">{t("dnsInstruction", { type: verification.type ?? "CNAME", name: verification.name ?? site.custom_domain, value: verification.value ?? "" })}<br /><span className="text-fg-subtle">{verification.note}</span></p>}
                <div className="flex gap-2">
                  <Button size="sm" variant="secondary" loading={busy === "verify"} onClick={() => go("verify", async () => { const r = await api(`/api/projects/${project.id}/domain`, { method: "PUT" }); setDnsDetail(r.detail); })}>{t("verifyDns")}</Button>
                  <Button size="sm" variant="ghost" loading={busy === "rmdomain"} onClick={() => go("rmdomain", () => api(`/api/projects/${project.id}/domain`, { method: "DELETE" }))}><X className="size-4" /> {t("remove")}</Button>
                </div>
                {dnsDetail && <p className="text-[12px] text-fg-subtle">{dnsDetail}</p>}
              </Card>
            )}
            <p className="text-[12px] text-fg-subtle mt-2 leading-relaxed">{t("domainBuyNote")}</p>
          </>
        )}
      </Field>

      <Field label="Vercel">
        {vercelConfigured ? (
          <Button size="sm" variant="secondary" loading={busy === "vercel"} disabled={!canPublish} onClick={() => go("vercel", () => api(`/api/projects/${project.id}/publish`, { method: "POST", body: JSON.stringify({ target: "vercel", slug: slug || undefined }) }))}><Rocket className="size-4" /> {t("deployVercel")}</Button>
        ) : <p className="text-fg-muted">{t("vercelNotConfigured")}</p>}
      </Field>

      {deployments.length > 0 && (
        <Field label={t("deployments")}>
          <div className="space-y-1.5">
            {deployments.slice(0, 8).map((d) => (
              <div key={d.id} className="flex items-center gap-2 rounded-[10px] border border-border bg-surface px-3 py-2">
                <Badge tone={d.status === "live" ? "success" : d.status === "failed" ? "danger" : "warning"}>{d.status}</Badge>
                <span className="truncate flex-1">{d.target} · {d.url ? <a className="text-accent hover:underline" href={d.url} target="_blank" rel="noreferrer">{d.url.replace(/^https?:\/\//, "")}</a> : d.logs}</span>
                <span className="text-[12px] text-fg-subtle"><RelativeTime value={d.created_at} /></span>
              </div>
            ))}
          </div>
        </Field>
      )}
      {msg && <p className="text-[13px] text-danger" role="alert">{msg}</p>}
      <Field label={t("download")}>
        <a href={`/api/projects/${project.id}/download`}><Button size="sm" variant="secondary" disabled={!canPublish}><Download className="size-4" /> {t("downloadZip")}</Button></a>
      </Field>
    </div>
  );
}

export type { Json };
