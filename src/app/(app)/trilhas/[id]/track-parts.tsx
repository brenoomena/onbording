"use client";

import { FilePlus2, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { ActionForm, SubmitButton } from "@/components/forms";
import { RichTextarea } from "@/components/rich-textarea";
import { AfterOk, useTabs } from "@/components/tabs";
import { Field, Input, Select, buttonVariants, cx } from "@/components/ui";
import type { ActionState } from "@/lib/action-state";
import { addItem, addModule } from "../actions";

/** Botão do módulo: abre a aba "Novo conteúdo" já com este módulo escolhido. */
export function NewContentButton({ moduleId, compact = false }: { moduleId?: string; compact?: boolean }) {
  const tabs = useTabs();
  if (!tabs) return null;
  return (
    <button
      type="button"
      onClick={() => tabs.go("conteudo", moduleId ? { moduleId } : undefined)}
      className={cx(compact ? buttonVariants.ghost : buttonVariants.secondary, "py-1.5 text-[13px]")}
    >
      <FilePlus2 size={15} aria-hidden /> Cadastrar conteúdo {moduleId ? "neste módulo" : "nesta trilha"}
    </button>
  );
}

/** Aba "Novo módulo". */
export function NewModuleForm({ trackId }: { trackId: string }) {
  return (
    <ActionForm action={addModule}>
      {(state) => (
        <>
          <AfterOk state={state} from="modulo" />
          <input type="hidden" name="track_id" value={trackId} />
          <Field label="Nome do módulo" htmlFor="new-mod-title" error={state.fieldErrors?.title}>
            <Input id="new-mod-title" name="title" required minLength={2} maxLength={120} placeholder="Ex.: Boas-vindas" />
          </Field>
          <Field label="Descrição (opcional)" htmlFor="new-mod-desc" hint="Aparece para o colaborador no início do módulo.">
            <RichTextarea id="new-mod-desc" name="description" rows={3} maxLength={1000} />
          </Field>
          <div className="flex justify-end">
            <SubmitButton pendingLabel="Criando…">
              <Plus size={16} aria-hidden /> Criar módulo
            </SubmitButton>
          </div>
        </>
      )}
    </ActionForm>
  );
}

/**
 * Conteúdo da trilha que ainda não está em nenhum módulo: escolhe o módulo
 * e inclui (ex.: conteúdo que veio de outra trilha pelo "Mover de trilha").
 */
export function PlaceContent({
  trackId,
  contentId,
  modules,
}: {
  trackId: string;
  contentId: string;
  modules: { id: string; title: string }[];
}) {
  const tabs = useTabs();
  const router = useRouter();
  // A linha some quando o conteúdo entra no módulo: o aviso vai para as abas.
  const action = async (state: ActionState, fd: FormData) => {
    const res = await addItem(state, fd);
    if (res.ok && tabs) {
      tabs.notify(res.ok);
      router.refresh();
      return {};
    }
    return res;
  };
  return (
    <ActionForm action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="track_id" value={trackId} />
      <input type="hidden" name="content_id" value={contentId} />
      <input type="hidden" name="is_required" value="on" />
      <Select name="module_id" aria-label="Módulo" defaultValue={modules[0]?.id} className="w-auto min-w-[180px] py-1.5 text-[13px]">
        {modules.map((m, i) => (
          <option key={m.id} value={m.id}>
            Módulo {i + 1}: {m.title}
          </option>
        ))}
      </Select>
      <SubmitButton variant="secondary" className="py-1.5 text-[13px]" pendingLabel="…">
        <Plus size={15} aria-hidden /> Incluir
      </SubmitButton>
    </ActionForm>
  );
}

/**
 * Campos extras do formulário de conteúdo quando ele é criado dentro da
 * trilha: em qual módulo entra e se é obrigatório.
 */
export function ModulePicker({ modules }: { modules: { id: string; title: string }[] }) {
  const tabs = useTabs();
  const preset = tabs?.data.moduleId;
  return (
    <div className="grid gap-3 rounded-xl border border-accent/25 bg-accent-soft/50 p-3.5 sm:grid-cols-[1fr_auto] sm:items-end">
      <Field
        label="Incluir no módulo"
        htmlFor="module_id"
        hint={modules.length ? "Ao criar, o conteúdo já entra no fim deste módulo." : "A trilha ainda não tem módulos: crie um na aba Novo módulo, ou inclua depois."}
      >
        <Select id="module_id" name="module_id" key={preset ?? "none"} defaultValue={preset ?? modules[modules.length - 1]?.id ?? ""}>
          <option value="">Não incluir agora</option>
          {modules.map((m, i) => (
            <option key={m.id} value={m.id}>
              Módulo {i + 1}: {m.title}
            </option>
          ))}
        </Select>
      </Field>
      <label className="flex items-center gap-2 pb-2.5 text-[13px]">
        <input type="checkbox" name="module_required" defaultChecked className="h-4 w-4 accent-[rgb(var(--brand))]" /> Obrigatório
      </label>
    </div>
  );
}
