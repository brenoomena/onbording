"use client";

import { ArrowRightLeft, LibraryBig, Route } from "lucide-react";
import { useRouter } from "next/navigation";
import { startTransition, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { announce } from "@/components/forms";
import { buttonVariants, cx, iconButtonClass, Select } from "@/components/ui";
import type { ActionState } from "@/lib/action-state";
import { moveContent } from "./actions";

export interface MoveTrackOption {
  id: string;
  name: string;
  status: string;
}

/**
 * "Mover de trilha": escolhe a trilha de destino (ou a Biblioteca) numa
 * janela. O conteúdo sai dos módulos da trilha atual; nunca fica em duas.
 */
export function MoveContent({
  contentId,
  contentTitle,
  currentTrackId,
  currentTrackName,
  modulesCount,
  tracks,
  iconOnly = false,
}: {
  contentId: string;
  contentTitle: string;
  currentTrackId: string | null;
  currentTrackName: string | null;
  /** Em quantos módulos da trilha atual o conteúdo está. */
  modulesCount: number;
  tracks: MoveTrackOption[];
  iconOnly?: boolean;
}) {
  const [pending, setPending] = useState(false);
  const [target, setTarget] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  const titleId = useId();
  const selectId = useId();
  // A janela vai para o fim da página: este botão fica dentro do formulário
  // do conteúdo, e formulário dentro de formulário não é permitido.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const options = tracks.filter((t) => t.id !== currentTrackId && t.status !== "arquivado");

  // O aviso sai pelo NoticeHost: depois de mover, a linha pode mudar de grupo
  // na lista e este componente deixar de existir.
  async function submit(fd: FormData) {
    setPending(true);
    let res: ActionState;
    try {
      res = await moveContent({}, fd);
    } catch {
      res = { error: "Não foi possível mover o conteúdo. Tente de novo." };
    }
    setPending(false);
    if (res.ok) {
      dialog.current?.close();
      setTarget("");
      announce("ok", res.ok);
      startTransition(() => router.refresh());
    } else if (res.error) {
      announce("danger", res.error);
    }
  }

  const open = () => {
    setTarget("");
    dialog.current?.showModal();
  };
  const destName = target === "biblioteca" ? "Biblioteca" : options.find((o) => o.id === target)?.name;

  return (
    <>
      {iconOnly ? (
        <button type="button" onClick={open} title="Mover de trilha" aria-label="Mover de trilha" className={iconButtonClass("neutral")}>
          <ArrowRightLeft size={16} strokeWidth={1.9} aria-hidden />
        </button>
      ) : (
        <button type="button" onClick={open} className={cx(buttonVariants.secondary, "py-2 text-[13px]")}>
          <ArrowRightLeft size={15} aria-hidden /> Mover de trilha
        </button>
      )}
      {mounted && createPortal(<dialog
        ref={dialog}
        aria-labelledby={titleId}
        onClick={(e) => e.target === dialog.current && !pending && dialog.current?.close()}
        className="m-auto w-[min(480px,calc(100vw-2rem))] rounded-2xl border border-line bg-surface p-0 text-ink shadow-[0_18px_50px_rgba(0,0,0,0.25)] backdrop:bg-ink/50 backdrop:backdrop-blur-[1px]"
      >
        <form
          className="grid gap-4 p-5"
          onSubmit={(e) => {
            e.preventDefault();
            // A janela fica fora do formulário no HTML, mas os eventos do React
            // ainda sobem até ele: sem isto, "Mover" também enviaria o conteúdo.
            e.stopPropagation();
            void submit(new FormData(e.currentTarget));
          }}
        >
          <input type="hidden" name="id" value={contentId} />
          <div className="flex items-start gap-3">
            <span aria-hidden className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-icon-bg text-icon">
              <ArrowRightLeft size={17} />
            </span>
            <div className="grid min-w-0 gap-1">
              <h2 id={titleId} className="text-[16px] font-semibold">Mover de trilha</h2>
              <p className="text-[13.5px] text-muted">
                <span className="font-medium text-ink">{contentTitle}</span> está em{" "}
                <span className="inline-flex items-center gap-1 font-medium text-ink">
                  {currentTrackId ? <Route size={13} aria-hidden /> : <LibraryBig size={13} aria-hidden />}
                  {currentTrackId ? currentTrackName ?? "outra trilha" : "Biblioteca (sem trilha)"}
                </span>
                . Um conteúdo pertence a uma única trilha.
              </p>
            </div>
          </div>

          <div className="grid gap-1.5">
            <label htmlFor={selectId} className="text-[13px] font-medium">Mover para</label>
            <Select id={selectId} name="track_id" value={target} onChange={(e) => setTarget(e.target.value)} required>
              <option value="" disabled>Escolha a trilha de destino</option>
              {options.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                  {t.status !== "publicado" ? " (rascunho)" : ""}
                </option>
              ))}
              {currentTrackId && <option value="biblioteca">Biblioteca (sem trilha)</option>}
            </Select>
          </div>

          {target && (
            <div className="rounded-lg border border-warn/30 bg-warn-soft px-3.5 py-2.5 text-[13px] text-warn">
              {modulesCount > 0 ? (
                <>
                  O conteúdo sai {modulesCount === 1 ? "do módulo" : `dos ${modulesCount} módulos`} de <strong>{currentTrackName}</strong> e passa a
                  pertencer a <strong>{destName}</strong>. O progresso já registrado pelos colaboradores é mantido.
                </>
              ) : (
                <>
                  O conteúdo passa a pertencer a <strong>{destName}</strong>
                  {currentTrackId ? <> e deixa de estar disponível para os módulos de <strong>{currentTrackName}</strong></> : null}.
                </>
              )}
              {target !== "biblioteca" && " Depois, inclua-o num módulo da nova trilha."}
            </div>
          )}

          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => dialog.current?.close()} disabled={pending} className={buttonVariants.secondary}>
              Cancelar
            </button>
            <PendingSubmit pending={pending} disabled={!target} />
          </div>
        </form>
      </dialog>, document.body)}
    </>
  );
}

function PendingSubmit({ pending, disabled }: { pending: boolean; disabled: boolean }) {
  return (
    <button type="submit" disabled={pending || disabled} className={buttonVariants.primary}>
      <ArrowRightLeft size={15} aria-hidden /> {pending ? "Movendo…" : "Mover"}
    </button>
  );
}

