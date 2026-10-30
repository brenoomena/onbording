import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/** Texto em Markdown. HTML bruto não é interpretado (proteção contra scripts). */
export function Markdown({ children }: { children: string }) {
  return (
    <div className="prose-onb">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children: c }) => (
            <a href={href} target="_blank" rel="noopener noreferrer">
              {c}
            </a>
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
