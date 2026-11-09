"use client";

import { Check } from "lucide-react";
import { useActionState, useEffect, useOptimistic, useState, useTransition } from "react";
import { NoticeDialog } from "@/components/forms";
import { cx } from "@/components/ui";
import type { ActionState } from "@/lib/action-state";
import { toggleTask } from "./actions";

/** Caixa de marcar da tarefa: marca na hora e confirma no servidor. */
export function TaskCheck({ id, profileId, done, title, disabled = false }: { id: string; profileId: string; done: boolean; title: string; disabled?: boolean }) {
  const [state, action] = useActionState(toggleTask, {} as ActionState);
  const [shown, setShown] = useOptimistic(done);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  useEffect(() => setError(state.error ?? null), [state]);
  const label = shown ? `Reabrir a tarefa “${title}”` : `Marcar “${title}” como feita`;

  if (disabled) {
    return (
      <span
        role="img"
        aria-label={done ? "Feita" : "Pendente (outra pessoa marca)"}
        title={done ? "Feita" : "Outra pessoa é responsável por esta tarefa"}
        className={cx(
          "grid h-6 w-6 shrink-0 place-items-center rounded-md border",
          done ? "border-ok bg-ok text-white" : "border-dashed border-muted/50 bg-sunken/60",
        )}
      >
        {done && <Check size={15} strokeWidth={3} aria-hidden />}
      </span>
    );
  }

  return (
    <span className="inline-grid shrink-0">
      <button
        type="button"
        aria-pressed={shown}
        aria-label={label}
        title={label}
        disabled={pending}
        onClick={() => {
          const fd = new FormData();
          fd.set("id", id);
          fd.set("profile_id", profileId);
          fd.set("done", shown ? "0" : "1");
          start(async () => {
            setShown(!shown);
            await action(fd);
          });
        }}
        className={cx(
          "grid h-6 w-6 place-items-center rounded-md border-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand",
          shown ? "border-ok bg-ok text-white" : "border-muted/60 bg-surface hover:border-accent",
        )}
      >
        {shown && <Check size={15} strokeWidth={3} aria-hidden />}
      </button>
      {error && <NoticeDialog tone="danger" message={error} onClose={() => setError(null)} />}
    </span>
  );
}
