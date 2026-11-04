"use client";

import { ArrowDown } from "lucide-react";
import { useEffect, useState } from "react";
import { Markdown } from "@/components/markdown";
import { Alert, buttonVariants, cx } from "@/components/ui";
import { embedUrl, isVideoEmbed, type ContentRow } from "@/lib/learning";

export type ViewerContent = Pick<
  ContentRow,
  "id" | "title" | "kind" | "body" | "url" | "mime_type" | "file_name" | "file_size" | "external_platform" | "access_note"
>;

/**
 * Link que abre o material fora da plataforma (nova aba), quando existir.
 * Arquivos enviados à plataforma não têm: ficam só para ver aqui, sem baixar.
 */
export function externalHref(content: ViewerContent): string | null {
  return content.kind === "arquivo" ? null : content.url;
}

const noMenu = (e: { preventDefault: () => void }) => e.preventDefault();

/**
 * Mostra o conteúdo no próprio lugar: texto, vídeo, prévia de arquivos do
 * Google Drive/Docs, PDF, imagem, áudio e vídeo enviados. Links de sites que
 * não permitem incorporação aparecem como cartão com botão para abrir.
 * Funciona tanto na página de estudo quanto dentro da janela de materiais.
 */
export function ContentViewer({
  content,
  fileUrl,
  fill = false,
}: {
  content: ViewerContent;
  fileUrl: string | null;
  /** Ocupa a altura disponível (janela); senão usa alturas fixas (página). */
  fill?: boolean;
}) {
  const tall = fill ? "h-[62dvh] min-h-[320px]" : "h-[75vh]";
  const embed = content.kind === "video" || content.kind === "link" ? embedUrl(content.url) : null;

  if (content.kind === "texto" && content.body) {
    return <Markdown>{content.body}</Markdown>;
  }

  if (embed) {
    const video = isVideoEmbed(embed);
    return (
      <div className={cx("flex flex-col gap-3", fill && "h-full")}>
        {content.access_note && <AccessNote note={content.access_note} />}
        <div className={cx("w-full max-w-full overflow-hidden rounded-lg bg-sunken", video ? "aspect-video" : tall)}>
          <iframe
            src={embed}
            title={content.title}
            className="h-full w-full"
            allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
            allowFullScreen
          />
        </div>
      </div>
    );
  }

  if (content.kind === "video") {
    return (
      <a href={content.url ?? "#"} target="_blank" rel="noopener noreferrer" className={buttonVariants.primary + " w-fit"}>
        Assistir ao vídeo ↗
      </a>
    );
  }

  if (content.kind === "link") {
    return (
      <div className="grid max-w-2xl gap-4">
        <p className="text-[14px]">
          Este conteúdo fica{" "}
          {content.external_platform ? (
            <>
              na plataforma <span className="font-semibold">{content.external_platform}</span>
            </>
          ) : (
            "em outro site"
          )}{" "}
          e abre em uma nova aba.
        </p>
        {content.access_note && <AccessNote note={content.access_note} />}
        <a href={content.url ?? "#"} target="_blank" rel="noopener noreferrer" className={buttonVariants.primary + " w-fit"}>
          Abrir {content.external_platform ?? "conteúdo"} ↗
        </a>
      </div>
    );
  }

  // Arquivo enviado: só visualização, sem botão de baixar.
  if (!fileUrl) return <Alert>Não foi possível carregar o arquivo. Atualize a página.</Alert>;
  const mime = content.mime_type ?? "";
  return (
    <div className={cx("flex flex-col gap-3", fill && "h-full")} onContextMenu={noMenu}>
      {mime === "application/pdf" ? (
        <iframe src={`${fileUrl}#toolbar=0&navpanes=0`} title={content.title} className={cx("w-full rounded-lg border border-line", tall)} />
      ) : mime.startsWith("image/") ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={fileUrl} alt={content.title} draggable={false} className="mx-auto max-h-[75vh] max-w-full select-none rounded-lg object-contain" />
      ) : mime.startsWith("video/") ? (
        <video src={fileUrl} controls controlsList="nodownload noremoteplayback" disablePictureInPicture className="mx-auto max-h-[75vh] w-full max-w-full rounded-lg" />
      ) : mime.startsWith("audio/") ? (
        <audio src={fileUrl} controls controlsList="nodownload" className="w-full" />
      ) : (
        <Alert>Este tipo de arquivo não pode ser exibido na plataforma. Peça ao responsável para enviá-lo em PDF, imagem ou vídeo.</Alert>
      )}
    </div>
  );
}

/** Objetivo e orientações do conteúdo, mostrado logo abaixo do conteúdo central. */
export function ObjectiveNote({ text, id }: { text: string; id?: string }) {
  return (
    <section id={id} aria-label="Objetivo e orientações" className="scroll-mt-24 rounded-xl border border-line bg-surface px-5 py-4">
      <h2 className="mb-1.5 text-[13px] font-semibold uppercase tracking-[0.05em] text-muted">Objetivo e orientações</h2>
      <Markdown size="sm">{text}</Markdown>
    </section>
  );
}

function AccessNote({ note }: { note: string }) {
  return (
    <div className="rounded-lg border border-accent/30 bg-accent-soft px-4 py-3 text-[14px]">
      <p className="font-semibold">Como acessar</p>
      <Markdown size="sm" className="mt-1 break-words">{note}</Markdown>
    </div>
  );
}

/**
 * Aviso flutuante "Objetivo e orientações ↓": aparece preso ao rodapé da tela
 * só enquanto a seção alvo está abaixo da área visível; some quando ela entra
 * na tela. Fica logo antes da seção (posição sticky), então acompanha a
 * largura da coluna de conteúdo. Clicar rola suavemente até a seção.
 */
export function ObjectiveHint({ targetId }: { targetId: string }) {
  const [below, setBelow] = useState(false);
  useEffect(() => {
    const el = document.getElementById(targetId);
    if (!el) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const io = new IntersectionObserver(
      ([e]) => {
        clearTimeout(timer);
        const hidden = !e.isIntersecting && e.boundingClientRect.top > 0;
        // Pequena espera ao aparecer, para não piscar durante o carregamento.
        if (hidden) timer = setTimeout(() => setBelow(true), 500);
        else setBelow(false);
      },
      { rootMargin: "0px 0px -40px 0px" },
    );
    io.observe(el);
    return () => {
      clearTimeout(timer);
      io.disconnect();
    };
  }, [targetId]);

  return (
    <div className="pointer-events-none sticky bottom-5 z-10 -mt-6 flex h-0 items-start justify-center">
      <button
        type="button"
        tabIndex={below ? 0 : -1}
        aria-hidden={!below}
        onClick={() => document.getElementById(targetId)?.scrollIntoView({ behavior: "smooth", block: "start" })}
        className={cx(
          "group flex -translate-y-full items-center gap-2 rounded-full border border-line bg-surface/90 py-1.5 pl-3.5 pr-1.5 text-[12.5px] font-medium text-ink shadow-[0_8px_24px_rgba(0,0,0,0.12)] backdrop-blur transition-all duration-300 hover:border-brand/50 hover:shadow-[0_10px_28px_rgba(0,0,0,0.16)]",
          below ? "pointer-events-auto opacity-100" : "translate-y-0 opacity-0",
        )}
      >
        Objetivo e orientações
        <span aria-hidden className="grid h-6 w-6 place-items-center rounded-full bg-brand text-on-brand">
          <ArrowDown size={14} strokeWidth={2.4} className="hint-bob" />
        </span>
      </button>
    </div>
  );
}
