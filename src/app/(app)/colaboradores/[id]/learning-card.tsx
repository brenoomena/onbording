import Link from "next/link";
import { ProgressBar } from "@/components/progress-bar";
import { Badge, Card, formatDate } from "@/components/ui";
import { ENROLLMENT_LABEL, formatMinutes, isOverdue } from "@/lib/learning";
import { loadEnrollmentsOf, loadProgressOf } from "@/lib/my-learning";

/** Trilhas e tempo de estudo de uma pessoa (o banco só devolve se quem vê tiver acesso). */
export async function LearningCard({ profileId, canManageTracks }: { profileId: string; canManageTracks: boolean }) {
  const [enrollments, progress] = await Promise.all([loadEnrollmentsOf(profileId), loadProgressOf(profileId)]);
  const active = progress.rows.reduce((s, r) => s + r.active_seconds, 0);
  const sessions = progress.rows.reduce((s, r) => s + r.session_seconds, 0);
  const completed = progress.rows.filter((r) => r.status === "concluido").length;

  return (
    <Card
      title="Trilhas e estudo"
      description={`${completed} ${completed === 1 ? "conteúdo concluído" : "conteúdos concluídos"} · tempo ativo ${formatMinutes(active)} · tempo com a página aberta ${formatMinutes(sessions)}`}
    >
      {enrollments.length === 0 ? (
        <p className="text-[13px] text-muted">Nenhuma trilha atribuída.</p>
      ) : (
        <ul className="grid gap-4">
          {enrollments.map((e) => {
            const overdue = isOverdue(e.due_date, e.status);
            return (
              <li key={e.id} className="grid gap-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  {canManageTracks ? (
                    <Link href={`/trilhas/${e.track.id}/matriculas`} className="font-medium hover:text-accent">{e.track.name}</Link>
                  ) : (
                    <span className="font-medium">{e.track.name}</span>
                  )}
                  <span className="flex flex-wrap items-center gap-2 text-[12.5px] text-muted">
                    {e.due_date && <span>Prazo {formatDate(e.due_date)}</span>}
                    {e.completed_at && <span>Concluída em {formatDate(e.completed_at)}</span>}
                    <Badge tone={overdue ? "danger" : e.status === "concluida" ? "ok" : "neutral"}>{overdue ? "Em atraso" : ENROLLMENT_LABEL[e.status]}</Badge>
                  </span>
                </div>
                <ProgressBar value={Number(e.progress_percent)} />
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
