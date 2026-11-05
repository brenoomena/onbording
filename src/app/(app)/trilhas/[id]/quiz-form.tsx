"use client";

import { ClipboardCheck, Flag, Layers3 } from "lucide-react";
import { useEffect, useState } from "react";
import { ActionForm } from "@/components/forms";
import { RichTextarea } from "@/components/rich-textarea";
import { AfterOk, useTabs } from "@/components/tabs";
import { Field, Input, Select, buttonVariants, cx } from "@/components/ui";
import type { ActionState } from "@/lib/action-state";
import { PublishBar } from "../../conteudos/content-form";
import { QuizEditor } from "../../conteudos/quiz-editor";

type Posicao = "fim_trilha" | "modulo";

/** Botão do módulo: abre a aba "Nova avaliação" já no fim deste módulo. */
export function NewQuizButton({ moduleId }: { moduleId: string }) {
  const tabs = useTabs();
  if (!tabs) return null;
  return (
    <button type="button" onClick={() => tabs.go("avaliacao", { moduleId })} className={cx(buttonVariants.ghost, "py-1.5 text-[13px]")}>
      <ClipboardCheck size={15} aria-hidden /> Avaliação no fim deste módulo
    </button>
  );
}

/**
 * Aba "Nova avaliação" da trilha: onde a prova entra (fim da trilha ou fim
 * de um módulo), dados básicos e as perguntas.
 */
export function NewQuizForm({
  action,
  trackId,
  modules,
}: {
  action: (s: ActionState, fd: FormData) => Promise<ActionState>;
  trackId: string;
  modules: { id: string; title: string }[];
}) {
  const tabs = useTabs();
  const preset = tabs?.data.moduleId;
  const [posicao, setPosicao] = useState<Posicao>(preset ? "modulo" : "fim_trilha");
  const [moduleId, setModuleId] = useState(preset ?? modules[modules.length - 1]?.id ?? "");
  // Aberta pelo botão de um módulo: já vem no fim dele.
  useEffect(() => {
    if (preset) {
      setPosicao("modulo");
      setModuleId(preset);
    }
  }, [preset]);

  const option = (value: Posicao, title: string, text: string, Icon: typeof Flag, disabled = false) => (
    <label
      className={cx(
        "flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition-colors",
        posicao === value ? "border-brand bg-accent-soft/60" : "border-line bg-surface hover:border-accent/40",
        disabled && "cursor-not-allowed opacity-60",
      )}
    >
      <input
        type="radio"
        name="posicao"
        value={value}
        checked={posicao === value}
        onChange={() => setPosicao(value)}
        disabled={disabled}
        className="mt-1 h-4 w-4 accent-[rgb(var(--brand))]"
      />
      <span className="grid gap-0.5">
        <span className="flex items-center gap-1.5 text-[14px] font-medium text-heading">
          <Icon size={15} aria-hidden className="text-icon" /> {title}
        </span>
        <span className="text-[12.5px] text-muted">{text}</span>
      </span>
    </label>
  );

  return (
    <ActionForm action={action}>
      {(state) => {
        const e = state.fieldErrors ?? {};
        return (
          <>
            <AfterOk state={state} from="avaliacao" />
            <PublishBar isNew />
            <input type="hidden" name="em_trilha" value="1" />
            <input type="hidden" name="track_id" value={trackId} />
            <input type="hidden" name="kind" value="avaliacao" />

            <fieldset className="grid gap-2">
              <legend className="mb-1.5 text-[13px] font-medium">Onde a avaliação entra</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {option("fim_trilha", "No fim da trilha", "Fica num módulo final, \"Avaliação final\", depois de todos os módulos.", Flag)}
                {option(
                  "modulo",
                  "No fim de um módulo",
                  modules.length ? "Fecha o módulo escolhido: entra depois dos conteúdos dele." : "A trilha ainda não tem módulos.",
                  Layers3,
                  modules.length === 0,
                )}
              </div>
              {posicao === "modulo" && (
                <Field label="Módulo" htmlFor="aval-module">
                  <Select id="aval-module" name="module_id" value={moduleId} onChange={(ev) => setModuleId(ev.target.value)} required>
                    {modules.map((m, i) => (
                      <option key={m.id} value={m.id}>
                        Módulo {i + 1}: {m.title}
                      </option>
                    ))}
                  </Select>
                </Field>
              )}
              <label className="flex items-center gap-2 text-[13px]">
                <input type="checkbox" name="module_required" defaultChecked className="h-4 w-4 accent-[rgb(var(--brand))]" />
                Obrigatória: a pessoa precisa ser aprovada para concluir a trilha
              </label>
              {e.module_id && <p className="text-[12px] text-danger">{e.module_id}</p>}
            </fieldset>

            <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
              <Field label="Título" htmlFor="aval-title" error={e.title}>
                <Input id="aval-title" name="title" required minLength={3} maxLength={160} placeholder="Ex.: Avaliação do módulo de produtos" />
              </Field>
              <Field label="Tempo estimado (min)" htmlFor="aval-minutes" error={e.estimated_minutes}>
                <Input id="aval-minutes" name="estimated_minutes" type="number" min={1} max={1440} />
              </Field>
            </div>
            <Field label="Orientações (opcional)" htmlFor="aval-objective" hint="Aparece no topo da prova. Ex.: o que vai ser cobrado e como a nota funciona." error={e.objective}>
              <RichTextarea id="aval-objective" name="objective" rows={3} maxLength={4000} />
            </Field>

            <QuizEditor initial={[]} passingScore={70} maxAttempts={null} error={e.quiz ?? e.passing_score ?? e.max_attempts} idPrefix="aval-" />
          </>
        );
      }}
    </ActionForm>
  );
}
