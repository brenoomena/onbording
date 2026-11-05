"use client";

import { BadgeCheck, IdCard, ShieldCheck } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { ActionForm, SubmitButton, FormBar } from "@/components/forms";
import { Field, Input, Select } from "@/components/ui";
import type { ActionState } from "@/lib/action-state";
import type { PersonOption, Structure } from "@/lib/queries";
import { STATUS_LABEL, type UserStatus } from "@/lib/types";

export interface ProfileFormValues {
  id?: string;
  full_name?: string;
  email?: string;
  role_id?: string;
  area_id?: string | null;
  position_id?: string | null;
  level_id?: string | null;
  supervisor_id?: string | null;
  admission_date?: string | null;
  onboarding_start_date?: string | null;
  status?: UserStatus;
}

export function ProfileForm({
  action,
  structure,
  supervisors,
  values,
  canChangeRole,
  canDeactivate = true,
  mode,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  structure: Structure;
  supervisors: PersonOption[];
  values: ProfileFormValues;
  canChangeRole: boolean;
  /** Sem a permissão de desativar, a opção "Inativo" não aparece. */
  canDeactivate?: boolean;
  mode: "create" | "edit";
}) {
  const [areaId, setAreaId] = useState(values.area_id ?? "");
  const [positionId, setPositionId] = useState(values.position_id ?? "");
  const [levelId, setLevelId] = useState(values.level_id ?? "");

  const defaultRole = structure.roles.find((r) => r.key === "colaborador")?.id ?? "";
  const roleId = values.role_id ?? defaultRole;

  const activeAreas = structure.areas.filter((a) => a.active || a.id === values.area_id);
  const positions = useMemo(
    () => structure.positions.filter((p) => p.area_id === areaId && (p.active || p.id === values.position_id)),
    [structure.positions, areaId, values.position_id],
  );
  const allowedLevels = useMemo(() => {
    const pos = structure.positions.find((p) => p.id === positionId);
    if (!pos) return [];
    return structure.levels.filter((l) => pos.level_ids.includes(l.id) && (l.active || l.id === values.level_id));
  }, [structure, positionId, values.level_id]);

  const supervisorOptions = supervisors.filter((s) => s.id !== values.id);

  return (
    <ActionForm action={action}>
      {(state) => {
        const e = state.fieldErrors ?? {};
        return (
          <>
            <FormBar info={mode === "create" ? "Ao cadastrar, o acesso fica liberado para a conta Google deste e-mail." : "Cadastro do colaborador"}>
              <SubmitButton pendingLabel={mode === "create" ? "Cadastrando…" : "Salvando…"}>
                {mode === "create" ? "Cadastrar e liberar acesso" : "Salvar alterações"}
              </SubmitButton>
            </FormBar>
            {values.id && <input type="hidden" name="id" value={values.id} />}

            <Block icon={<IdCard size={18} />} title="Dados pessoais e profissionais" hint="Identificação, posição na empresa, supervisor e datas.">
            <fieldset className="grid gap-4 sm:grid-cols-2">
              <legend className="sr-only">Identificação</legend>
              <Field label="Nome completo" htmlFor="full_name" error={e.full_name}>
                <Input id="full_name" name="full_name" defaultValue={values.full_name} required minLength={3} maxLength={120} />
              </Field>
              <Field
                label="E-mail corporativo"
                htmlFor="email"
                error={e.email}
                hint={mode === "create" ? "A pessoa vai entrar com a conta Google deste e-mail (é o que libera o acesso)." : "O e-mail de acesso não pode ser alterado."}
              >
                <Input
                  id="email"
                  name={mode === "create" ? "email" : undefined}
                  type="email"
                  defaultValue={values.email}
                  disabled={mode === "edit"}
                  required={mode === "create"}
                  autoComplete="off"
                />
              </Field>
            </fieldset>

            <fieldset className="grid gap-4 sm:grid-cols-3">
              <legend className="sr-only">Posição na empresa</legend>
              <Field label="Área de atuação" htmlFor="area_id" error={e.area_id}>
                <Select
                  id="area_id"
                  name="area_id"
                  value={areaId}
                  onChange={(ev) => {
                    setAreaId(ev.target.value);
                    setPositionId("");
                    setLevelId("");
                  }}
                >
                  <option value="">Sem área</option>
                  {activeAreas.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                      {!a.active ? " (inativa)" : ""}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field
                label="Cargo"
                htmlFor="position_id"
                error={e.position_id}
                hint={areaId && positions.length === 0 ? "Nenhum cargo cadastrado nesta área." : undefined}
              >
                <Select
                  id="position_id"
                  name="position_id"
                  value={positionId}
                  disabled={!areaId}
                  onChange={(ev) => {
                    setPositionId(ev.target.value);
                    setLevelId("");
                  }}
                >
                  <option value="">{areaId ? "Sem cargo" : "Escolha a área primeiro"}</option>
                  {positions.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field
                label="Nível profissional"
                htmlFor="level_id"
                error={e.level_id}
                hint={positionId && allowedLevels.length === 0 ? "Este cargo ainda não tem níveis vinculados." : undefined}
              >
                <Select id="level_id" name="level_id" value={levelId} disabled={!positionId} onChange={(ev) => setLevelId(ev.target.value)}>
                  <option value="">{positionId ? "Sem nível" : "Escolha o cargo primeiro"}</option>
                  {allowedLevels.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Supervisor" htmlFor="supervisor_id" error={e.supervisor_id} className="sm:col-span-3">
                <Select id="supervisor_id" name="supervisor_id" defaultValue={values.supervisor_id ?? ""}>
                  <option value="">Sem supervisor</option>
                  {supervisorOptions.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.full_name}
                    </option>
                  ))}
                </Select>
              </Field>
            </fieldset>

            <fieldset className="grid gap-4 sm:grid-cols-2">
              <legend className="sr-only">Datas</legend>
              <Field label="Data de admissão" htmlFor="admission_date" error={e.admission_date}>
                <Input id="admission_date" name="admission_date" type="date" defaultValue={values.admission_date ?? ""} />
              </Field>
              <Field label="Início do onboarding" htmlFor="onboarding_start_date" error={e.onboarding_start_date}>
                <Input id="onboarding_start_date" name="onboarding_start_date" type="date" defaultValue={values.onboarding_start_date ?? ""} />
              </Field>
            </fieldset>
            </Block>

            <div className="grid gap-4 lg:grid-cols-2">
              <Block icon={<ShieldCheck size={18} />} title="Perfil de acesso" hint="Define as permissões padrão. Ajustes individuais ficam no bloco de permissões.">
                <Field
                  label="Perfil"
                  htmlFor="role_id"
                  error={e.role_id}
                  hint={canChangeRole ? undefined : "Somente administradores alteram o perfil de acesso."}
                >
                  {canChangeRole ? (
                    <Select id="role_id" name="role_id" defaultValue={roleId} required>
                      {structure.roles.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name}
                        </option>
                      ))}
                    </Select>
                  ) : (
                    <>
                      <input type="hidden" name="role_id" value={roleId} />
                      <Input id="role_id" value={structure.roles.find((r) => r.id === roleId)?.name ?? ""} disabled />
                    </>
                  )}
                </Field>
              </Block>
              <Block icon={<BadgeCheck size={18} />} title="Status do usuário" hint="Inativo bloqueia o acesso na hora e mantém o histórico.">
                <Field label="Status" htmlFor="status" error={e.status}>
                  <Select id="status" name="status" defaultValue={values.status ?? "onboarding"}>
                    {(Object.keys(STATUS_LABEL) as UserStatus[])
                      .filter((st) => canDeactivate || st !== "inativo" || values.status === "inativo")
                      .map((st) => (
                        <option key={st} value={st} disabled={st === "inativo" && !canDeactivate}>
                          {STATUS_LABEL[st]}
                        </option>
                      ))}
                  </Select>
                </Field>
              </Block>
            </div>
          </>
        );
      }}
    </ActionForm>
  );
}

/** Bloco do formulário com ícone, título e explicação. */
function Block({ icon, title, hint, children }: { icon: ReactNode; title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="grid gap-4 rounded-xl border border-line p-4 sm:p-5">
      <header className="flex items-start gap-3">
        <span aria-hidden className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-icon-bg text-icon">{icon}</span>
        <div>
          <h2 className="text-[15px] font-semibold">{title}</h2>
          {hint && <p className="text-[12.5px] text-muted">{hint}</p>}
        </div>
      </header>
      {children}
    </section>
  );
}
