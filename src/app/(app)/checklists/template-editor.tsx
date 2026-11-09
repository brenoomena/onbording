"use client";

import { ArrowDown, ArrowUp, Plus, Send, Trash2 } from "lucide-react";
import { useState } from "react";
import { AudienceEditor } from "@/components/audience-editor";
import { ActionForm, FormBar, SubmitButton } from "@/components/forms";
import { Card, Field, Input, Select, Textarea, cx } from "@/components/ui";
import { OFFSET_PRESETS, RESPONSIBLE_HINT, RESPONSIBLE_LABEL, offsetLabel, type ResponsibleKind, type TemplateItem } from "@/lib/checklist";
import type { AudienceRule } from "@/lib/learning";
import type { Structure } from "@/lib/queries";
import { saveTemplate } from "./actions";

const EMPTY: TemplateItem = { title: "", description: "", responsibleKind: "rh", responsibleId: "", offsetDays: 0 };

const SUGGESTIONS: TemplateItem[] = [
  { title: "Criar e-mail e acessos aos sistemas", description: "", responsibleKind: "pessoa", responsibleId: "", offsetDays: -3 },
  { title: "Preparar estação de trabalho e equipamentos", description: "", responsibleKind: "pessoa", responsibleId: "", offsetDays: -1 },
  { title: "Entregar crachá e kit de boas-vindas", description: "", responsibleKind: "rh", responsibleId: "", offsetDays: 0 },
  { title: "Conversa de boas-vindas com o supervisor", description: "", responsibleKind: "supervisor", responsibleId: "", offsetDays: 0 },
  { title: "Assinar documentos e políticas internas", description: "", responsibleKind: "colaborador", responsibleId: "", offsetDays: 1 },
  { title: "Conversa de acompanhamento de 30 dias", description: "", responsibleKind: "supervisor", responsibleId: "", offsetDays: 30 },
];

export interface TemplateDraft {
  id?: string;
  name: string;
  description: string;
  auto_apply: boolean;
  status: "rascunho" | "publicado" | "arquivado";
  items: TemplateItem[];
}

