import { Trash2 } from "lucide-react";
import Link from "next/link";
import { ActionButton } from "@/components/forms";
import { Badge, cx, formatDate, formatDateTime } from "@/components/ui";
import type { CurrentUser } from "@/lib/auth";
import { TASK_STATE_LABEL, taskState } from "@/lib/checklist";
import { P } from "@/lib/permissions";
import type { TagKey } from "@/lib/tag-catalog";
import { canHandle, responsibleText, type TaskRowData } from "@/lib/tasks-server";
import { deleteTask } from "./actions";
import { DueEditor } from "./due-editor";
import { TaskCheck } from "./task-check";

/** Uma tarefa: marcar, nome, pessoa, responsável e prazo. */
export function TaskRow({
  t,
  me,
  today,
  showPerson = true,
  linkPerson = false,
}: {
  t: TaskRowData;
  me: CurrentUser;
  today: string;
  showPerson?: boolean;
  linkPerson?: boolean;
}) {
  const state = taskState(t, today);
  const rh = me.permissions.has(P.checklistsGerenciar);
  const person = t.person?.full_name ?? "—";
  return (
    <li className="flex items-start gap-3 px-4 py-3 sm:px-5">
      <span className="pt-0.5">
        <TaskCheck id={t.id} profileId={t.profile_id} done={!!t.done_at} title={t.title} disabled={!canHandle(t, me)} />
      </span>
      <div className="min-w-0 flex-1">
        <p className={cx("text-[14px] font-medium", t.done_at ? "text-muted line-through decoration-muted/60" : "text-heading")}>{t.title}</p>
        {t.description && <p className="mt-0.5 whitespace-pre-line text-[12.5px] text-muted">{t.description}</p>}
        <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-muted">
          {showPerson && (
            <span>
              {linkPerson ? (
                <Link href={`/colaboradores/${t.profile_id}`} className="font-medium text-ink hover:text-accent hover:underline">
                  {person}
                </Link>
              ) : (
                <strong className="font-medium text-ink">{person}</strong>
              )}
              {t.checklist && <> · {t.checklist.name}</>}
            </span>
          )}
          <span>Responsável: {responsibleText(t)}</span>
          {t.done_at ? (
            <span>
              Feita em {formatDateTime(t.done_at)}
              {t.doneBy && t.doneBy.id !== me.userId ? ` por ${t.doneBy.full_name}` : ""}
            </span>
          ) : (
            t.due_date && <span>Prazo: {formatDate(t.due_date)}</span>
          )}
        </p>
        {t.note && <p className="mt-1 rounded-md bg-sunken px-2 py-1 text-[12.5px] text-ink">{t.note}</p>}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1.5 sm:flex-row sm:items-center">
        <Badge tag={`tarefa.${state}` as TagKey}>{TASK_STATE_LABEL[state]}</Badge>
        {rh && !t.done_at && <DueEditor id={t.id} due={t.due_date} />}
        {rh && (
          <ActionButton
            action={deleteTask}
            hidden={{ id: t.id }}
            label="Excluir tarefa"
            variant="danger"
            icon={<Trash2 size={15} aria-hidden />}
            iconOnly
            confirm
            confirmLabel="Excluir"
            confirmText={`A tarefa “${t.title}” sai do checklist de ${person}.`}
          />
        )}
      </div>
    </li>
  );
}
