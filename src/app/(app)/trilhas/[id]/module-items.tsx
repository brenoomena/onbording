"use client";

import { ArrowDown, ArrowUp, GripVertical, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { startTransition, useEffect, useState } from "react";
import { ActionButton, NoticeDialog } from "@/components/forms";
import { Badge, cx } from "@/components/ui";
import { KIND_LABEL, PUBLISH_LABEL, type TrackItem } from "@/lib/learning";
import { KIND_TAG, PUBLISH_TAG } from "@/lib/tags";
import { moveItem, removeItem, reorderItem, toggleRequired } from "../actions";

/**
 * Conteúdos de um módulo: arrastar pela alça muda a ordem; as setas fazem o
 * mesmo pelo teclado e no celular.
 */
export function ModuleItems({ trackId, items, canEdit }: { trackId: string; items: TrackItem[]; canEdit: boolean }) {
  const router = useRouter();
  const signature = items.map((i) => i.id).join(",");
  const [order, setOrder] = useState<string[] | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => setOrder(null), [signature]);
  const list = (order ?? items.map((i) => i.id)).map((id) => items.find((i) => i.id === id)).filter(Boolean) as TrackItem[];
  const draggable = canEdit && list.length > 1;

  const drop = (targetId: string) => {
    const from = list.findIndex((i) => i.id === dragging);
    const to = list.findIndex((i) => i.id === targetId);
    setDragging(null);
    setOver(null);
    if (from < 0 || to < 0 || from === to) return;
    const next = list.map((i) => i.id);
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setOrder(next);
    const fd = new FormData();
    fd.set("id", moved);
    fd.set("steps", String(to - from));
    fd.set("track_id", trackId);
    startTransition(async () => {
      const res = await reorderItem({}, fd);
      if (res.error) {
        setOrder(null);
        setError(res.error);
      }
      router.refresh();
    });
  };

  if (list.length === 0) return <p className="px-5 py-4 text-[13px] text-muted">Nenhum conteúdo neste módulo ainda.</p>;

  return (
    <>
      {error && <NoticeDialog tone="danger" message={error} onClose={() => setError(null)} />}
      <ol className="divide-y divide-line">
        {list.map((it, ii) => (
          <li
            key={it.id}
            draggable={draggable}
            onDragStart={(e) => {
              setDragging(it.id);
              e.dataTransfer.effectAllowed = "move";
              e.dataTransfer.setData("text/plain", it.id);
            }}
            onDragOver={(e) => {
              if (!dragging) return;
              e.preventDefault();
              setOver(it.id);
            }}
            onDragLeave={() => setOver((o) => (o === it.id ? null : o))}
            onDrop={(e) => {
              e.preventDefault();
              drop(it.id);
            }}
            onDragEnd={() => {
              setDragging(null);
              setOver(null);
            }}
            className={cx(
              "flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 sm:px-5",
              dragging === it.id && "opacity-50",
              over === it.id && dragging !== it.id && "bg-accent-soft/60 shadow-[inset_0_2px_0_rgb(var(--brand))]",
            )}
          >
            {draggable && <GripVertical size={15} aria-hidden className="shrink-0 cursor-grab text-muted/70" />}
            <span className="w-5 shrink-0 text-right font-mono text-[12px] text-muted">{ii + 1}</span>
            <Badge tag={KIND_TAG[it.content.kind]}>{KIND_LABEL[it.content.kind]}</Badge>
            <div className="min-w-0 flex-[1_1_220px]">
              <Link href={`/conteudos/${it.content.id}`} className="text-[14px] font-medium hover:text-accent">
                {it.content.title}
              </Link>
              <p className="flex flex-wrap items-center gap-1.5 text-[12px] text-muted">
                {it.content.estimated_minutes ? <span>{it.content.estimated_minutes} min</span> : null}
                {it.content.external_platform && <span>· {it.content.external_platform}</span>}
                {it.content.status !== "publicado" && <Badge tag={PUBLISH_TAG[it.content.status]}>{PUBLISH_LABEL[it.content.status]}</Badge>}
              </p>
            </div>
            {canEdit ? (
              <div className="flex flex-wrap items-center gap-1">
                <ActionButton
                  action={toggleRequired}
                  hidden={{ id: it.id, value: String(!it.is_required), track_id: trackId }}
                  label={it.is_required ? "Obrigatório" : "Opcional"}
                  variant={it.is_required ? "secondary" : "ghost"}
                  pendingLabel="…"
                />
                {ii > 0 && <ActionButton action={moveItem} hidden={{ id: it.id, direction: "-1", track_id: trackId }} label="Subir" icon={<ArrowUp size={16} aria-hidden />} iconOnly />}
                {ii < list.length - 1 && <ActionButton action={moveItem} hidden={{ id: it.id, direction: "1", track_id: trackId }} label="Descer" icon={<ArrowDown size={16} aria-hidden />} iconOnly />}
                <ActionButton
                  action={removeItem}
                  hidden={{ id: it.id, track_id: trackId }}
                  label="Remover do módulo"
                  variant="danger"
                  icon={<X size={16} aria-hidden />}
                  iconOnly
                  confirm
                  confirmLabel="Remover"
                  confirmText="O conteúdo sai deste módulo, mas continua cadastrado nesta trilha."
                />
              </div>
            ) : (
              <Badge tag={it.is_required ? "trilha.etapa_obrigatoria" : "trilha.etapa_opcional"}>{it.is_required ? "Obrigatório" : "Opcional"}</Badge>
            )}
          </li>
        ))}
      </ol>
    </>
  );
}
