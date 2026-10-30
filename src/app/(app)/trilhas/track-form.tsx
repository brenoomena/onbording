"use client";

import { AudienceEditor } from "@/components/audience-editor";
import { ActionForm, SubmitButton, FormBar } from "@/components/forms";
import { Field, Input, Select } from "@/components/ui";
import { RichTextarea } from "@/components/rich-textarea";
import type { ActionState } from "@/lib/action-state";
import type { AudienceRule, TrackRow } from "@/lib/learning";
import type { Structure } from "@/lib/queries";

export function TrackForm({
  action,
  track,
  rules,
  structure,
}: {
  action: (s: ActionState, fd: FormData) => Promise<ActionState>;
  track?: TrackRow;
  rules: AudienceRule[];
  structure: Structure;
}) {
  return (
    <ActionForm action={action}>
      {(state) => {
        const e = state.fieldErrors ?? {};
        return (
          <>
            <FormBar info={track ? "Alterações na trilha" : "Nova trilha (começa como rascunho)"}>
              <SubmitButton>{track ? "Salvar trilha" : "Criar trilha"}</SubmitButton>
            </FormBar>
            {track && <input type="hidden" name="id" value={track.id} />}
            <Field label="Nome da trilha" htmlFor="name" error={e.name}>
              <Input id="name" name="name" defaultValue={track?.name} required minLength={3} maxLength={120} />
            </Field>
            <Field label="Descrição" htmlFor="description" error={e.description}>
              <RichTextarea id="description" name="description" rows={3} defaultValue={track?.description ?? ""} maxLength={2000} />
            </Field>
            <Field label="Objetivo de aprendizagem" htmlFor="objective" error={e.objective}>
              <RichTextarea id="objective" name="objective" rows={3} defaultValue={track?.objective ?? ""} maxLength={2000} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Nível recomendado" htmlFor="recommended_level_id">
                <Select id="recommended_level_id" name="recommended_level_id" defaultValue={track?.recommended_level_id ?? ""}>
                  <option value="">Qualquer nível</option>
                  {structure.levels.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                </Select>
              </Field>
              <Field label="Prazo de conclusão (dias)" htmlFor="deadline_days" hint="Contado a partir da matrícula ou do início do onboarding." error={e.deadline_days}>
                <Input id="deadline_days" name="deadline_days" type="number" min={1} max={365} defaultValue={track?.deadline_days ?? ""} />
              </Field>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex items-start gap-3 rounded-lg border border-line p-3 text-[14px]">
                <input type="checkbox" name="is_mandatory" defaultChecked={track?.is_mandatory ?? false} className="mt-1 h-4 w-4 accent-[rgb(var(--brand))]" />
                <span>
                  Obrigatória
                  <span className="block text-[12.5px] text-muted">Matricula automaticamente quem é do público, inclusive quem entrar depois.</span>
                </span>
              </label>
              <label className="flex items-start gap-3 rounded-lg border border-line p-3 text-[14px]">
                <input type="checkbox" name="is_sequential" defaultChecked={track?.is_sequential ?? true} className="mt-1 h-4 w-4 accent-[rgb(var(--brand))]" />
                <span>
                  Em sequência
                  <span className="block text-[12.5px] text-muted">Cada etapa obrigatória libera a próxima.</span>
                </span>
              </label>
            </div>
            <fieldset className="grid gap-3">
              <legend className="mb-1 text-[13px] font-semibold">Público-alvo</legend>
              <Field label="Descrição do público" htmlFor="audience_note">
                <Input id="audience_note" name="audience_note" defaultValue={track?.audience_note ?? ""} maxLength={300} placeholder="Ex.: Vendedores recém-contratados" />
              </Field>
              <AudienceEditor
                structure={structure}
                initial={rules}
                emptyHint="Sem público definido, a trilha só chega a quem for matriculado manualmente."
              />
            </fieldset>
          </>
        );
      }}
    </ActionForm>
  );
}
