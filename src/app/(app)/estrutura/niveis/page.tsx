import { ArrowDown, ArrowUp, Layers, Plus, Trash2 } from "lucide-react";
import type { Metadata } from "next";
import { plainText } from "@/components/markdown";
import { ActionButton, ActionForm, SubmitButton } from "@/components/forms";
import { Badge, Card, EmptyState, Field, Input, PageHeader, LevelBadge } from "@/components/ui";
import { RichTextarea } from "@/components/rich-textarea";
import { can, requirePermission } from "@/lib/auth";
import { ESTRUTURA_ANY, P } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { moveLevel, removeItem, saveLevel, toggleActive } from "../actions";
import { InlineEditor } from "../item-editor";

export const metadata: Metadata = { title: "Níveis" };

interface LevelRow {
  id: string;
  name: string;
  rank: number;
  description: string | null;
  active: boolean;
  profiles: { count: number }[];
  position_levels: { count: number }[];
}

function LevelFields({ level }: { level?: LevelRow }) {
  const p = level?.id ?? "novo";
  return (
    <>
      {level && <input type="hidden" name="id" value={level.id} />}
      <Field label="Nome" htmlFor={`name-${p}`}>
        <Input id={`name-${p}`} name="name" defaultValue={level?.name} required minLength={2} maxLength={60} />
      </Field>
      <Field label="Descrição" htmlFor={`desc-${p}`} hint="Opcional. O que se espera de quem está neste nível.">
        <RichTextarea id={`desc-${p}`} name="description" defaultValue={level?.description ?? ""} maxLength={600} />
      </Field>
    </>
  );
}

export default async function NiveisPage() {
  const me = await requirePermission(...ESTRUTURA_ANY);
  const canCreate = can(me, P.estruturaCriar);
  const canEdit = can(me, P.estruturaEditar);
  const canDelete = can(me, P.estruturaExcluir);
  const supabase = await createClient();
  const { data } = await supabase
    .from("levels")
    .select("id, name, rank, description, active, profiles(count), position_levels(count)")
    .order("rank");
  const levels = (data ?? []) as LevelRow[];

  return (
    <>
      <PageHeader
        eyebrow="Estrutura"
        icon={Layers}
        title="Níveis profissionais"
        description="A ordem define a hierarquia, do nível inicial ao mais experiente. Ela será usada para comparar competências com o próximo nível."
      />
      <div className={canCreate ? "grid items-start gap-6 lg:grid-cols-[1fr_320px]" : "grid items-start gap-6"}>
        {levels.length === 0 ? (
          <EmptyState title="Nenhum nível cadastrado">Crie o primeiro nível ao lado.</EmptyState>
        ) : (
          <ol className="grid gap-3">
            {levels.map((l, i) => {
              const people = l.profiles[0]?.count ?? 0;
              const positions = l.position_levels[0]?.count ?? 0;
              return (
                <li key={l.id} className="grid grid-cols-[auto_1fr] items-start gap-3 rounded-xl border border-line bg-surface p-4">
                  <div className="flex flex-col items-center gap-1">
                    <span className="grid h-8 w-8 place-items-center rounded-full bg-icon-bg font-mono text-[13px] font-semibold text-icon">
                      {i + 1}
                    </span>
                    <div className="flex flex-col">
                      {canEdit && i > 0 && (
                        <ActionButton action={moveLevel} hidden={{ id: l.id, direction: "-1" }} label="Subir nível" icon={<ArrowUp size={15} aria-hidden />} iconOnly />
                      )}
                      {canEdit && i < levels.length - 1 && (
                        <ActionButton action={moveLevel} hidden={{ id: l.id, direction: "1" }} label="Descer nível" icon={<ArrowDown size={15} aria-hidden />} iconOnly />
                      )}
                    </div>
                  </div>
                  <InlineEditor
                    canEdit={canEdit}
                    title={`Editar nível: ${l.name}`}
                    actions={
                      canDelete && people === 0 && positions === 0 && (
                        <ActionButton
                          action={removeItem}
                          hidden={{ kind: "niveis", id: l.id }}
                          label="Excluir"
                          variant="danger"
                          icon={<Trash2 size={16} aria-hidden />}
                          iconOnly
                          confirm
                          confirmLabel="Excluir nível"
                          confirmText="O registro será apagado definitivamente. Só é possível porque não está em uso."
                        />
                      )
                    }
                    summary={
                      <div className="min-w-0">
                        <p className="flex flex-wrap items-center gap-2 font-semibold">
                          <LevelBadge name={l.name} /> {!l.active && <Badge tone="silver">Inativo</Badge>}
                        </p>
                        <p className="text-[12.5px] tabular-nums text-muted">
                          Usado em {positions} {positions === 1 ? "cargo" : "cargos"} · {people} {people === 1 ? "colaborador" : "colaboradores"}
                        </p>
                        {l.description && <p className="mt-1 text-[13px] text-muted">{plainText(l.description)}</p>}
                      </div>
                    }
                  >
                    <div className="grid gap-4">
                      <ActionForm action={saveLevel}>
                        <LevelFields level={l} />
                        <div><SubmitButton>Salvar nível</SubmitButton></div>
                      </ActionForm>
                      <div className="flex flex-wrap justify-end gap-2 border-t border-line pt-3">
                        <ActionButton action={toggleActive} hidden={{ kind: "niveis", id: l.id, active: String(!l.active) }} label={l.active ? "Desativar" : "Reativar"} />
                      </div>
                    </div>
                  </InlineEditor>
                </li>
              );
            })}
          </ol>
        )}
        {canCreate && (
        <Card icon={Plus} title="Novo nível" description="Entra no topo da hierarquia. Use as setas para reposicionar.">
          <ActionForm action={saveLevel} resetOnSuccess>
            <LevelFields />
            <div><SubmitButton>Criar nível</SubmitButton></div>
          </ActionForm>
        </Card>
        )}
      </div>
    </>
  );
}
