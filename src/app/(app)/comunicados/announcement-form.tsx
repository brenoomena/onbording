"use client";

import { Send } from "lucide-react";
import { AudienceEditor } from "@/components/audience-editor";
import { ActionForm, FormBar, SubmitButton } from "@/components/forms";
import { RichTextarea } from "@/components/rich-textarea";
import { Field, Input, cx } from "@/components/ui";
import type { AudienceRule } from "@/lib/learning";
import type { Structure } from "@/lib/queries";
import { saveAnnouncement } from "./actions";

export interface AnnouncementDraft {
  id: string;
  title: string;
  body: string;
  importance: "normal" | "importante";
}

export function AnnouncementForm({ draft, rules, structure }: { draft?: AnnouncementDraft; rules: AudienceRule[]; structure: Structure }) {
  return (
    <ActionForm action={saveAnnouncement}>
      {(state) => {
        const e = state.fieldErrors ?? {};
        return (
          <>
            <FormBar info="Rascunho: só quem gerencia comunicados vê. Ao publicar, cada pessoa do público recebe um aviso.">
              <SubmitButton name="intent" value="rascunho" variant="secondary" pendingLabel="Salvando…">
                Salvar rascunho
              </SubmitButton>
              <SubmitButton name="intent" value="publicar" pendingLabel="Publicando…">
                <Send size={15} aria-hidden /> Publicar e enviar
              </SubmitButton>
            </FormBar>
            {draft && <input type="hidden" name="id" value={draft.id} />}
            <Field label="Título" htmlFor="title" error={e.title}>
              <Input id="title" name="title" defaultValue={draft?.title} required minLength={3} maxLength={140} placeholder="Ex.: Nova trilha de produtos disponível" />
            </Field>
            <Field label="Mensagem" htmlFor="body" error={e.body} hint="Use a barra para títulos, listas e links.">
              <RichTextarea id="body" name="body" rows={8} defaultValue={draft?.body ?? ""} maxLength={10000} />
            </Field>
            <fieldset className="grid gap-2">
              <legend className="mb-1 text-[13px] font-medium">Importância</legend>
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    ["normal", "Normal", "Aparece no sininho e em Comunicados."],
                    ["importante", "Importante", "Também fica em destaque no Painel até ser lido."],
                  ] as const
                ).map(([k, label, hint]) => (
                  <label key={k} className="flex max-w-[280px] cursor-pointer items-start gap-2.5 rounded-lg border border-line px-3 py-2 text-[13.5px] has-[:checked]:border-brand has-[:checked]:bg-accent-soft/60">
                    <input type="radio" name="importance" value={k} defaultChecked={(draft?.importance ?? "normal") === k} className={cx("mt-1 h-4 w-4 accent-[rgb(var(--brand))]")} />
                    <span>
                      <span className="font-medium">{label}</span>
                      <span className="block text-[12px] text-muted">{hint}</span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
            <fieldset className="grid gap-3 rounded-xl border border-line p-4">
              <legend className="px-1 text-[13px] font-semibold">Público</legend>
              <AudienceEditor structure={structure} initial={rules} emptyHint="Sem regra, o comunicado vai para todas as pessoas ativas. Adicione regras para limitar por área, cargo ou nível." />
            </fieldset>
          </>
        );
      }}
    </ActionForm>
  );
}
