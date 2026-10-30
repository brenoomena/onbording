import ReactMarkdown from "react-markdown";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";
import { CopyCode } from "@/components/copy-code";
import { cx } from "@/components/ui";

/**
 * Texto formatado (Markdown). Cada Enter vira quebra de linha; trechos em
 * `código` (logins, senhas) são copiados com um clique. HTML bruto não é
 * interpretado (proteção contra scripts).
 */
export function Markdown({ children, size = "base", className }: { children: string; size?: "base" | "sm"; className?: string }) {
  return (
    <div className={cx("prose-onb", size === "sm" && "prose-sm", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkBreaks]}
        components={{
          a: ({ href, children: c }) => (
            <a href={href} target="_blank" rel="noopener noreferrer">
              {c}
            </a>
          ),
          code: ({ className: lang, children: c }) => {
            const text = String(c ?? "");
            // Blocos de várias linhas ficam como código; trechos curtos viram "copiar".
            if (lang || text.includes("\n")) return <code className={lang}>{c}</code>;
            return <CopyCode text={text}>{c}</CopyCode>;
          },
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}

export { plainText } from "@/lib/text";
