"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  Archive,
  ArchiveRestore,
  Bot,
  ChevronLeft,
  History,
  MessageSquare,
  Monitor,
  MonitorOff,
  Send,
  Smartphone,
  User,
} from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Badge, Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/app/status-badge";
import { sendMessageAction, setProjectArchivedAction, type ActionState } from "@/features/projects/actions";
import type { ProjectDetail } from "@/features/projects/queries";
import { cn, formatDate } from "@/lib/utils";
import { RelativeTime } from "@/components/ui/relative-time";

type LeftTab = "conversation" | "history";
type RightTab = "overview" | "features" | "files" | "settings";
type Device = "desktop" | "mobile";

export function Workspace({ detail }: { detail: ProjectDetail }) {
  const t = useTranslations("app.workspace");
  const locale = useLocale();
  const { project, conversation, messages, events } = detail;
  const [leftTab, setLeftTab] = useState<LeftTab>("conversation");
  const [rightTab, setRightTab] = useState<RightTab>("overview");
  const [device, setDevice] = useState<Device>("desktop");
  const [archiving, startArchive] = useTransition();
  const isArchived = Boolean(project.archived_at);

  return (
    <div className="flex flex-col lg:h-dvh">
      {/* Barra superior del proyecto */}
      <div className="h-14 shrink-0 border-b border-border flex items-center gap-3 px-4 sm:px-6">
        <Link href="/projects" className="text-fg-muted hover:text-fg" aria-label="Back">
          <ChevronLeft className="size-5" />
        </Link>
        <h1 className="text-[15px] font-semibold tracking-tight truncate">{project.name}</h1>
        <StatusBadge status={project.status} />
        {isArchived && <Badge tone="warning">{t("archived")}</Badge>}
      </div>

      {/* Tres zonas */}
      <div className="lg:flex-1 lg:min-h-0 grid grid-cols-1 lg:grid-cols-[360px_1fr_300px] xl:grid-cols-[400px_1fr_320px]">
        {/* IZQUIERDA · conversación / historial */}
        <section className="h-[70vh] lg:h-auto lg:min-h-0 flex flex-col border-b lg:border-b-0 lg:border-r border-border">
          <Tabs
            value={leftTab}
            onChange={setLeftTab}
            items={[
              { key: "conversation", label: t("conversation"), icon: MessageSquare },
              { key: "history", label: t("history"), icon: History },
            ]}
          />
          {leftTab === "conversation" ? (
            <Conversation
              projectId={project.id}
              conversationId={conversation?.id ?? null}
              messages={messages}
              disabled={isArchived}
            />
          ) : (
            <div className="flex-1 overflow-y-auto p-4">
              {events.length === 0 ? (
                <p className="text-[13px] text-fg-subtle">{t("noEvents")}</p>
              ) : (
                <ol className="space-y-3">
                  {events.map((e) => (
                    <li key={e.id} className="flex gap-3 text-[13px]">
                      <span className="mt-1.5 size-1.5 rounded-full bg-accent shrink-0" />
                      <div>
                        <p className="text-fg">
                          {t.has(`eventTypes.${e.type}`)
                            ? t(`eventTypes.${e.type}`, {
                                to: String((e.payload as Record<string, unknown>)?.to ?? ""),
                              })
                            : e.type}
                        </p>
                        <p className="text-fg-subtle"><RelativeTime value={e.created_at} /></p>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          )}
        </section>

        {/* CENTRO · vista previa */}
        <section className="min-h-[360px] lg:min-h-0 flex flex-col bg-bg-elevated">
          <div className="h-11 shrink-0 border-b border-border flex items-center justify-between px-4">
            <span className="text-[13px] font-medium text-fg-muted">{t("preview")}</span>
            <div className="inline-flex h-8 items-center rounded-full border border-border bg-surface p-0.5">
              {(["desktop", "mobile"] as Device[]).map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDevice(d)}
                  aria-pressed={device === d}
                  className={cn(
                    "h-7 px-3 rounded-full text-[12px] inline-flex items-center gap-1.5 transition-colors",
                    device === d ? "bg-white/10 text-fg" : "text-fg-subtle hover:text-fg",
                  )}
                >
                  {d === "desktop" ? <Monitor className="size-3.5" /> : <Smartphone className="size-3.5" />}
                  {t(d)}
                </button>
              ))}
            </div>
          </div>
          <div className="flex-1 min-h-0 p-4 sm:p-6 flex items-center justify-center">
            <div
              className={cn(
                "h-full max-h-full rounded-[14px] border border-dashed border-border-strong bg-surface/60 flex items-center justify-center transition-[width] duration-300",
                device === "desktop" ? "w-full" : "w-[375px] max-w-full",
              )}
            >
              <div className="text-center px-6 max-w-sm">
                <MonitorOff className="mx-auto size-6 text-fg-subtle" />
                <p className="mt-3 text-[15px] font-medium">{t("previewPending.title")}</p>
                <p className="mt-1.5 text-[13px] text-fg-muted leading-relaxed">{t("previewPending.text")}</p>
              </div>
            </div>
          </div>
        </section>

        {/* DERECHA · estructura del proyecto */}
        <section className="lg:min-h-0 flex flex-col border-t lg:border-t-0 lg:border-l border-border">
          <Tabs
            value={rightTab}
            onChange={setRightTab}
            compact
            items={[
              { key: "overview", label: t("overview") },
              { key: "features", label: t("features") },
              { key: "files", label: t("files") },
              { key: "settings", label: t("settings") },
            ]}
          />
          <div className="flex-1 overflow-y-auto p-4 space-y-5 text-[13px]">
            {rightTab === "overview" && (
              <>
                <Field label={t("idea")}>
                  <p className="text-fg leading-relaxed whitespace-pre-wrap">{project.initial_idea}</p>
                </Field>
                <Field label={t("category")}>
                  <p className="text-fg-muted">{project.category_key ?? t("noCategory")}</p>
                </Field>
                <Field label={t("complexity")}>
                  <p className="text-fg-muted capitalize">{project.complexity ?? t("noComplexity")}</p>
                </Field>
                <Field label="ID">
                  <p className="font-mono text-[12px] text-fg-subtle break-all">{project.id}</p>
                </Field>
                <Field label={t("createdAt")}>
                  <p className="text-fg-muted">{formatDate(project.created_at, locale)}</p>
                </Field>
              </>
            )}
            {rightTab === "features" && <p className="text-fg-subtle">{t("noFeatures")}</p>}
            {rightTab === "files" && <p className="text-fg-subtle">{t("noFiles")}</p>}
            {rightTab === "settings" && (
              <Card className="p-4">
                <p className="text-fg-muted leading-relaxed mb-3">
                  {isArchived ? t("archived") : null}
                </p>
                <Button
                  variant={isArchived ? "secondary" : "danger"}
                  size="sm"
                  loading={archiving}
                  onClick={() => startArchive(() => void setProjectArchivedAction(project.id, !isArchived))}
                >
                  {isArchived ? <ArchiveRestore className="size-4" /> : <Archive className="size-4" />}
                  {isArchived ? t("restore") : t("archive")}
                </Button>
              </Card>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------------- */

function Tabs<T extends string>({
  value,
  onChange,
  items,
  compact,
}: {
  value: T;
  onChange: (v: T) => void;
  items: { key: T; label: string; icon?: React.ComponentType<{ className?: string }> }[];
  compact?: boolean;
}) {
  return (
    <div className="h-11 shrink-0 border-b border-border flex items-center px-2 gap-1 overflow-x-auto" role="tablist">
      {items.map((it) => (
        <button
          key={it.key}
          role="tab"
          type="button"
          aria-selected={value === it.key}
          onClick={() => onChange(it.key)}
          className={cn(
            "h-8 rounded-[8px] inline-flex items-center gap-1.5 font-medium whitespace-nowrap transition-colors",
            compact ? "px-2.5 text-[12px]" : "px-3 text-[13px]",
            value === it.key ? "bg-white/8 text-fg" : "text-fg-muted hover:text-fg",
          )}
        >
          {it.icon && <it.icon className="size-3.5" />}
          {it.label}
        </button>
      ))}
    </div>
  );
}

function Field({ label, children }: { label: string; children?: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-fg-subtle mb-1.5">{label}</p>
      {children}
    </div>
  );
}

function Conversation({
  projectId,
  conversationId,
  messages,
  disabled,
}: {
  projectId: string;
  conversationId: string | null;
  messages: ProjectDetail["messages"];
  disabled: boolean;
}) {
  const t = useTranslations("app.workspace");
  const [state, formAction, pending] = useActionState(sendMessageAction, {} as ActionState);
  const formRef = useRef<HTMLFormElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state]);

  return (
    <>
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((m) => (
          <div key={m.id} className={cn("flex gap-3", m.role === "user" ? "" : "")}>
            <div
              className={cn(
                "size-7 shrink-0 rounded-full flex items-center justify-center",
                m.role === "user" ? "bg-white/8 text-fg-muted" : "bg-accent-gradient text-accent-fg",
              )}
            >
              {m.role === "user" ? <User className="size-3.5" /> : <Bot className="size-3.5" />}
            </div>
            <div className="min-w-0">
              <p className="text-[11px] text-fg-subtle mb-1">
                {m.role === "user" ? t("you") : m.agent_type ?? t("system")} · <RelativeTime value={m.created_at} />
              </p>
              <p className="text-[14px] leading-relaxed whitespace-pre-wrap break-words">{m.content}</p>
            </div>
          </div>
        ))}

        <div className="flex gap-3">
          <div className="size-7 shrink-0 rounded-full bg-accent-gradient text-accent-fg flex items-center justify-center opacity-60">
            <Bot className="size-3.5" />
          </div>
          <div className="rounded-[12px] border border-dashed border-border-strong p-3.5">
            <p className="text-[13px] font-medium">{t("consultantPending.title")}</p>
            <p className="mt-1 text-[13px] text-fg-muted leading-relaxed">{t("consultantPending.text")}</p>
          </div>
        </div>
        <div ref={bottomRef} />
      </div>

      <form ref={formRef} action={formAction} className="shrink-0 border-t border-border p-3">
        <input type="hidden" name="projectId" value={projectId} />
        <input type="hidden" name="conversationId" value={conversationId ?? ""} />
        <div className="rounded-[12px] border border-border bg-surface focus-within:border-accent/60 transition-colors">
          <textarea
            name="content"
            rows={2}
            required
            maxLength={20000}
            disabled={disabled || !conversationId}
            placeholder={t("inputPlaceholder")}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") formRef.current?.requestSubmit();
            }}
            className="w-full bg-transparent resize-none outline-none px-3.5 pt-3 pb-1 text-[14px] leading-relaxed placeholder:text-fg-subtle disabled:opacity-50"
          />
          <div className="flex items-center justify-between px-2 pb-2">
            <span className="pl-1.5 text-[12px] text-fg-subtle">
              {state.ok ? t("sent") : state.error ? <span className="text-danger">{state.error}</span> : "⌘↵"}
            </span>
            <Button size="sm" type="submit" loading={pending} disabled={disabled || !conversationId}>
              <Send className="size-3.5" /> {t("send")}
            </Button>
          </div>
        </div>
      </form>
    </>
  );
}
