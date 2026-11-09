"use client";

import { CalendarDays } from "lucide-react";
import { useActionState, useEffect, useRef, useState } from "react";
import { NoticeDialog } from "@/components/forms";
import type { ActionState } from "@/lib/action-state";
import { updateTaskDue } from "./actions";

/** RH: troca o prazo da tarefa num calendário pequeno. */
export function DueEditor({ id, due }: { id: string; due: string | null }) {
  const [state, action, pending] = useActionState(updateTaskDue, {} as ActionState);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.error) setError(state.error);
    if (state.ok) setOpen(false);
  }, [state]);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Mudar o prazo"
        title="Mudar o prazo"
        className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-sunken hover:text-ink"
      >
        <CalendarDays size={15} aria-hidden />
      </button>
    );
  }
  return (
    <form ref={form} action={action} className="flex items-center gap-1">
      <input type="hidden" name="id" value={id} />
      <label className="sr-only" htmlFor={`due-${id}`}>
        Novo prazo
      </label>
      <input
        id={`due-${id}`}
        type="date"
        name="due_date"
        defaultValue={due ?? ""}
        autoFocus
        disabled={pending}
        onChange={() => form.current?.requestSubmit()}
        onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
        className="h-8 rounded-lg border border-line bg-surface px-2 text-[12.5px]"
      />
      {error && <NoticeDialog tone="danger" message={error} onClose={() => setError(null)} />}
    </form>
  );
}
