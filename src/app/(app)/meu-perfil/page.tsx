import { UserRound } from "lucide-react";
import type { Metadata } from "next";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Card, Field, Input, PageHeader, StatusBadge, formatDate, LevelBadge } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { PROFILE_SELECT, type ProfileRow } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { THEME_COOKIE, parseTheme } from "@/lib/theme";
import { saveEmailPreferences, updateMyName } from "./actions";
import { AvatarEditor } from "./avatar-editor";
import { ThemePicker } from "./theme-picker";

export const metadata: Metadata = { title: "Meu perfil" };

export default async function MeuPerfilPage() {
  const me = await requireUser();
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select(PROFILE_SELECT).eq("id", me.userId).single();
  const p = data as unknown as ProfileRow;
  const theme = parseTheme((await cookies()).get(THEME_COOKIE)?.value);
  const [{ data: prefs }, { count: team }] = await Promise.all([
    supabase.from("email_preferences").select("lembretes, comunicados, resumo").eq("profile_id", me.userId).maybeSingle(),
    supabase.from("profiles").select("id", { count: "exact", head: true }).eq("supervisor_id", me.userId).neq("status", "inativo"),
  ]);
  const pref = { lembretes: prefs?.lembretes ?? true, comunicados: prefs?.comunicados ?? true, resumo: prefs?.resumo ?? true };
  const options: { name: keyof typeof pref; label: string; hint: string }[] = [
    { name: "lembretes", label: "Lembretes de prazo", hint: "Antes do prazo, no dia e quando atrasar (trilhas não obrigatórias)." },
    { name: "comunicados", label: "Comunicados importantes", hint: "Uma cópia por e-mail dos comunicados marcados como importantes." },
    ...(team ? [{ name: "resumo" as const, label: "Resumo semanal da equipe", hint: "Toda segunda-feira: atrasos, andamento e conclusões da sua equipe." }] : []),
  ];

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
        <section id="emails" className="scroll-mt-24 lg:col-start-1">
          <Card title="E-mails" description={`Enviados para ${p.email}. Matrícula nova e atraso de trilha obrigatória sempre são enviados.`}>
            <ActionForm action={saveEmailPreferences}>
              <div className="grid gap-2">
                {options.map((o) => (
                  <label key={o.name} className="flex cursor-pointer items-start gap-3 rounded-xl border border-line px-4 py-3 hover:border-accent/50">
                    <input type="checkbox" name={o.name} defaultChecked={pref[o.name]} className="mt-0.5 h-[18px] w-[18px] accent-[rgb(var(--brand))]" />
                    <span>
                      <span className="font-medium text-heading">{o.label}</span>
                      <span className="block text-[12.5px] text-muted">{o.hint}</span>
                    </span>
                  </label>
                ))}
              </div>
              {!team && <input type="hidden" name="resumo" value={pref.resumo ? "on" : ""} />}
              <div><SubmitButton>Salvar preferências</SubmitButton></div>
            </ActionForm>
          </Card>
        </section>
        <div className="grid gap-6 lg:row-span-2">
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
