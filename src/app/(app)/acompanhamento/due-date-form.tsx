"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ActionForm, NoticeDialog, SubmitButton } from "@/components/forms";
import { Input } from "@/components/ui";
import type { ActionState } from "@/lib/action-state";
import { ajustarPrazo } from "./actions";

/**
 * Ajuste rápido do prazo de uma matrícula, direto na lista de atenção.
 * Mostra o aviso e, quando ele fecha, atualiza a lista (a linha pode sair).
 */
export function DueDateForm({ id, value, label }: { id: string; value: string | null; label: string }) {
  const router = useRouter();
  const [saved, setSaved] = useState<string | null>(null);
  const action = async (state: ActionState, fd: FormData): Promise<ActionState> => {
    const res = await ajustarPrazo(state, fd);
    if (res.ok) {
      setSaved(res.ok);
      return {};
    }
    return res;
  };
  return (
    <>
      <ActionForm action={action} className="!flex flex-nowrap items-center gap-1.5">
        <input type="hidden" name="id" value={id} />
        <Input type="date" name="due_date" defaultValue={value ?? ""} aria-label={label} className="w-[142px] py-1 text-[13px]" />
        <SubmitButton variant="secondary" className="px-2.5 py-1 text-[12.5px]" pendingLabel="…">
          Salvar
        </SubmitButton>
      </ActionForm>
      {saved && (
        <NoticeDialog
          tone="ok"
          message={saved}
          duration={1800}
          onClose={() => {
            setSaved(null);
            router.refresh();
          }}
        />
      )}
    </>
  );
}
