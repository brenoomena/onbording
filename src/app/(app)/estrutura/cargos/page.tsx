import type { Metadata } from "next";
import { ActionButton, ActionForm, SubmitButton } from "@/components/forms";
import { Badge, Card, EmptyState, Field, Input, PageHeader, Select, Textarea } from "@/components/ui";
import { requirePermission } from "@/lib/auth";
import { P } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import type { Area, Level } from "@/lib/types";
import { removeItem, savePosition, toggleActive } from "../actions";
import { InlineEditor } from "../item-editor";

export const metadata: Metadata = { title: "Cargos" };

interface PositionRow {
  id: string;
  name: string;
  area_id: string;
  description: string | null;
  active: boolean;
  position_levels: { level_id: string }[];
  profiles: { count: number }[];
}

function PositionFields({ position, areas, levels }: { position?: PositionRow; areas: Area[]; levels: Level[] }) {
  const p = position?.id ?? "novo";
  const selected = new Set(position?.position_levels.map((l) => l.level_id) ?? levels.map((l) => l.id));
  return (
    <>
      {position && <input type="hidden" name="id" value={position.id} />}
      <Field label="Nome do cargo" htmlFor={`name-${p}`}>
        <Input id={`name-${p}`} name="name" defaultValue={position?.name} required minLength={2} maxLength={80} />
      </Field>
      <Field label="Área" htmlFor={`area-${p}`}>
        <Select id={`area-${p}`} name="area_id" defaultValue={position?.area_id ?? ""} required>
          <option value="" disabled>Selecione</option>
          {areas.filter((a) => a.active || a.id === position?.area_id).map((a) => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </Select>
      </Field>
      <fieldset className="grid gap-2">
        <legend className="mb-1.5 text-[13px] font-medium">Níveis disponíveis para este cargo</legend>
        <div className="flex flex-wrap gap-2">
          {levels.map((l) => (
            <label key={l.id} className="flex cursor-pointer items-center gap-2 rounded-lg border border-line bg-surface px-3 py-1.5 text-[13px] has-[:checked]:border-brand has-[:checked]:bg-accent-soft">
              <input type="checkbox" name="level_ids" value={l.id} defaultChecked={selected.has(l.id)} className="accent-[rgb(var(--brand))]" />
              {l.name}
            </label>
          ))}
        </div>
      </fieldset>
      <Field label="Descrição" htmlFor={`desc-${p}`} hint="Opcional. Principais responsabilidades.">
        <Textarea id={`desc-${p}`} name="description" defaultValue={position?.description ?? ""} maxLength={300} />
      </Field>
    </>
  );
}

export default async function CargosPage() {
  await requirePermission(P.estruturaGerenciar);
  const supabase = await createClient();
  const [pos, ar, lv] = await Promise.all([
    supabase.from("positions").select("id, name, area_id, description, active, position_levels(level_id), profiles(count)").order("name"),
    supabase.from("areas").select("id, name, description, active").order("name"),
    supabase.from("levels").select("id, name, rank, description, active").order("rank"),
  ]);
  const positions = (pos.data ?? []) as PositionRow[];
  const areas = (ar.data ?? []) as Area[];
  const levels = (lv.data ?? []) as Level[];
  const levelName = new Map(levels.map((l) => [l.id, l]));

  return (
    <>
      <PageHeader
        eyebrow="Estrutura"
        title="Cargos"
        description="Cada cargo pertence a uma área e tem os níveis em que pode ser exercido. As competências obrigatórias por cargo e nível entram na Etapa 4."
      />
      <div className="grid items-start gap-6 lg:grid-cols-[1fr_340px]">
        <div className="grid gap-6">
          {areas.map((area) => {
            const list = positions.filter((p) => p.area_id === area.id);
            return (
              <section key={area.id} className="grid gap-3">
                <h2 className="flex items-center gap-2 text-[13px] font-semibold uppercase tracking-[0.05em] text-muted">
                  {area.name} {!area.active && <Badge>Área inativa</Badge>}
                  <span className="font-mono text-[11px] font-normal">{list.length}</span>
                </h2>
                {list.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-line px-4 py-3 text-[13px] text-muted">Nenhum cargo nesta área.</p>
                ) : (
                  list.map((p) => {
                    const people = p.profiles[0]?.count ?? 0;
                    const lv = p.position_levels
                      .map((x) => levelName.get(x.level_id))
                      .filter((x): x is Level => !!x)
                      .sort((a, b) => a.rank - b.rank);
                    return (
                      <div key={p.id} className="rounded-xl border border-line bg-surface p-4">
                        <InlineEditor
                          summary={
                            <div className="min-w-0 space-y-1.5">
                              <p className="flex flex-wrap items-center gap-2 font-semibold">
                                {p.name} {!p.active && <Badge>Inativo</Badge>}
                              </p>
                              <div className="flex flex-wrap items-center gap-1.5">
                                {lv.length ? lv.map((l) => <Badge key={l.id} tone="brand">{l.name}</Badge>) : <Badge tone="warn">Sem níveis</Badge>}
                                <span className="text-[12.5px] tabular-nums text-muted">· {people} {people === 1 ? "colaborador" : "colaboradores"}</span>
                              </div>
                            </div>
                          }
                        >
                          <div className="grid gap-4">
                            <ActionForm action={savePosition}>
                              <PositionFields position={p} areas={areas} levels={levels} />
                              <div><SubmitButton>Salvar cargo</SubmitButton></div>
                            </ActionForm>
                            <div className="flex flex-wrap justify-end gap-2 border-t border-line pt-3">
                              <ActionButton action={toggleActive} hidden={{ kind: "cargos", id: p.id, active: String(!p.active) }} label={p.active ? "Desativar" : "Reativar"} />
                              {people === 0 && (
                                <ActionButton action={removeItem} hidden={{ kind: "cargos", id: p.id }} label="Excluir" variant="danger" confirm confirmLabel="Excluir cargo" />
                              )}
                            </div>
                          </div>
                        </InlineEditor>
                      </div>
                    );
                  })
                )}
              </section>
            );
          })}
          {areas.length === 0 && <EmptyState title="Cadastre uma área primeiro">Todo cargo pertence a uma área.</EmptyState>}
        </div>
        <Card title="Novo cargo">
          {areas.some((a) => a.active) ? (
            <ActionForm action={savePosition} resetOnSuccess>
              <PositionFields areas={areas} levels={levels} />
              <div><SubmitButton>Criar cargo</SubmitButton></div>
            </ActionForm>
          ) : (
            <p className="text-[13px] text-muted">Não há áreas ativas.</p>
          )}
        </Card>
      </div>
    </>
  );
}
