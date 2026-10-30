import type { Metadata } from "next";
import Link from "next/link";
import { Card, EmptyState, PageHeader, StatusBadge, formatDate } from "@/components/ui";
import { requirePermission } from "@/lib/auth";
import { P } from "@/lib/permissions";
import { PROFILE_SELECT, type ProfileRow } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Painel" };

function Stat({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <div className="grid gap-1 rounded-xl border border-line bg-surface p-4">
      <p className="text-[12.5px] text-muted">{label}</p>
      <p className="text-3xl font-semibold tabular-nums tracking-tight">{value}</p>
      {hint && <p className="text-[12px] text-muted">{hint}</p>}
    </div>
  );
}

export default async function PainelPage() {
  const me = await requirePermission(P.painelVer);
  const supabase = await createClient();
  const seesOthers = me.permissions.has(P.colaboradoresVer) || me.permissions.has(P.equipeVer);
  const firstName = me.profile.full_name.split(" ")[0];

  const { data: self } = await supabase.from("profiles").select(PROFILE_SELECT).eq("id", me.userId).single();
  const profile = self as unknown as ProfileRow;

  if (!seesOthers) {
    return (
      <>
        <PageHeader eyebrow="Meu painel" title={`Olá, ${firstName}`} description="Estes são os dados do seu cadastro na plataforma." />
        <Card title="Meu cadastro">
          <dl className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
            {[
              ["Área", profile.area?.name],
              ["Cargo", profile.position?.name],
              ["Nível", profile.level?.name],
              ["Supervisor", profile.supervisor?.full_name],
              ["Admissão", formatDate(profile.admission_date)],
              ["Início do onboarding", formatDate(profile.onboarding_start_date)],
            ].map(([k, v]) => (
              <div key={k} className="grid gap-0.5">
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
    base().neq("status", "inativo").or("position_id.is.null,level_id.is.null"),
    (scope
      ? supabase.from("profiles").select(PROFILE_SELECT).eq("supervisor_id", scope)
      : supabase.from("profiles").select(PROFILE_SELECT)
    )
      .eq("status", "onboarding")
      .order("onboarding_start_date", { ascending: false, nullsFirst: false })
      .limit(6),
  ]);

  const people = (recentes.data ?? []) as unknown as ProfileRow[];

  return (
    <>
      <PageHeader
        eyebrow={scope ? "Minha equipe" : "Visão geral"}
        title={`Olá, ${firstName}`}
        description={scope ? "Números da sua equipe direta." : "Números de todos os colaboradores cadastrados."}
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Colaboradores" value={total.count ?? 0} />
        <Stat label="Em onboarding" value={onboarding.count ?? 0} />
        <Stat label="Ativos" value={ativos.count ?? 0} />
        <Stat label="Inativos" value={inativos.count ?? 0} />
      </div>

      {(semCargo.count ?? 0) > 0 && (
        <p className="rounded-lg border border-warn/30 bg-warn-soft px-4 py-2.5 text-[13px] text-warn">
          {semCargo.count} {semCargo.count === 1 ? "pessoa está" : "pessoas estão"} sem cargo ou nível definido. Esses dados vão
          definir trilhas e competências nas próximas etapas.{" "}
          <Link href="/colaboradores?pendente=1" className="font-semibold underline">
            Ver lista
          </Link>
        </p>
      )}

      <Card title="Em onboarding" description="Pessoas em onboarding, das mais recentes para as mais antigas.">
        {people.length === 0 ? (
          <EmptyState title="Ninguém em onboarding agora">Quando um colaborador for cadastrado com esse status, ele aparece aqui.</EmptyState>
        ) : (
          <ul className="divide-y divide-line">
            {people.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <Link href={`/colaboradores/${p.id}`} className="font-medium hover:text-accent">
                    {p.full_name}
                  </Link>
                  <p className="text-[12.5px] text-muted">
                    {[p.area?.name, p.position?.name, p.level?.name].filter(Boolean).join(" · ") || "Sem área ou cargo"}
                  </p>
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
