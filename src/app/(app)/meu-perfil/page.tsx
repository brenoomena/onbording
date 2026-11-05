import { UserRound } from "lucide-react";
import type { Metadata } from "next";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Card, Field, Input, PageHeader, StatusBadge, formatDate, LevelBadge } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { PROFILE_SELECT, type ProfileRow } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { THEME_COOKIE, parseTheme } from "@/lib/theme";
import { updateMyName } from "./actions";
import { AvatarEditor } from "./avatar-editor";
import { ThemePicker } from "./theme-picker";

export const metadata: Metadata = { title: "Meu perfil" };

export default async function MeuPerfilPage() {
  const me = await requireUser();
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select(PROFILE_SELECT).eq("id", me.userId).single();
  const p = data as unknown as ProfileRow;
  const theme = parseTheme((await cookies()).get(THEME_COOKIE)?.value);

  return (
    <>
      <PageHeader eyebrow="Conta" icon={UserRound} title="Meu perfil" description="Seus dados na plataforma. Área, cargo, nível e supervisor são definidos pelo administrador." />
      <div className="grid items-start gap-6 lg:grid-cols-[1fr_360px]">
        <Card title="Dados do cadastro">
          <dl className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
            {[
              ["E-mail", p.email],
              ["Perfil de acesso", p.role?.name],
              ["Área", p.area?.name],
              ["Cargo", p.position?.name],
              ["Nível", p.level?.name ? <LevelBadge name={p.level.name} /> : null],
              ["Supervisor", p.supervisor?.full_name],
              ["Admissão", formatDate(p.admission_date)],
              ["Início do onboarding", formatDate(p.onboarding_start_date)],
            ].map(([k, v]) => (
              <div key={String(k)} className="grid gap-0.5">
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
          <Card title="Foto">
            <AvatarEditor userId={me.userId} name={p.full_name} path={me.profile.avatar_path} />
          </Card>
          <Card title="Aparência" description="Vale para este navegador.">
            <ThemePicker current={theme} />
          </Card>
          <Card title="Nome">
            <ActionForm action={updateMyName}>
              <Field label="Nome completo" htmlFor="full_name">
                <Input id="full_name" name="full_name" defaultValue={p.full_name} required minLength={3} maxLength={120} />
              </Field>
              <div><SubmitButton>Salvar nome</SubmitButton></div>
            </ActionForm>
          </Card>
          <Card title="Acesso">
            <p className="text-[13.5px] text-muted">
              Você entra com a conta Google <strong className="text-ink">{p.email}</strong>. Não há senha na plataforma: a segurança é a da sua conta Google.
            </p>
          </Card>
        </div>
      </div>
    </>
  );
}