/** Editor do modelo: dados, público e a lista de tarefas com responsável e prazo. */
export function TemplateEditor({
  draft,
  rules,
  structure,
  people,
}: {
  draft?: TemplateDraft;
  rules: AudienceRule[];
  structure: Structure;
  people: { id: string; full_name: string }[];
}) {
  const [items, setItems] = useState<TemplateItem[]>(draft?.items.length ? draft.items : [{ ...EMPTY }]);
  const update = (i: number, patch: Partial<TemplateItem>) => setItems((xs) => xs.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const move = (i: number, d: -1 | 1) =>
    setItems((xs) => {
      const next = xs.slice();
      const [it] = next.splice(i, 1);
      next.splice(i + d, 0, it);
      return next;
    });
  const published = draft?.status === "publicado";

  return (
    <ActionForm action={saveTemplate}>
      <FormBar info={published ? "Publicado: alterações valem para os próximos checklists." : "Rascunho: ainda não é aplicado a ninguém."}>
        <SubmitButton name="intent" value="salvar" variant="secondary" pendingLabel="Salvando…">
          {published ? "Salvar alterações" : "Salvar rascunho"}
        </SubmitButton>
        {!published && (
          <SubmitButton name="intent" value="publicar" pendingLabel="Publicando…">
            <Send size={15} aria-hidden /> Salvar e publicar
          </SubmitButton>
        )}
      </FormBar>
      {draft?.id && <input type="hidden" name="id" value={draft.id} />}
      <input type="hidden" name="items" value={JSON.stringify(items)} />

      <Card title="Dados do modelo">
        <div className="grid gap-4">
          <Field label="Nome" htmlFor="name">
            <Input id="name" name="name" defaultValue={draft?.name} required minLength={3} maxLength={120} placeholder="Ex.: Integração Comercial" />
          </Field>
          <Field label="Descrição (opcional)" htmlFor="description">
            <Textarea id="description" name="description" rows={2} defaultValue={draft?.description} maxLength={1000} placeholder="Para quem é e o que cobre." />
          </Field>
          <label className="flex items-start gap-3 rounded-xl border border-line px-4 py-3">
            <input type="checkbox" name="auto_apply" defaultChecked={draft?.auto_apply ?? true} className="mt-0.5 h-[18px] w-[18px] accent-[rgb(var(--brand))]" />
            <span>
              <span className="font-medium text-heading">Aplicar automaticamente</span>
              <span className="block text-[12.5px] text-muted">
                Quem for cadastrado em onboarding e atender ao público abaixo recebe o checklist sozinho. Sem isso, o RH aplica no cadastro da pessoa.
              </span>
            </span>
          </label>
        </div>
      </Card>

      <Card title="Público" description="Combine área, cargo e nível. Sem regra, vale para todas as pessoas em onboarding.">
        <AudienceEditor structure={structure} initial={rules} emptyHint="Sem regra: o modelo vale para todas as pessoas em onboarding." />
      </Card>

      <Card
        title={`Tarefas · ${items.length}`}
        description="Cada tarefa tem um responsável e um prazo contado a partir da data de admissão (sem admissão, do início do onboarding)."
      >
        <ol className="grid gap-3">
          {items.map((it, i) => (
            <li key={i} className="rounded-xl border border-line p-3.5">
              <div className="mb-3 flex items-center justify-between gap-2">
                <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted">Tarefa {i + 1}</span>
                <div className="flex items-center gap-1">
                  <button type="button" disabled={i === 0} onClick={() => move(i, -1)} aria-label={`Subir a tarefa ${i + 1}`} className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-sunken disabled:opacity-30">
                    <ArrowUp size={15} aria-hidden />
                  </button>
                  <button type="button" disabled={i === items.length - 1} onClick={() => move(i, 1)} aria-label={`Descer a tarefa ${i + 1}`} className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-sunken disabled:opacity-30">
                    <ArrowDown size={15} aria-hidden />
                  </button>
                  <button type="button" onClick={() => setItems((xs) => xs.filter((_, j) => j !== i))} aria-label={`Remover a tarefa ${i + 1}`} className="grid h-8 w-8 place-items-center rounded-lg text-danger hover:bg-danger-soft">
                    <Trash2 size={15} aria-hidden />
                  </button>
                </div>
              </div>
              <div className="grid gap-3 lg:grid-cols-2">
                <Field label="O que precisa ser feito" htmlFor={`it-t-${i}`}>
                  <Input id={`it-t-${i}`} value={it.title} onChange={(e) => update(i, { title: e.target.value })} maxLength={160} placeholder="Ex.: Entregar crachá" />
                </Field>
                <Field label="Detalhes (opcional)" htmlFor={`it-d-${i}`}>
                  <Input id={`it-d-${i}`} value={it.description} onChange={(e) => update(i, { description: e.target.value })} maxLength={1000} placeholder="Onde, como ou com quem" />
                </Field>
                <Field label="Responsável" htmlFor={`it-k-${i}`} hint={RESPONSIBLE_HINT[it.responsibleKind]}>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Select id={`it-k-${i}`} value={it.responsibleKind} onChange={(e) => update(i, { responsibleKind: e.target.value as ResponsibleKind })}>
                      {(Object.keys(RESPONSIBLE_LABEL) as ResponsibleKind[]).map((k) => (
                        <option key={k} value={k}>
                          {RESPONSIBLE_LABEL[k]}
                        </option>
                      ))}
                    </Select>
                    {it.responsibleKind === "pessoa" && (
                      <Select aria-label={`Pessoa responsável pela tarefa ${i + 1}`} value={it.responsibleId} onChange={(e) => update(i, { responsibleId: e.target.value })}>
                        <option value="">Escolha a pessoa…</option>
                        {people.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.full_name}
                          </option>
                        ))}
                      </Select>
                    )}
                  </div>
                </Field>
                <Field label="Prazo" htmlFor={`it-o-${i}`} hint={offsetLabel(it.offsetDays)}>
                  <div className="flex flex-wrap items-center gap-2">
                    <Select
                      id={`it-o-${i}`}
                      value={(OFFSET_PRESETS as readonly number[]).includes(it.offsetDays) ? String(it.offsetDays) : "outro"}
                      onChange={(e) => e.target.value !== "outro" && update(i, { offsetDays: Number(e.target.value) })}
                      className="min-w-[210px] flex-1"
                    >
                      {OFFSET_PRESETS.map((d) => (
                        <option key={d} value={d}>
                          {offsetLabel(d)}
                        </option>
                      ))}
                      <option value="outro">Outro…</option>
                    </Select>
                    <span className="flex items-center gap-1.5 text-[12.5px] text-muted">
                      <input
                        type="number"
                        aria-label={`Dias em relação à admissão, tarefa ${i + 1}`}
                        value={it.offsetDays}
                        min={-90}
                        max={365}
                        onChange={(e) => update(i, { offsetDays: Math.trunc(Number(e.target.value) || 0) })}
                        className="h-10 w-20 rounded-lg border border-line bg-surface px-2 text-[14px]"
                      />
                      dias
                    </span>
                  </div>
                </Field>
              </div>
            </li>
          ))}
        </ol>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" onClick={() => setItems((xs) => [...xs, { ...EMPTY }])} className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-dashed border-line px-3 text-[13px] font-semibold text-accent hover:border-accent">
            <Plus size={15} aria-hidden /> Nova tarefa
          </button>
          {SUGGESTIONS.filter((s) => !items.some((x) => x.title === s.title)).slice(0, 4).map((s) => (
            <button
              key={s.title}
              type="button"
              onClick={() => setItems((xs) => [...xs.filter((x) => x.title.trim()), { ...s }])}
              className={cx("inline-flex min-h-[40px] items-center gap-1.5 rounded-lg bg-sunken px-3 text-[12.5px] text-ink hover:bg-accent-soft")}
            >
              <Plus size={13} aria-hidden /> {s.title}
            </button>
          ))}
        </div>
      </Card>
    </ActionForm>
  );
}
