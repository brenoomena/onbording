"use client";

import { useEffect, useRef, useState, type ComponentProps, type ReactNode } from "react";
import { Markdown } from "@/components/markdown";
import { cx } from "@/components/ui";
import { normalizeUrl } from "@/lib/text";

type Props = Omit<ComponentProps<"textarea">, "value" | "onChange" | "defaultValue"> & {
  defaultValue?: string | null;
  /** Mostra a dica de formatação abaixo do campo. */
  showHelp?: boolean;
};

interface Edit {
  /** Texto antes e depois da seleção. */
  before?: string;
  after?: string;
  /** Texto usado quando não há nada selecionado. */
  placeholder?: string;
  /** Aplica no começo de cada linha selecionada. */
  linePrefix?: string | ((i: number) => string);
  /** Insere um bloco inteiro em linha própria. */
  block?: string;
  /** Trecho do bloco que fica selecionado para a pessoa substituir. */
  select?: string;
}

/**
 * Campo de texto com barra de formatação: negrito, itálico, título, listas,
 * link, login e senha, trecho copiável e destaque. Cada Enter vira quebra de
 * linha no texto publicado. Guarda o texto em Markdown, que é mostrado
 * formatado na plataforma. Continua sendo um <textarea> comum, então funciona
 * com qualquer formulário.
 */
