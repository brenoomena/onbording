import { Building2, Plus, Trash2 } from "lucide-react";
import type { Metadata } from "next";
import { plainText } from "@/components/markdown";
import { ActionButton, ActionForm, SubmitButton } from "@/components/forms";
import { Badge, Card, EmptyState, Field, Input, PageHeader } from "@/components/ui";
import { RichTextarea } from "@/components/rich-textarea";
import { can, requirePermission } from "@/lib/auth";
import { ESTRUTURA_ANY, P } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { removeItem, saveArea, toggleActive } from "../actions";
import { InlineEditor } from "../item-editor";

export const metadata: Metadata = { title: "Áreas" };

interface AreaRow {
  id: string;
  name: string;
  description: string | null;
  active: boolean;
  positions: { count: number }[];
  profiles: { count: number }[];
}

function AreaFields({ area }: { area?: AreaRow }) {
  const p = area?.id ?? "nova";
  return (
    <>
      {area && <input type="hidden" name="id" value={area.id} />}
      <Field label="Nome" htmlFor={`name-${p}`}>
        <Input id={`name-${p}`} name="name" defaultValue={area?.name} required minLength={2} maxLength={80} />
      </Field>
      <Field label="Descrição" htmlFor={`desc-${p}`} hint="Opcional. Até 300 caracteres.">
        <RichTextarea id={`desc-${p}`} name="description" defaultValue={area?.description ?? ""} maxLength={600} />
      </Field>
    </>
  );
}

export default async function AreasPage() {
  const me = await requirePermission(...ESTRUTURA_ANY);
  const canCreate = can(me, P.estruturaCriar);
  const canEdit = can(me, P.estruturaEditar);
  const canDelete = can(me, P.estruturaExcluir);
  const supabase = await createClient();
  const { data } = await supabase.from("areas").select("id, name, description, active, positions(count), profiles(count)").order("name");
  const areas = (data ?? []) as AreaRow[];

  return (
    <>
      <PageHeader
        eyebrow="Estrutura"
        icon={Building2}
        title="Áreas de atuação"
        description="Cada colaborador pertence a uma área. Nas próximas etapas, trilhas e conteúdos serão liberados por área."
      />
      <div className={canCreate ? "grid items-start gap-6 lg:grid-cols-[1fr_320px]" : "grid items-start gap-6"}>
        <div className="grid gap-3">
          {areas.length === 0 ? (
            <EmptyState title="Nenhuma área cadastrada">Crie a primeira área ao lado.</EmptyState>
          ) : (
            areas.map((a) => {
              const positions = a.positions[0]?.count ?? 0;
              const people = a.profiles[0]?.count ?? 0;
              return (
                <div key={a.id} className="rounded-xl border border-line bg-surface p-4">
                  <InlineEditor
                    canEdit={canEdit}
                    actions={
                      canDelete && positions === 0 && people === 0 && (
                        <ActionButton
                          action={removeItem}
                          hidden={{ kind: "areas", id: a.id }}
                          label="Excluir"
                          variant="danger"
                          icon={<Trash2 size={16} aria-hidden />}
                          iconOnly
                          confirm
                          confirmLabel="Excluir área"
                          confirmText="O registro será apagado definitivamente. Só é possível porque não está em uso."
                        />
                      )
                    }
                    summary={
                      <div className="min-w-0">
                        <p className="flex flex-wrap items-center gap-2 font-semibold">
                          {a.name} {!a.active && <Badge>Inativa</Badge>}
                        </p>
                        <p className="text-[12.5px] tabular-nums text-muted">
                          {positions} {positions === 1 ? "cargo" : "cargos"} · {people} {people === 1 ? "colaborador" : "colaboradores"}
                          {a.description ? ` · ${plainText(a.description)}` : ""}
                        </p>
                      </div>
                    }
                  >
                    <div className="grid gap-4">
                      <ActionForm action={saveArea}>
                        <AreaFields area={a} />
                        <div><SubmitButton>Salvar área</SubmitButton></div>
                      </ActionForm>
                      <div className="flex flex-wrap justify-end gap-2 border-t border-line pt-3">
                        <ActionButton
                          action={toggleActive}
                          hidden={{ kind: "areas", id: a.id, active: String(!a.active) }}
                          label={a.active ? "Desativar" : "Reativar"}
                        />
                      </div>
                      {(positions > 0 || people > 0) && (
                        <p className="text-[12px] text-muted">Áreas com cargos ou colaboradores não podem ser excluídas. Desative para impedir novos vínculos.</p>
                      )}
                    </div>
                  </InlineEditor>
                </div>
              );
            })
          )}
        </div>
        {canCreate && (
        <Card icon={Plus} title="Nova área">
          <ActionForm action={saveArea} resetOnSuccess>
            <AreaFields />
            <div><SubmitButton>Criar área</SubmitButton></div>
          </ActionForm>
        </Card>
        )}
      </div>
    </>
  );
}
