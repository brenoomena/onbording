import { Markdown } from "@/components/markdown";
import { Alert, buttonVariants, cx } from "@/components/ui";
import { embedUrl, formatBytes, isVideoEmbed, type ContentRow } from "@/lib/learning";

export type ViewerContent = Pick<
  ContentRow,
  "id" | "title" | "kind" | "body" | "url" | "mime_type" | "file_name" | "file_size" | "external_platform" | "access_note"
>;

/** Link que abre o material fora da plataforma (nova aba), quando existir. */
export function externalHref(content: ViewerContent, fileUrl: string | null): string | null {
  return content.kind === "arquivo" ? fileUrl : content.url;
}

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

  // Arquivo enviado
  if (!fileUrl) return <Alert>Não foi possível carregar o arquivo. Atualize a página.</Alert>;
  const mime = content.mime_type ?? "";
  return (
    <div className={cx("flex flex-col gap-3", fill && "h-full")}>
      {mime === "application/pdf" ? (
        <iframe src={fileUrl} title={content.title} className={cx("w-full rounded-lg border border-line", tall)} />
      ) : mime.startsWith("image/") ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={fileUrl} alt={content.title} className="mx-auto max-h-[75vh] max-w-full rounded-lg object-contain" />
      ) : mime.startsWith("video/") ? (
        <video src={fileUrl} controls className="mx-auto max-h-[75vh] w-full max-w-full rounded-lg" />
      ) : mime.startsWith("audio/") ? (
        <audio src={fileUrl} controls className="w-full" />
      ) : (
        <p className="text-[14px] text-muted">Este tipo de arquivo não tem pré-visualização. Baixe para abrir.</p>
      )}
      <a href={fileUrl} target="_blank" rel="noopener noreferrer" className={buttonVariants.secondary + " w-fit"}>
        Baixar {content.file_name} {content.file_size ? `(${formatBytes(content.file_size)})` : ""}
      </a>
    </div>
  );
}

/** Objetivo e orientações do conteúdo, mostrado logo abaixo do conteúdo central. */
export function ObjectiveNote({ text }: { text: string }) {
  return (
    <section aria-label="Objetivo e orientações" className="rounded-xl border border-line bg-surface px-5 py-4">
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
