import type { Metadata } from "next";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Card, Field, Input, PageHeader, StatusBadge, formatDate } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { PROFILE_SELECT, type ProfileRow } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";
import { changeMyPassword, updateMyName } from "./actions";

export const metadata: Metadata = { title: "Meu perfil" };

export default async function MeuPerfilPage() {
  const me = await requireUser();
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select(PROFILE_SELECT).eq("id", me.userId).single();
  const p = data as unknown as ProfileRow;

  return (
    <>
      <PageHeader eyebrow="Conta" title="Meu perfil" description="Seus dados na plataforma. Área, cargo, nível e supervisor são definidos pelo administrador." />
      <div className="grid items-start gap-6 lg:grid-cols-[1fr_360px]">
        <Card title="Dados do cadastro">
          <dl className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
            {[
              ["E-mail", p.email],
              ["Perfil de acesso", p.role?.name],
              ["Área", p.area?.name],
              ["Cargo", p.position?.name],
              ["Nível", p.level?.name],
              ["Supervisor", p.supervisor?.full_name],
              ["Admissão", formatDate(p.admission_date)],
              ["Início do onboarding", formatDate(p.onboarding_start_date)],
            ].map(([k, v]) => (
              <div key={k} className="grid gap-0.5">
                <dt className="text-[12.5px] text-muted">{k}</dt>
                <dd className="font-medium break-words">{v || "Não definido"}</dd>
              </div>
            ))}
            <div className="grid gap-0.5">
              <dt className="text-[12.5px] text-muted">Status</dt>
              <dd><StatusBadge status={p.status} /></dd>
            </div>
          </dl>
        </Card>
        <div className="grid gap-6">
          <Card title="Nome">
            <ActionForm action={updateMyName}>
              <Field label="Nome completo" htmlFor="full_name">
                <Input id="full_name" name="full_name" defaultValue={p.full_name} required minLength={3} maxLength={120} />
              </Field>
              <div><SubmitButton>Salvar nome</SubmitButton></div>
            </ActionForm>
          </Card>
          <Card title="Trocar senha">
            <ActionForm action={changeMyPassword} resetOnSuccess>
              <Field label="Nova senha" htmlFor="password" hint="Mínimo de 10 caracteres.">
                <Input id="password" name="password" type="password" autoComplete="new-password" minLength={10} required />
              </Field>
              <Field label="Repita a nova senha" htmlFor="confirm">
                <Input id="confirm" name="confirm" type="password" autoComplete="new-password" required />
              </Field>
              <div><SubmitButton>Trocar senha</SubmitButton></div>
            </ActionForm>
          </Card>
        </div>
      </div>
    </>
  );
}
