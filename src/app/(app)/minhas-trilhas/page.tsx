import { BookOpenCheck } from "lucide-react";
import type { Metadata } from "next";
import { plainText } from "@/components/markdown";
import Link from "next/link";
import { ActionButton } from "@/components/forms";
import { ProgressBar } from "@/components/progress-bar";
import { Badge, EmptyState, PageHeader, formatDate, ENROLLMENT_TONE } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { ENROLLMENT_LABEL, isOverdue } from "@/lib/learning";
import { loadEnrollmentsOf } from "@/lib/my-learning";
import { createClient } from "@/lib/supabase/server";
import { enrollMe } from "../estudar/actions";

export const metadata: Metadata = { title: "Minhas trilhas" };

export default async function MinhasTrilhasPage() {
  const me = await requireUser();
  const enrollments = await loadEnrollmentsOf(me.userId);
  const supabase = await createClient();
  const enrolledIds = enrollments.map((e) => e.track.id);

  // Trilhas opcionais publicadas do público da pessoa, em que ela ainda não está.
  let available: { id: string; name: string; description: string | null }[] = [];
  const { data: tracks } = await supabase.from("tracks").select("id, name, description").eq("status", "publicado").order("name");
  for (const t of (tracks ?? []) as { id: string; name: string; description: string | null }[]) {
    if (enrolledIds.includes(t.id)) continue;
    const { data: ok } = await supabase.rpc("matches_audience", { p_track: t.id, p_content: null });
    if (ok) available.push(t);
  }
  available = available.slice(0, 20);

  const active = enrollments.filter((e) => e.status !== "concluida");
  const done = enrollments.filter((e) => e.status === "concluida");

  const card = (e: (typeof enrollments)[number]) => {
    const overdue = isOverdue(e.due_date, e.status);
    return (
      <Link key={e.id} href={`/minhas-trilhas/${e.track.id}`} className="grid gap-3 rounded-xl border border-line bg-surface p-5 transition-colors hover:border-brand">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h2 className="font-semibold">{e.track.name}</h2>
          <div className="flex gap-1.5">
            {e.track.is_mandatory && <Badge tone="brand">Obrigatória</Badge>}
            <Badge tone={overdue ? "danger" : ENROLLMENT_TONE[e.status]}>{overdue ? "Em atraso" : ENROLLMENT_LABEL[e.status]}</Badge>
          </div>
        </div>
        {e.track.description && <p className="line-clamp-2 text-[13px] text-muted">{plainText(e.track.description)}</p>}
        <ProgressBar value={Number(e.progress_percent)} label={e.due_date ? `Prazo ${formatDate(e.due_date)}` : "Sem prazo"} />
      </Link>
    );
  };

  return (
    <>
      <PageHeader eyebrow="Aprendizagem" icon={BookOpenCheck} title="Minhas trilhas" description="Trilhas em que você está matriculado. Siga as etapas em ordem e marque cada conteúdo ao concluir." />
      {enrollments.length === 0 && available.length === 0 ? (
        <EmptyState title="Você ainda não tem trilhas">Quando o seu gestor liberar uma trilha para você, ela aparece aqui.</EmptyState>
      ) : (
        <>
          {active.length > 0 && <div className="grid gap-3 lg:grid-cols-2">{active.map(card)}</div>}
          {available.length > 0 && (
            <section className="grid gap-3">
              <h2 className="text-lg font-semibold">Disponíveis para você</h2>
              <div className="grid gap-3 lg:grid-cols-2">
                {available.map((t) => (
                  <div key={t.id} className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-dashed border-line bg-surface p-5">
                    <div className="min-w-0">
                      <p className="font-semibold">{t.name}</p>
                      {t.description && <p className="line-clamp-2 text-[13px] text-muted">{plainText(t.description)}</p>}
                    </div>
                    <ActionButton action={enrollMe} hidden={{ track_id: t.id }} label="Começar" variant="primary" />
                  </div>
                ))}
              </div>
            </section>
          )}
          {done.length > 0 && (
            <section className="grid gap-3">
              <h2 className="text-lg font-semibold">Concluídas</h2>
              <div className="grid gap-3 lg:grid-cols-2">{done.map(card)}</div>
            </section>
          )}
        </>
      )}
    </>
  );
}
