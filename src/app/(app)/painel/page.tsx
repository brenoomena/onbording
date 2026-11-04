import { AlarmClock, AlertTriangle, BookOpenCheck, CheckCircle2, CircleDashed, GraduationCap, IdCard, LayoutDashboard, Rocket, UserCheck, UserMinus, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { ProgressBar } from "@/components/progress-bar";
import { Avatar } from "@/components/avatar";
import { Badge, Card, EmptyState, PageHeader, StatCard, StatusBadge, formatDate, ENROLLMENT_TONE, LevelBadge } from "@/components/ui";
import { requirePermission } from "@/lib/auth";
import { ENROLLMENT_LABEL, isOverdue, todayBR } from "@/lib/learning";
import { loadEnrollmentsOf, type MyEnrollment } from "@/lib/my-learning";
import { P } from "@/lib/permissions";
import { PROFILE_SELECT, type ProfileRow } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Painel" };

function MyTracks({ enrollments }: { enrollments: MyEnrollment[] }) {
  const pending = enrollments.filter((e) => e.status !== "concluida");
  if (enrollments.length === 0) return null;
  return (
    <Card
      icon={BookOpenCheck}
      title="Minhas trilhas"
      description={pending.length ? `${pending.length} em andamento ou a iniciar` : "Todas concluídas"}
      actions={<Link href="/minhas-trilhas" className="text-[13px] font-semibold text-accent hover:underline">Ver todas</Link>}
    >
      <ul className="grid gap-4">
        {(pending.length ? pending : enrollments).slice(0, 4).map((e) => {
          const overdue = isOverdue(e.due_date, e.status);
          return (
            <li key={e.id} className="grid gap-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Link href={`/minhas-trilhas/${e.track.id}`} className="font-medium hover:text-accent">{e.track.name}</Link>
                <Badge tone={overdue ? "danger" : ENROLLMENT_TONE[e.status]}>
                  {overdue ? "Em atraso" : ENROLLMENT_LABEL[e.status]}
                </Badge>
              </div>
              <ProgressBar value={Number(e.progress_percent)} label={e.due_date ? `Prazo ${formatDate(e.due_date)}` : "Sem prazo"} />
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

export default async function PainelPage() {
  const me = await requirePermission(P.painelVer);
  const supabase = await createClient();
  const seesOthers = me.permissions.has(P.colaboradoresVer) || me.permissions.has(P.equipeVer);
  const firstName = me.profile.full_name.split(" ")[0];

  const { data: self } = await supabase.from("profiles").select(PROFILE_SELECT).eq("id", me.userId).single();
  const profile = self as unknown as ProfileRow;

  const myEnrollments = await loadEnrollmentsOf(me.userId);

  if (!seesOthers) {
    return (
      <>
        <PageHeader eyebrow="Meu painel" icon={LayoutDashboard} title={`Olá, ${firstName}`} description="Suas trilhas e os dados do seu cadastro na plataforma." />
        {myEnrollments.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard label="Minhas trilhas" value={myEnrollments.length} icon={BookOpenCheck} />
            <StatCard label="Em andamento" value={myEnrollments.filter((e) => e.status === "em_andamento").length} icon={Rocket} tone="neutral" />
            <StatCard label="Concluídas" value={myEnrollments.filter((e) => e.status === "concluida").length} icon={CheckCircle2} tone="ok" />
          </div>
        )}
        <MyTracks enrollments={myEnrollments} />
        <Card title="Meu cadastro" icon={IdCard}>
          <dl className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
            {[
              ["Área", profile.area?.name],
              ["Cargo", profile.position?.name],
              ["Nível", profile.level?.name ? <LevelBadge name={profile.level.name} /> : null],
              ["Supervisor", profile.supervisor?.full_name],
              ["Admissão", formatDate(profile.admission_date)],
              ["Início do onboarding", formatDate(profile.onboarding_start_date)],
            ].map(([k, v]) => (
              <div key={String(k)} className="grid gap-0.5">
                <dt className="text-[12.5px] text-muted">{k}</dt>
                <dd className="font-medium">{v || "Não definido"}</dd>
              </div>
            ))}
          </dl>
        </Card>
      </>
    );
  }

  // Indicadores sobre as pessoas visíveis para este usuário (RLS limita ao alcance dele).
  const scope = me.permissions.has(P.colaboradoresVer) ? null : me.userId;
  const base = () => {
    const q = supabase.from("profiles").select("id", { count: "exact", head: true });
    return scope ? q.eq("supervisor_id", scope) : q;
  };
  const [total, onboarding, ativos, inativos, semCargo, recentes] = await Promise.all([
    base(),
    base().eq("status", "onboarding"),
    base().eq("status", "ativo"),
    base().eq("status", "inativo"),
    // Administradores não precisam de cargo ou nível, então ficam fora deste aviso.
    (scope
      ? supabase.from("profiles").select("id, role:roles!inner(key)", { count: "exact", head: true }).eq("supervisor_id", scope)
      : supabase.from("profiles").select("id, role:roles!inner(key)", { count: "exact", head: true })
    )
      .neq("role.key", "admin")
      .neq("status", "inativo")
      .or("position_id.is.null,level_id.is.null"),
    (scope
      ? supabase.from("profiles").select(PROFILE_SELECT).eq("supervisor_id", scope)
      : supabase.from("profiles").select(PROFILE_SELECT)
    )
      .eq("status", "onboarding")
      .order("onboarding_start_date", { ascending: false, nullsFirst: false })
      .limit(6),
  ]);

  const people = (recentes.data ?? []) as unknown as ProfileRow[];

  // Aprendizagem no alcance do usuário (o banco limita à equipe ou a todos).
  const { data: enr } = await supabase
    .from("enrollments")
    .select("status, due_date, profile_id")
    .neq("profile_id", me.userId);
  const learning = (enr ?? []) as { status: "nao_iniciada" | "em_andamento" | "concluida"; due_date: string | null; profile_id: string }[];
  const today = todayBR();
  const late = learning.filter((e) => e.status !== "concluida" && e.due_date && e.due_date < today).length;

  return (
    <>
      <PageHeader
        eyebrow={scope ? "Minha equipe" : "Visão geral"}
        icon={LayoutDashboard}
        title={`Olá, ${firstName}`}
        description={scope ? "Números da sua equipe direta." : "Números de todos os colaboradores cadastrados."}
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Colaboradores" value={total.count ?? 0} hint="Cadastrados no seu alcance" icon={Users} href="/colaboradores" />
        <StatCard label="Em onboarding" value={onboarding.count ?? 0} hint="Jornada de integração" icon={Rocket} tone="brand" href="/colaboradores?status=onboarding" />
        <StatCard label="Ativos" value={ativos.count ?? 0} hint="Com acesso liberado" icon={UserCheck} tone="ok" href="/colaboradores?status=ativo" />
        <StatCard label="Inativos" value={inativos.count ?? 0} hint="Acesso bloqueado" icon={UserMinus} tone="neutral" href="/colaboradores?status=inativo" />
      </div>

      {learning.length > 0 && (
        <section className="grid gap-2">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="flex items-center gap-2 text-[15px] font-semibold"><GraduationCap size={18} className="text-icon" aria-hidden /> Trilhas {scope ? "da equipe" : ""}</h2>
            {me.permissions.has(P.trilhasVer) && (
              <Link href="/trilhas" className="text-[13px] font-semibold text-accent hover:underline">Gerenciar trilhas</Link>
            )}
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Matrículas" value={learning.length} hint="Em todas as trilhas" icon={GraduationCap} />
            <StatCard label="Não iniciadas" value={learning.filter((e) => e.status === "nao_iniciada").length} hint="Ainda sem acesso" icon={CircleDashed} tone="neutral" />
            <StatCard label="Concluídas" value={learning.filter((e) => e.status === "concluida").length} hint="Trilhas em 100%" icon={CheckCircle2} tone="ok" />
            <StatCard label="Em atraso" value={late} hint="Prazo vencido" icon={AlarmClock} tone={late ? "danger" : "neutral"} />
          </div>
        </section>
      )}

      <MyTracks enrollments={myEnrollments} />

      {(semCargo.count ?? 0) > 0 && (
        <p className="flex items-start gap-2 rounded-xl border border-warn/30 bg-warn-soft px-4 py-3 text-[13px] text-warn">
          <AlertTriangle size={17} className="mt-0.5 shrink-0" aria-hidden />
          <span>
          {semCargo.count} {semCargo.count === 1 ? "pessoa está" : "pessoas estão"} sem cargo ou nível definido. Esses dados vão
          definir trilhas e competências nas próximas etapas.{" "}
          <Link href="/colaboradores?pendente=1" className="font-semibold underline">
            Ver lista
          </Link>
          </span>
        </p>
      )}

      <Card icon={Rocket} title="Em onboarding" description="Pessoas em onboarding, das mais recentes para as mais antigas.">
        {people.length === 0 ? (
          <EmptyState icon={Rocket} title="Ninguém em onboarding agora">Quando um colaborador for cadastrado com esse status, ele aparece aqui.</EmptyState>
        ) : (
          <ul className="divide-y divide-line">
            {people.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar name={p.full_name} path={p.avatar_path} size={36} />
                  <div className="min-w-0">
                  <Link href={`/colaboradores/${p.id}`} className="font-medium hover:text-accent">
                    {p.full_name}
                  </Link>
                  <p className="text-[12.5px] text-muted">
                    {[p.area?.name, p.position?.name, p.level?.name].filter(Boolean).join(" · ") || "Sem área ou cargo"}
                  </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-[12.5px] text-muted">
                  <span>Início {formatDate(p.onboarding_start_date)}</span>
                  <StatusBadge status={p.status} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
