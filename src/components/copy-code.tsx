"use client";

import { useState, type ReactNode } from "react";

/** Trecho em `código` (login, senha, endereço): um clique copia o texto. */
export function CopyCode({ text, children }: { text: string; children: ReactNode }) {
  const [copied, setCopied] = useState(false);
  return (
    <code
      role="button"
      tabIndex={0}
      title={copied ? "Copiado" : "Clique para copiar"}
      data-copied={copied || undefined}
      className="copy-code"
      onClick={() => copy()}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          copy();
        }
      }}
    >
      {children}
      {copied && <span className="ml-1 font-sans text-[0.8em] text-ok">copiado</span>}
    </code>
  );

  function copy() {
    void navigator.clipboard?.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }
}
