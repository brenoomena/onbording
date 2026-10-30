import type { Metadata } from "next";
import { plainText } from "@/components/markdown";
import Link from "next/link";
import { ProgressBar } from "@/components/progress-bar";
import { Badge, EmptyState, LinkButton, PageHeader } from "@/components/ui";
import { requirePermission } from "@/lib/auth";
import { PUBLISH_LABEL, isOverdue, type EnrollmentStatus, type PublishStatus } from "@/lib/learning";
import { P } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Trilhas" };

interface Row {
  id: string;
  name: string;
  description: string | null;
  status: PublishStatus;
  is_mandatory: boolean;
  modules: { module_items: { count: number }[] }[];
  enrollments: { status: EnrollmentStatus; progress_percent: number; due_date: string | null }[];
}

const tone = { rascunho: "warn", publicado: "ok", arquivado: "neutral" } as const;

export default async function TrilhasPage() {
  await requirePermission(P.trilhasGerenciar);
  const supabase = await createClient();
  const { data } = await supabase
    .from("tracks")
    .select("id, name, description, status, is_mandatory, modules(module_items(count)), enrollments(status, progress_percent, due_date)")
    .order("status")
    .order("name");
  const rows = (data ?? []) as unknown as Row[];

  return (
    <>
      <PageHeader
        eyebrow="Aprendizagem"
        title="Trilhas"
        description="Sequências de módulos e conteúdos. Trilhas obrigatórias matriculam automaticamente o público definido."
        actions={<LinkButton href="/trilhas/nova">Nova trilha</LinkButton>}
      />
      {rows.length === 0 ? (
        <EmptyState title="Nenhuma trilha cadastrada" action={<LinkButton href="/trilhas/nova">Criar a primeira</LinkButton>} />
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {rows.map((t) => {
            const items = t.modules.reduce((s, m) => s + (m.module_items[0]?.count ?? 0), 0);
            const total = t.enrollments.length;
            const done = t.enrollments.filter((e) => e.status === "concluida").length;
            const late = t.enrollments.filter((e) => isOverdue(e.due_date, e.status)).length;
            const avg = total ? t.enrollments.reduce((s, e) => s + Number(e.progress_percent), 0) / total : 0;
            return (
              <Link key={t.id} href={`/trilhas/${t.id}`} className="grid gap-3 rounded-xl border border-line bg-surface p-5 transition-colors hover:border-brand">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <h2 className="font-semibold">{t.name}</h2>
                  <div className="flex gap-1.5">
                    {t.is_mandatory && <Badge tone="brand">Obrigatória</Badge>}
                    <Badge tone={tone[t.status]}>{PUBLISH_LABEL[t.status]}</Badge>
                  </div>
                </div>
                {t.description && <p className="line-clamp-2 text-[13px] text-muted">{plainText(t.description)}</p>}
                <p className="text-[12.5px] tabular-nums text-muted">
                  {t.modules.length} {t.modules.length === 1 ? "módulo" : "módulos"} · {items} {items === 1 ? "conteúdo" : "conteúdos"} · {total}{" "}
                  {total === 1 ? "matrícula" : "matrículas"} · {done} {done === 1 ? "concluída" : "concluídas"}
                  {late > 0 && <span className="font-semibold text-danger"> · {late} em atraso</span>}
                </p>
                {total > 0 && <ProgressBar value={avg} label="Progresso médio" />}
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
