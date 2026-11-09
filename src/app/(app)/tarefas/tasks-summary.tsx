import { ListChecks } from "lucide-react";
import Link from "next/link";
import { Badge, Card } from "@/components/ui";
import type { CurrentUser } from "@/lib/auth";
import { taskState, todaySP } from "@/lib/checklist";
import { isMine, loadTasks } from "@/lib/tasks-server";

/** Painel: tarefas de integração que estão com a pessoa e o próprio checklist. */
export async function TasksSummary({ me }: { me: CurrentUser }) {
  const tasks = await loadTasks({});
  const today = todaySP();
  const open = tasks.filter((t) => !t.done_at && isMine(t, me));
  const own = tasks.filter((t) => t.profile_id === me.userId);
  if (!open.length && !own.length) return null;
  const late = open.filter((t) => taskState(t, today) === "atrasada").length;
  const forToday = open.filter((t) => taskState(t, today) === "hoje").length;
  const ownDone = own.filter((t) => t.done_at).length;
  const next = open
    .slice()
    .sort((a, b) => (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999"))
    .slice(0, 4);

  return (
    <Card
      title="Tarefas de integração"
      icon={ListChecks}
      actions={
        <Link href="/tarefas" className="text-[13px] font-semibold text-accent hover:underline">
          Ver todas →
        </Link>
      }
    >
      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <div className="grid content-start gap-3">
          {own.length > 0 && (
            <div>
              <p className="text-[12.5px] text-muted">Seu checklist</p>
              <p className="text-[22px] font-semibold tabular-nums text-heading">
                {ownDone}/{own.length} <span className="text-[13px] font-normal text-muted">feitas</span>
              </p>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-sunken">
                <div className="h-full rounded-full bg-ok" style={{ width: `${Math.round((ownDone / own.length) * 100)}%` }} />
              </div>
            </div>
          )}
          <p className="flex flex-wrap gap-1.5">
            <Badge tag="tarefa.proxima">{open.length} com você</Badge>
            {forToday > 0 && <Badge tag="tarefa.hoje">{forToday} para hoje</Badge>}
            {late > 0 && <Badge tag="tarefa.atrasada">{late} atrasada{late === 1 ? "" : "s"}</Badge>}
          </p>
        </div>
        {next.length > 0 && (
          <ul className="grid gap-1.5 text-[13.5px]">
            {next.map((t) => {
              const s = taskState(t, today);
              return (
                <li key={t.id} className="flex items-center justify-between gap-2 rounded-lg bg-sunken/60 px-3 py-2">
                  <span className="min-w-0 truncate">
                    <span className="font-medium text-heading">{t.title}</span>
                    {t.profile_id !== me.userId && <span className="text-muted"> · {t.person?.full_name}</span>}
                  </span>
                  <span className={s === "atrasada" ? "shrink-0 text-[12px] font-semibold text-danger" : s === "hoje" ? "shrink-0 text-[12px] font-semibold text-warn" : "shrink-0 text-[12px] text-muted"}>
                    {s === "atrasada" ? "Atrasada" : s === "hoje" ? "Hoje" : t.due_date ? t.due_date.split("-").reverse().slice(0, 2).join("/") : "Sem prazo"}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Card>
  );
}
