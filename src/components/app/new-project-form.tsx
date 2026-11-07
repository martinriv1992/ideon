"use client";

import { useActionState, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Lightbulb } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FieldError, Input, Label, Textarea } from "@/components/ui/input";
import { createProjectAction, type ActionState } from "@/features/projects/actions";
import { clearPendingIdea, readPendingIdea } from "@/features/projects/pending-idea";

export function NewProjectForm() {
  const t = useTranslations("app.newProject");
  const tHero = useTranslations("hero");
  const [state, formAction, pending] = useActionState(createProjectAction, {} as ActionState);
  const [idea, setIdea] = useState("");
  const [restored, setRestored] = useState(false);

  useEffect(() => {
    const pendingIdea = readPendingIdea();
    if (pendingIdea) {
      setIdea(pendingIdea.idea);
      setRestored(true);
    }
  }, []);

  useEffect(() => {
    if (state.ok) clearPendingIdea();
  }, [state.ok]);

  return (
    <form
      action={(fd) => {
        clearPendingIdea();
        formAction(fd);
      }}
      className="space-y-6"
    >
      {restored && (
        <div className="flex gap-3 rounded-[12px] border border-accent/30 bg-accent-soft p-3.5 text-[13px]">
          <Lightbulb className="size-4 mt-0.5 shrink-0 text-accent" />
          <span>{t("restored")}</span>
        </div>
      )}

      <div>
        <Label htmlFor="name">{t("nameLabel")}</Label>
        <Input id="name" name="name" placeholder={t("namePlaceholder")} maxLength={120} />
        <p className="mt-1.5 text-[13px] text-fg-subtle">{t("nameHint")}</p>
      </div>

      <div>
        <Label htmlFor="idea">{t("ideaLabel")}</Label>
        <Textarea
          id="idea"
          name="idea"
          rows={8}
          value={idea}
          onChange={(e) => setIdea(e.target.value)}
          placeholder={t("ideaPlaceholder")}
          maxLength={8000}
          required
        />
        <div className="mt-1.5 flex justify-between text-[12px] text-fg-subtle">
          <FieldError>{state.fieldErrors?.idea ? tHero("errorEmpty") : null}</FieldError>
          <span className="tabular-nums ml-auto">{idea.length} / 8000</span>
        </div>
      </div>

      {state.error && (
        <p className="text-[13px] text-danger" role="alert">
          {state.error}
        </p>
      )}

      <Button type="submit" size="lg" loading={pending}>
        {t("submit")}
      </Button>
    </form>
  );
}
