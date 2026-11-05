import { Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionButton, ActionForm, SubmitButton } from "@/components/forms";
import { ProgressBar } from "@/components/progress-bar";
import { Badge, Card, EmptyState, Field, Input, PageHeader, Table, formatDate, ENROLLMENT_TONE } from "@/components/ui";
import { requirePermission } from "@/lib/auth";
import { ENROLLMENT_LABEL, formatMinutes, isOverdue, type EnrollmentStatus } from "@/lib/learning";
import { P } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { enrollPeople, removeEnrollment, updateDueDate } from "../../actions";
import { loadTrack } from "../load";

export const metadata: Metadata = { title: "Matrículas" };

interface Row {
  id: string;
  origin: string;
  due_date: string | null;
  status: EnrollmentStatus;
  progress_percent: number;
  assigned_at: string;
  completed_at: string | null;
  profile: { id: string; full_name: string; area: { name: string } | null; position: { name: string } | null };
}

const ORIGIN = { automatica: "Automática", manual: "Manual", propria: "Própria" } as Record<string, string>;
const tone = ENROLLMENT_TONE;

export default async function MatriculasPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission(P.trilhasMatricular);
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const loaded = await loadTrack(id);
  if (!loaded) notFound();
  const { track, modules } = loaded;
  const contentIds = modules.flatMap((m) => m.items.map((i) => i.content.id));

  const supabase = await createClient();
  const [{ data }, { data: people }, { data: time }, { data: certs }] = await Promise.all([
    supabase
      .from("enrollments")
      .select("id, origin, due_date, status, progress_percent, assigned_at, completed_at, profile:profiles(id, full_name, area:areas(name), position:positions(name))")
      .eq("track_id", id)
      .order("assigned_at", { ascending: false }),
    supabase.from("profiles").select("id, full_name").neq("status", "inativo").order("full_name"),
    contentIds.length
      ? supabase.from("content_progress").select("profile_id, active_seconds").in("content_id", contentIds)
      : Promise.resolve({ data: [] as { profile_id: string; active_seconds: number }[] }),
    supabase.from("certificates").select("id, profile_id").eq("track_id", id),
  ]);
  const certOf = new Map(((certs ?? []) as { id: string; profile_id: string }[]).map((c) => [c.profile_id, c.id]));
  const rows = (data ?? []) as unknown as Row[];
  const enrolledIds = new Set(rows.map((r) => r.profile.id));
  const candidates = ((people ?? []) as { id: string; full_name: string }[]).filter((p) => !enrolledIds.has(p.id));
  const seconds = new Map<string, number>();
  for (const t of (time ?? []) as { profile_id: string; active_seconds: number }[]) {
    seconds.set(t.profile_id, (seconds.get(t.profile_id) ?? 0) + t.active_seconds);
  }

  const done = rows.filter((r) => r.status === "concluida").length;
  const late = rows.filter((r) => isOverdue(r.due_date, r.status)).length;
  const notStarted = rows.filter((r) => r.status === "nao_iniciada").length;

  return (
    <>
      <PageHeader
        eyebrow={track.name}
        icon={Users}
        title="Matrículas e progresso"
        description={`${rows.length} matrículas · ${done} concluídas · ${notStarted} não iniciadas${late ? ` · ${late} em atraso` : ""}`}
        actions={<Link href={`/trilhas/${id}`} className="text-[13px] font-medium text-accent hover:underline">← Voltar à trilha</Link>}
      />

      {rows.length === 0 ? (
        <EmptyState title="Ninguém matriculado ainda">
          {track.is_mandatory ? "Defina o público e publique a trilha para matricular automaticamente." : "Matricule pessoas abaixo."}
        </EmptyState>
      ) : (
        <Table>
          <thead>
            <tr>
              <th>Colaborador</th>
              <th>Progresso</th>
              <th>Status</th>
              <th>Tempo ativo</th>
              <th>Prazo</th>
              <th>Origem</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const overdue = isOverdue(r.due_date, r.status);
              return (
                <tr key={r.id}>
                  <td>
                    <Link href={`/colaboradores/${r.profile.id}`} className="font-medium hover:text-accent">{r.profile.full_name}</Link>
                    <p className="text-[12px] text-muted">{[r.profile.area?.name, r.profile.position?.name].filter(Boolean).join(" · ") || "Sem área"}</p>
                  </td>
                  <td className="min-w-[140px]"><ProgressBar value={Number(r.progress_percent)} label="" /></td>
                  <td>
                    <Badge tone={overdue ? "danger" : tone[r.status]}>{overdue ? "Em atraso" : ENROLLMENT_LABEL[r.status]}</Badge>
                    {r.completed_at && <p className="mt-1 text-[12px] text-muted">em {formatDate(r.completed_at)}</p>}
                    {certOf.get(r.profile.id) && (
                      <Link href={`/certificados/${certOf.get(r.profile.id)}`} className="mt-1 inline-block text-[12px] font-medium text-accent hover:underline">
                        Ver certificado
                      </Link>
                    )}
                  </td>
                  <td className="text-[13px] tabular-nums">{formatMinutes(seconds.get(r.profile.id))}</td>
                  <td>
                    <ActionForm action={updateDueDate} className="flex items-center gap-1">
                      <input type="hidden" name="id" value={r.id} />
                      <Input aria-label="Prazo" type="date" name="due_date" defaultValue={r.due_date ?? ""} className="w-[150px] py-1 text-[13px]" />
                      <SubmitButton variant="ghost" className="px-2 py-1 text-[12px]" pendingLabel="…">Salvar</SubmitButton>
                    </ActionForm>
                  </td>
                  <td className="text-[13px]">{ORIGIN[r.origin] ?? r.origin}</td>
                  <td>
                    {r.status === "nao_iniciada" && (
                      <ActionButton action={removeEnrollment} hidden={{ id: r.id }} label="Remover" variant="ghost" confirm confirmLabel="Remover" confirmText="A pessoa deixa de ver a trilha. O progresso nos conteúdos é mantido." />
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      )}

      <Card title="Matricular pessoas" description="Para quem está fora do público automático ou para trilhas opcionais.">
        {candidates.length === 0 ? (
          <p className="text-[13px] text-muted">Todos os colaboradores ativos já estão matriculados.</p>
        ) : (
          <ActionForm action={enrollPeople} resetOnSuccess>
            <input type="hidden" name="track_id" value={id} />
            <div className="grid max-h-64 gap-1 overflow-y-auto rounded-lg border border-line p-2 sm:grid-cols-2">
              {candidates.map((p) => (
                <label key={p.id} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-[13px] hover:bg-sunken">
                  <input type="checkbox" name="profile_id" value={p.id} className="h-4 w-4 accent-[rgb(var(--brand))]" />
                  {p.full_name}
                </label>
              ))}
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <Field label="Prazo (opcional)" htmlFor="due_date">
                <Input id="due_date" name="due_date" type="date" />
              </Field>
              <SubmitButton>Matricular selecionados</SubmitButton>
            </div>
          </ActionForm>
        )}
      </Card>
    </>
  );
}
