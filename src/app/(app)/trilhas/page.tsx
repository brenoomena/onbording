import { AlarmClock, CheckCircle2, Eye, Pencil, Plus, Route, Trash2, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { ActionButton } from "@/components/forms";
import { plainText } from "@/components/markdown";
import { ProgressBar } from "@/components/progress-bar";
import { Badge, EmptyState, IconLink, LinkButton, PageHeader, RowActions, StatCard, Table } from "@/components/ui";
import { can, requirePermission } from "@/lib/auth";
import { PUBLISH_LABEL, isOverdue, type EnrollmentStatus, type PublishStatus } from "@/lib/learning";
import { P } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { deleteTrack } from "./actions";

export const metadata: Metadata = { title: "Trilhas" };

interface Row {
  id: string;
  name: string;
  description: string | null;
  status: PublishStatus;
  is_mandatory: boolean;
  modules: { module_items: { count: number }[] }[];
  contents: { count: number }[];
  enrollments: { status: EnrollmentStatus; progress_percent: number; due_date: string | null }[];
}

const tone = { rascunho: "warn", publicado: "ok", arquivado: "neutral" } as const;

export default async function TrilhasPage() {
  const me = await requirePermission(P.trilhasVer);
  const supabase = await createClient();
  const { data } = await supabase
    .from("tracks")
    .select("id, name, description, status, is_mandatory, modules(module_items(count)), contents(count), enrollments(status, progress_percent, due_date)")
    .order("status")
    .order("name");
  const rows = (data ?? []) as unknown as Row[];
  const canCreate = can(me, P.trilhasCriar);
  const canEdit = can(me, P.trilhasEditar);
  const canDelete = can(me, P.trilhasExcluir);
  const canEnroll = can(me, P.trilhasMatricular);

  const all = rows.flatMap((r) => r.enrollments);
  const late = all.filter((e) => isOverdue(e.due_date, e.status)).length;
  const newButton = canCreate && (
    <LinkButton href="/trilhas/nova">
      <Plus size={16} aria-hidden /> Nova trilha
    </LinkButton>
  );

  return (
    <>
      <PageHeader
        eyebrow="Gestão"
        icon={Route}
        title="Trilhas"
        description="Sequências de módulos e conteúdos. Trilhas obrigatórias matriculam automaticamente o público definido."
        actions={newButton}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Trilhas" value={rows.length} hint={`${rows.filter((r) => r.status === "publicado").length} publicadas`} icon={Route} />
        <StatCard label="Matrículas" value={all.length} hint="Em todas as trilhas" icon={Users} tone="neutral" />
        <StatCard label="Concluídas" value={all.filter((e) => e.status === "concluida").length} hint="Matrículas com 100%" icon={CheckCircle2} tone="ok" />
        <StatCard label="Em atraso" value={late} hint="Prazo vencido" icon={AlarmClock} tone={late ? "danger" : "neutral"} />
      </div>

      {rows.length === 0 ? (
        <EmptyState icon={Route} title="Nenhuma trilha cadastrada" action={newButton} />
      ) : (
        <Table>
          <thead>
            <tr>
              <th>Trilha</th>
              <th>Estrutura</th>
              <th>Matrículas</th>
              <th className="w-[180px]">Progresso médio</th>
              <th>Situação</th>
              <th className="text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((t) => {
              const items = t.modules.reduce((s, m) => s + (m.module_items[0]?.count ?? 0), 0);
              const total = t.enrollments.length;
              const done = t.enrollments.filter((e) => e.status === "concluida").length;
              const lateT = t.enrollments.filter((e) => isOverdue(e.due_date, e.status)).length;
              const avg = total ? t.enrollments.reduce((s, e) => s + Number(e.progress_percent), 0) / total : 0;
              return (
                <tr key={t.id}>
                  <td className="max-w-[340px]">
                    <Link href={`/trilhas/${t.id}`} className="font-semibold text-heading hover:text-accent">
                      {t.name}
                    </Link>
                    {t.description && <p className="line-clamp-1 text-[12.5px] text-muted">{plainText(t.description)}</p>}
                  </td>
                  <td className="whitespace-nowrap text-[13px] tabular-nums text-muted">
                    {t.modules.length} {t.modules.length === 1 ? "módulo" : "módulos"} · {items} {items === 1 ? "item" : "itens"}
                    <span className="block text-[12px]">{t.contents[0]?.count ?? 0} conteúdos vinculados</span>
                  </td>
                  <td className="whitespace-nowrap text-[13px] tabular-nums">
                    {total} <span className="text-muted">· {done} concluídas</span>
                    {lateT > 0 && <span className="block text-[12px] font-semibold text-danger">{lateT} em atraso</span>}
                  </td>
                  <td>{total > 0 ? <ProgressBar value={avg} /> : <span className="text-[12.5px] text-muted">—</span>}</td>
                  <td>
                    <div className="flex flex-wrap gap-1">
                      <Badge tone={tone[t.status]}>{PUBLISH_LABEL[t.status]}</Badge>
                      {t.is_mandatory && <Badge tone="brand">Obrigatória</Badge>}
                    </div>
                  </td>
                  <td>
                    <RowActions>
                      <IconLink href={`/minhas-trilhas/${t.id}`} label="Ver como colaborador" icon={Eye} />
                      <IconLink href={`/trilhas/${t.id}`} label={canEdit ? "Editar trilha" : "Abrir trilha"} icon={Pencil} />
                      {canEnroll && <IconLink href={`/trilhas/${t.id}/matriculas`} label="Matrículas e progresso" icon={Users} />}
                      {canDelete && (
                        <ActionButton
                          action={deleteTrack}
                          hidden={{ id: t.id }}
                          label="Excluir trilha"
                          variant="danger"
                          icon={<Trash2 size={16} aria-hidden />}
                          iconOnly
                          confirm
                          confirmLabel="Excluir trilha"
                          confirmText={`"${t.name}" e os módulos serão apagados definitivamente. Só é possível sem matrículas e sem conteúdos vinculados.`}
                        />
                      )}
                    </RowActions>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      )}
    </>
  );
}