export function RichTextarea({ defaultValue, showHelp = true, className, rows = 4, ...props }: Props) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  // Caixa de link: guarda o trecho selecionado enquanto a pessoa digita o endereço.
  const [linkBox, setLinkBox] = useState<{ start: number; end: number; selected: string } | null>(null);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkText, setLinkText] = useState("");
  const box = useRef<HTMLDivElement>(null);
  const urlInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!linkBox) return;
    urlInput.current?.focus();
    const onDown = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setLinkBox(null);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [linkBox]);

  function apply(edit: Edit) {
    const ta = ref.current;
    if (!ta) return;
    ta.focus();
    const { selectionStart: s, selectionEnd: e, value } = ta;
    const selected = value.slice(s, e);
    let text: string;
    let selStart: number;
    let selEnd: number;

    if (edit.block) {
      const pre = s > 0 && value[s - 1] !== "\n" ? "\n\n" : s > 1 && value[s - 2] !== "\n" ? "\n" : "";
      const post = value[e] && value[e] !== "\n" ? "\n\n" : "";
      text = pre + edit.block + post;
      const at = edit.select ? edit.block.indexOf(edit.select) : -1;
      selStart = s + pre.length + Math.max(0, at);
      selEnd = at >= 0 ? selStart + edit.select!.length : s + pre.length + edit.block.length;
    } else if (edit.linePrefix) {
      // Expande para linhas inteiras.
      const ls = value.lastIndexOf("\n", s - 1) + 1;
      const leIdx = value.indexOf("\n", e);
      const le = leIdx === -1 ? value.length : leIdx;
      const lines = (value.slice(ls, le) || edit.placeholder || "").split("\n");
      const prefix = edit.linePrefix;
      text = lines.map((l, i) => (typeof prefix === "function" ? prefix(i) : prefix) + l).join("\n");
      ta.setSelectionRange(ls, le);
      selStart = ls;
      selEnd = ls + text.length;
    } else {
      const inner = selected || edit.placeholder || "";
      text = (edit.before ?? "") + inner + (edit.after ?? "");
      selStart = s + (edit.before ?? "").length;
      selEnd = selStart + inner.length;
    }

    // setRangeText mantém o desfazer (Ctrl+Z) na maioria dos navegadores.
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    ta.setRangeText(text, start, end, "end");
    ta.setSelectionRange(selStart, selEnd);
    ta.dispatchEvent(new Event("input", { bubbles: true }));
  }

  const link = () => {
    const ta = ref.current;
    if (!ta) return;
    const selected = ta.value.slice(ta.selectionStart, ta.selectionEnd);
    const isUrl = /^(https?:\/\/|www\.)\S+$/i.test(selected.trim());
    setLinkUrl(isUrl ? selected.trim() : "");
    setLinkText("");
    setLinkBox({ start: ta.selectionStart, end: ta.selectionEnd, selected: isUrl ? "" : selected });
  };

  const closeLink = () => {
    const at = linkBox;
    setLinkBox(null);
    requestAnimationFrame(() => {
      ref.current?.focus();
      if (at) ref.current?.setSelectionRange(at.start, at.end);
    });
  };

  const applyLink = () => {
    const ta = ref.current;
    const href = normalizeUrl(linkUrl);
    if (!ta || !linkBox || !href) return;
    const label = (linkBox.selected || linkText || linkUrl).trim().replace(/[[\]]/g, "");
    const md = `[${label}](${href})`;
    ta.focus();
    ta.setRangeText(md, linkBox.start, linkBox.end, "end");
    ta.dispatchEvent(new Event("input", { bubbles: true }));
    setLinkBox(null);
  };

  const validUrl = !!normalizeUrl(linkUrl);

  const tools: { label: string; title: string; icon: ReactNode; run: () => void }[] = [
    { label: "Negrito", title: "Negrito (Ctrl+B)", icon: <b>B</b>, run: () => apply({ before: "**", after: "**", placeholder: "texto em negrito" }) },
    { label: "Itálico", title: "Itálico (Ctrl+I)", icon: <i className="font-serif">I</i>, run: () => apply({ before: "*", after: "*", placeholder: "texto em itálico" }) },
    { label: "Subtítulo", title: "Subtítulo", icon: <span className="font-semibold">T</span>, run: () => apply({ linePrefix: "### ", placeholder: "Subtítulo" }) },
    { label: "Lista", title: "Lista com marcadores", icon: <ListIcon />, run: () => apply({ linePrefix: "- ", placeholder: "item" }) },
    { label: "Lista numerada", title: "Lista numerada", icon: <span className="text-[11px] font-semibold">1.</span>, run: () => apply({ linePrefix: (i) => `${i + 1}. `, placeholder: "passo" }) },
    { label: "Link", title: "Link (Ctrl+K)", icon: <LinkIcon />, run: link },
    {
      label: "Login e senha",
      title: "Inserir login e senha de acesso",
      icon: <KeyIcon />,
      run: () =>
        apply({
          block: "**Acesso:** https://\n**Login:** `seu.email@implantta.com.br`\n**Senha:** `senha`",
          select: "https://",
        }),
    },
    { label: "Copiável", title: "Trecho copiável (login, senha, código)", icon: <span className="font-mono text-[11px]">{"</>"}</span>, run: () => apply({ before: "`", after: "`", placeholder: "texto" }) },
    { label: "Destaque", title: "Destaque / aviso", icon: <QuoteIcon />, run: () => apply({ linePrefix: "> ", placeholder: "Atenção: …" }) },
    { label: "Divisória", title: "Linha divisória", icon: <span className="block h-px w-3.5 bg-current" />, run: () => apply({ block: "---" }) },
  ];

  return (
    <div className={cx("relative rounded-lg border border-line bg-surface focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/25", className)}>
      <div role="toolbar" aria-label="Formatação do texto" className="flex flex-wrap items-center gap-0.5 rounded-t-lg border-b border-line bg-sunken/60 px-1.5 py-1">
        {tools.map((t) => (
          <button
            key={t.label}
            type="button"
            title={t.title}
            aria-label={t.label}
            disabled={preview !== null}
            onMouseDown={(e) => e.preventDefault()}
            onClick={t.run}
            aria-pressed={t.label === "Link" ? !!linkBox : undefined}
            className={cx(
              "grid h-7 min-w-7 place-items-center rounded-md px-1.5 text-[13px] text-ink/80 hover:bg-surface hover:text-ink disabled:opacity-40",
              t.label === "Link" && linkBox && "bg-surface text-accent",
            )}
          >
            {t.icon}
          </button>
        ))}
        <span className="ml-auto" />
        <button
          type="button"
          onClick={() => setPreview(preview === null ? ref.current?.value ?? "" : null)}
          aria-pressed={preview !== null}
          className={cx("rounded-md px-2 py-1 text-[12px] font-medium", preview !== null ? "bg-accent-soft text-accent" : "text-muted hover:text-ink")}
        >
          {preview !== null ? "Editar" : "Pré-visualizar"}
        </button>
      </div>
      {linkBox && (
        <div
          ref={box}
          role="dialog"
          aria-label="Inserir link"
          className="absolute left-2 top-10 z-20 grid w-[min(420px,calc(100%-1rem))] gap-2 rounded-xl border border-line bg-surface p-3 shadow-[0_8px_28px_rgba(0,0,0,0.16)]"
          onKeyDown={(e) => {
            if (e.key === "Escape") (e.preventDefault(), e.stopPropagation(), closeLink());
            if (e.key === "Enter") (e.preventDefault(), applyLink());
          }}
        >
          {linkBox.selected && (
            <p className="truncate text-[12px] text-muted">
              Link em: <span className="font-medium text-accent underline">{linkBox.selected}</span>
            </p>
          )}
          <div className="flex items-center gap-2">
            <label className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border-2 border-brand/70 px-2.5 py-1.5 focus-within:border-brand">
              <LinkIcon />
              <input
                ref={urlInput}
                type="text"
                inputMode="url"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                placeholder="Digite ou cole um link"
                aria-label="Endereço do link"
                className="min-w-0 flex-1 bg-transparent text-[14px] !outline-none placeholder:text-muted"
              />
            </label>
            <button
              type="button"
              onClick={applyLink}
              disabled={!validUrl}
              className="rounded-lg px-3 py-1.5 text-[14px] font-semibold text-accent hover:bg-accent-soft disabled:text-muted disabled:hover:bg-transparent"
            >
              Aplicar
            </button>
          </div>
          {!linkBox.selected && (
            <input
              type="text"
              value={linkText}
              onChange={(e) => setLinkText(e.target.value)}
              placeholder="Texto que aparece (opcional)"
              aria-label="Texto do link"
              className="rounded-lg border border-line px-2.5 py-1.5 text-[13px] outline-none placeholder:text-muted focus:border-brand"
            />
          )}
        </div>
      )}
      <textarea
        ref={ref}
        rows={rows}
        defaultValue={defaultValue ?? ""}
        {...props}
        hidden={preview !== null}
        onKeyDown={(e) => {
          props.onKeyDown?.(e);
          if (!(e.ctrlKey || e.metaKey)) return;
          const k = e.key.toLowerCase();
          if (k === "b") (e.preventDefault(), tools[0].run());
          if (k === "i") (e.preventDefault(), tools[1].run());
          if (k === "k") (e.preventDefault(), link());
        }}
        className="block w-full resize-y bg-transparent px-3 py-2 text-[14px] leading-relaxed outline-none placeholder:text-muted"
      />
      {preview !== null && (
        <div className="px-3 py-2" style={{ minHeight: `${rows * 1.6 + 1}em` }}>
          {preview.trim() ? <Markdown size="sm">{preview}</Markdown> : <p className="text-[13px] text-muted">Nada escrito ainda.</p>}
        </div>
      )}
      {showHelp && (
        <p className="rounded-b-lg border-t border-line px-3 py-1.5 text-[11.5px] text-muted">
          Enter quebra a linha · linha em branco separa parágrafos · trechos <code className="font-mono">copiáveis</code> viram botão de copiar
        </p>
      )}
    </div>
  );
}

function ListIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
      <circle cx="2.5" cy="4" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="2.5" cy="8" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="2.5" cy="12" r="0.9" fill="currentColor" stroke="none" />
      <path d="M6 4h8M6 8h8M6 12h8" strokeLinecap="round" />
    </svg>
  );
}

function LinkIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden>
      <path d="M6.5 9.5l3-3M7 4.5l1-1a2.8 2.8 0 014 4l-1 1M9 11.5l-1 1a2.8 2.8 0 01-4-4l1-1" />
    </svg>
  );
}

function KeyIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden>
      <circle cx="5" cy="11" r="3" />
      <path d="M7.2 8.8L13.5 2.5M11 5l2 2M12.5 3.5l1 1" />
    </svg>
  );
}

function QuoteIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden>
      <path d="M3 3v10M6.5 5h7M6.5 8h7M6.5 11h5" />
    </svg>
  );
}
