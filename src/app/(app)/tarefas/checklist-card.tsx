import { ClipboardList, Plus, Trash2 } from "lucide-react";
import { ActionButton, ActionForm, SubmitButton } from "@/components/forms";
import { Card, Field, Input, Select, formatDate } from "@/components/ui";
import type { CurrentUser } from "@/lib/auth";
import { RESPONSIBLE_LABEL, todaySP } from "@/lib/checklist";
import { P } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { loadTasks } from "@/lib/tasks-server";
import { addTask, applyChecklist, removeChecklist } from "./actions";
import { TaskRow } from "./task-row";

/** Cadastro do colaborador: checklists de integração dele, com as tarefas. */
export async function ChecklistCard({ profileId, personName, me }: { profileId: string; personName: string; me: CurrentUser }) {
  const rh = me.permissions.has(P.checklistsGerenciar);
  const supabase = await createClient();
  const [{ data: lists }, tasks, templates, people] = await Promise.all([
    supabase.from("onboarding_checklists").select("id, name, template_id, origin, applied_at, completed_at").eq("profile_id", profileId).order("applied_at"),
    loadTasks({ profileId }),
    rh ? supabase.from("checklist_templates").select("id, name, status").neq("status", "arquivado").order("name") : Promise.resolve({ data: [] }),
    rh ? supabase.from("profiles").select("id, full_name").neq("status", "inativo").order("full_name") : Promise.resolve({ data: [] }),
  ]);
  const checklists = (lists ?? []) as { id: string; name: string; template_id: string | null; origin: string; applied_at: string; completed_at: string | null }[];
  const today = todaySP();
  const applied = new Set(checklists.map((c) => c.template_id));
  const options = ((templates.data ?? []) as { id: string; name: string; status: string }[]).filter((t) => !applied.has(t.id));
  const persons = (people.data ?? []) as { id: string; full_name: string }[];

  if (!rh && checklists.length === 0) return null;

  return (
    <Card
      title="Checklist de integração"
      description={checklists.length ? undefined : "Nenhum checklist aplicado ainda."}
      icon={ClipboardList}
      flush
      actions={
        rh && options.length > 0 ? (
          <ActionForm action={applyChecklist} className="flex flex-wrap items-end gap-2">
            <input type="hidden" name="profile_id" value={profileId} />
            <label className="sr-only" htmlFor="apply-tpl">
              Modelo de checklist
            </label>
            <Select id="apply-tpl" name="template_id" defaultValue="" required className="h-9 min-w-[200px] text-[13px]">
              <option value="" disabled>
                Aplicar um modelo…
              </option>
              {options.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                  {t.status === "rascunho" ? " (rascunho)" : ""}
                </option>
              ))}
            </Select>
            <SubmitButton variant="secondary" className="h-9 py-0 text-[13px]">
              Aplicar
            </SubmitButton>
          </ActionForm>
        ) : undefined
      }
    >
      {checklists.map((c) => {
        const rows = tasks.filter((t) => t.checklist_id === c.id).sort((a, b) => a.position - b.position);
        const done = rows.filter((t) => t.done_at).length;
        return (
          <section key={c.id} className="border-t border-line first:border-t-0" aria-label={c.name}>
            <div className="flex flex-wrap items-center gap-3 px-5 py-3">
              <div className="min-w-0 flex-1">
                <h3 className="text-[14.5px] font-semibold text-heading">{c.name}</h3>
                <p className="text-[12px] text-muted">
                  {done} de {rows.length} feitas · {c.origin === "automatica" ? "aplicado automaticamente" : "aplicado manualmente"} em {formatDate(c.applied_at)}
                  {c.completed_at && ` · concluído em ${formatDate(c.completed_at)}`}
                </p>
                <div className="mt-2 h-1.5 max-w-sm overflow-hidden rounded-full bg-sunken">
                  <div className="h-full rounded-full bg-ok" style={{ width: `${rows.length ? Math.round((done / rows.length) * 100) : 0}%` }} />
                </div>
              </div>
              {rh && (
                <ActionButton
                  action={removeChecklist}
                  hidden={{ id: c.id }}
                  label="Remover checklist"
                  variant="danger"
                  icon={<Trash2 size={15} aria-hidden />}
                  iconOnly
                  confirm
                  confirmLabel="Remover"
                  confirmText={`O checklist “${c.name}” e todas as tarefas dele saem do cadastro de ${personName}.`}
                />
              )}
            </div>
            <ul className="divide-y divide-line border-t border-line">
              {rows.map((t) => (
                <TaskRow key={t.id} t={t} me={me} today={today} showPerson={false} />
              ))}
            </ul>
            {rh && (
              <details className="border-t border-line">
                <summary className="flex cursor-pointer list-none items-center gap-1.5 px-5 py-2.5 text-[13px] font-semibold text-accent hover:underline">
                  <Plus size={15} aria-hidden /> Incluir tarefa neste checklist
                </summary>
                <ActionForm action={addTask} className="grid gap-3 px-5 pb-4 sm:grid-cols-2">
                  <input type="hidden" name="checklist_id" value={c.id} />
                  <input type="hidden" name="profile_id" value={profileId} />
                  <Field label="Tarefa" htmlFor={`nt-${c.id}`}>
                    <Input id={`nt-${c.id}`} name="title" required minLength={2} maxLength={160} placeholder="Ex.: Liberar acesso à VPN" />
                  </Field>
                  <Field label="Prazo" htmlFor={`nd-${c.id}`}>
                    <Input id={`nd-${c.id}`} name="due_date" type="date" />
                  </Field>
                  <Field label="Responsável" htmlFor={`nk-${c.id}`}>
                    <Select id={`nk-${c.id}`} name="responsible_kind" defaultValue="rh">
                      {(["rh", "supervisor", "colaborador", "pessoa"] as const).map((k) => (
                        <option key={k} value={k}>
                          {k === "colaborador" ? personName : RESPONSIBLE_LABEL[k]}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Pessoa (se for pessoa específica)" htmlFor={`np-${c.id}`}>
                    <Select id={`np-${c.id}`} name="responsible_id" defaultValue="">
                      <option value="">—</option>
                      {persons.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.full_name}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <div className="sm:col-span-2">
                    <SubmitButton>Incluir tarefa</SubmitButton>
                  </div>
                </ActionForm>
              </details>
            )}
          </section>
        );
      })}
      {checklists.length === 0 && rh && (
        <p className="px-5 pb-4 text-[13px] text-muted">
          {options.length ? "Escolha um modelo acima para criar o checklist desta pessoa." : "Crie um modelo em Checklists para aplicar aqui."}
        </p>
      )}
    </Card>
  );
}
