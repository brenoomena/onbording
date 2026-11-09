"use client";

import { MessageSquareHeart, Pencil } from "lucide-react";
import { useState } from "react";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Stars, StarInput } from "@/components/stars";
import { Textarea, buttonVariants, cx } from "@/components/ui";
import { CONTENT_COMMENT_MAX, RATING_LABEL, TRACK_COMMENT_MAX } from "@/lib/feedback";
import { submitContentFeedback, submitTrackFeedback } from "./actions";

export interface MyFeedback {
  rating: number;
  comment: string | null;
  anonymous: boolean;
}

/**
 * Avaliação de uma trilha concluída (cartão em destaque) ou de um conteúdo
 * (versão compacta). Já avaliado: mostra a nota e permite alterar.
 */
export function FeedbackForm({
  target,
  id,
  name,
  mine,
  highlight = false,
}: {
  target: "trilha" | "conteudo";
  id: string;
  name: string;
  mine: MyFeedback | null;
  /** Veio do convite do sininho: abre o formulário em destaque. */
  highlight?: boolean;
}) {
  const [editing, setEditing] = useState(!mine);
  const isTrack = target === "trilha";
  const max = isTrack ? TRACK_COMMENT_MAX : CONTENT_COMMENT_MAX;

  if (mine && !editing) {
    return (
      <section
        id="avaliacao"
        aria-label={isTrack ? "Sua avaliação da trilha" : "Sua avaliação do conteúdo"}
        className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3"
      >
        <span className="text-[13px] text-muted">{isTrack ? "Sua avaliação da trilha" : "Sua avaliação"}</span>
        <Stars value={mine.rating} size={18} />
        <span className="text-[13px] font-medium text-heading">{RATING_LABEL[mine.rating]}</span>
        {mine.comment && <span className="min-w-0 flex-1 truncate text-[13px] text-muted">“{mine.comment}”</span>}
        <button type="button" onClick={() => setEditing(true)} className={cx(buttonVariants.ghost, "ml-auto gap-1.5")}>
          <Pencil size={14} aria-hidden /> Alterar
        </button>
      </section>
    );
  }

  return (
    <section
      id="avaliacao"
      aria-label={isTrack ? "Avaliar a trilha" : "Avaliar o conteúdo"}
      className={cx(
        "rounded-xl border px-4 py-4 sm:px-5",
        isTrack ? "border-tag-gold/40 bg-tag-gold-soft/50" : "border-line bg-surface",
        highlight && "ring-2 ring-tag-gold/50",
      )}
    >
      <div className="mb-3 flex items-start gap-3">
        {isTrack && (
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-surface text-tag-gold">
            <MessageSquareHeart size={20} aria-hidden />
          </span>
        )}
        <div>
          <h2 className="text-[14px] font-semibold text-heading">{isTrack ? `Como foi a trilha ${name}?` : "O que achou deste conteúdo?"}</h2>
          <p className="text-[12.5px] text-muted">
            {isTrack ? "Sua opinião ajuda o RH a melhorar as próximas trilhas. Leva menos de um minuto." : "Opcional: ajuda a melhorar o material."}
          </p>
        </div>
      </div>
      <ActionForm action={isTrack ? submitTrackFeedback : submitContentFeedback} className="gap-3">
        {(state) => (
          <>
            <input type="hidden" name={isTrack ? "track_id" : "content_id"} value={id} />
            <StarInput defaultValue={mine?.rating ?? 0} size={isTrack ? 30 : 24} label={isTrack ? "Nota da trilha" : "Nota do conteúdo"} />
            {state.fieldErrors?.rating && <p className="text-[12.5px] text-danger">{state.fieldErrors.rating}</p>}
            <label className="grid gap-1.5">
              <span className="text-[13px] font-medium text-heading">Comentário <span className="font-normal text-muted">(opcional)</span></span>
              <Textarea
                name="comment"
                rows={isTrack ? 3 : 2}
                maxLength={max}
                defaultValue={mine?.comment ?? ""}
                placeholder={isTrack ? "O que funcionou bem? O que poderia melhorar?" : "Algo a elogiar ou melhorar?"}
              />
            </label>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <label className="flex cursor-pointer items-center gap-2 text-[13px]">
                <input type="checkbox" name="anonymous" defaultChecked={mine?.anonymous ?? false} className="h-4 w-4 accent-[rgb(var(--brand))]" />
                Enviar sem meu nome para o RH
              </label>
              <div className="flex gap-2">
                {mine && (
                  <button type="button" onClick={() => setEditing(false)} className={buttonVariants.ghost}>
                    Cancelar
                  </button>
                )}
                <SubmitButton pendingLabel="Enviando…">{mine ? "Salvar avaliação" : "Enviar avaliação"}</SubmitButton>
              </div>
            </div>
          </>
        )}
      </ActionForm>
    </section>
  );
}
