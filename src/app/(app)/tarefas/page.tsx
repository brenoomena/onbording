import { ListChecks } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Card, EmptyState, PageHeader, cx } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { taskState, todaySP, type TaskState } from "@/lib/checklist";
import { P } from "@/lib/permissions";
import { isMine, loadTasks, type TaskRowData } from "@/lib/tasks-server";
import { TaskRow } from "./task-row";

export const metadata: Metadata = { title: "Minhas tarefas" };

const GROUPS: { key: TaskState; label: string; hint?: string }[] = [
  { key: "atrasada", label: "Atrasadas" },
  { key: "hoje", label: "Para hoje" },
  { key: "proxima", label: "Próximas" },
  { key: "sem_prazo", label: "Sem prazo" },
];

export default async function TarefasPage({ searchParams }: { searchParams: Promise<{ ver?: string }> }) {
  const me = await requireUser();
  const rh = me.permissions.has(P.checklistsGerenciar);
  const { ver } = await searchParams;
  const all = rh && ver === "todas";
  const today = todaySP();
  const since = new Date(Date.now() - 30 * 86400000).toISOString();
  const tasks = await loadTasks({ doneSince: since });

  const mine = tasks.filter((t) => isMine(t, me));
  const scope = all ? tasks : mine;
  const open = scope.filter((t) => !t.done_at);
  const done = scope.filter((t) => t.done_at).sort((a, b) => (b.done_at ?? "").localeCompare(a.done_at ?? ""));
  const own = tasks.filter((t) => t.profile_id === me.userId);
  const ownDone = own.filter((t) => t.done_at).length;
  const late = open.filter((t) => taskState(t, today) === "atrasada").length;

  const list = (rows: TaskRowData[]) => (
    <ul className="divide-y divide-line">
      {rows.map((t) => (
        <TaskRow key={t.id} t={t} me={me} today={today} showPerson={t.profile_id !== me.userId || all} linkPerson={t.profile_id !== me.userId} />
      ))}
    </ul>
  );

  return (
    <>
      <PageHeader
        eyebrow="Integração"
        icon={ListChecks}
        title="Minhas tarefas"
        description={
          open.length
            ? `${open.length} ${open.length === 1 ? "tarefa aberta" : "tarefas abertas"}${late ? `, ${late} ${late === 1 ? "atrasada" : "atrasadas"}` : ""}.`
            : "Tarefas do checklist de integração que estão com você."
        }
      />

      {rh && (
        <div role="tablist" aria-label="Quais tarefas" className="flex gap-1.5">
          {(
            [
              ["minhas", "Com você"],
              ["todas", "Todas as pessoas"],
            ] as const
          ).map(([k, label]) => {
            const on = (k === "todas") === all;
            return (
              <Link
                key={k}
                role="tab"
                aria-selected={on}
                href={k === "todas" ? "/tarefas?ver=todas" : "/tarefas"}
                className={cx("rounded-lg px-3 py-1.5 text-[13px] font-medium", on ? "bg-accent-soft text-heading" : "text-muted hover:bg-sunken hover:text-ink")}
              >
                {label}
              </Link>
            );
          })}
        </div>
      )}

      {own.length > 0 && !all && (
        <Card
          title="Seu checklist de integração"
          description={`${ownDone} de ${own.length} tarefas feitas. As suas você marca aqui; as outras ficam com o RH, o seu supervisor ou outra pessoa.`}
          icon={ListChecks}
          flush
        >
          <div className="px-5 pb-1">
            <div className="h-2 overflow-hidden rounded-full bg-sunken" role="progressbar" aria-label="Progresso do checklist" aria-valuemin={0} aria-valuemax={own.length} aria-valuenow={ownDone}>
              <div className="h-full rounded-full bg-ok transition-all" style={{ width: `${Math.round((ownDone / own.length) * 100)}%` }} />
            </div>
          </div>
          <ul className="divide-y divide-line">
            {own
              .slice()
              .sort((a, b) => a.position - b.position)
              .map((t) => (
                <TaskRow key={t.id} t={t} me={me} today={today} showPerson={false} />
              ))}
          </ul>
        </Card>
      )}

      {open.length === 0 ? (
        <Card>
          <EmptyState icon={ListChecks} title={all ? "Nenhuma tarefa aberta" : "Nada pendente com você"}>
            {all ? "Todas as tarefas dos checklists estão feitas." : "Quando alguém precisar de você num checklist de integração, a tarefa aparece aqui."}
          </EmptyState>
        </Card>
      ) : (
        GROUPS.map((g) => {
          const rows = open.filter((t) => taskState(t, today) === g.key && (all || t.profile_id !== me.userId || own.length === 0));
          if (!rows.length) return null;
          return (
            <Card key={g.key} title={`${g.label} · ${rows.length}`} flush>
              {list(rows)}
            </Card>
          );
        })
      )}

      {done.length > 0 && (
        <details className="group rounded-2xl border border-line bg-surface">
          <summary className="cursor-pointer list-none px-5 py-3.5 text-[14px] font-semibold text-heading">
            Feitas nos últimos 30 dias · {done.length}
          </summary>
          {list(done)}
        </details>
      )}
    </>
  );
}
