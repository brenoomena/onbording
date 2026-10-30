"use client";

import { useState } from "react";
import { cx } from "@/components/ui";
import { THEME_COOKIE, themeAttr, type Theme } from "@/lib/theme";

const OPTIONS: { value: Theme; label: string; hint: string }[] = [
  { value: "claro", label: "Claro", hint: "Fundo claro sempre" },
  { value: "escuro", label: "Escuro", hint: "Fundo escuro sempre" },
  { value: "sistema", label: "Automático", hint: "Segue o computador ou celular" },
];

/** Troca o tema na hora e guarda a escolha neste navegador por 1 ano. */
export function ThemePicker({ current }: { current: Theme }) {
  const [theme, setTheme] = useState(current);

  function choose(t: Theme) {
    setTheme(t);
    const attr = themeAttr(t);
    if (attr) document.documentElement.dataset.theme = attr;
    else delete document.documentElement.dataset.theme;
    document.cookie = `${THEME_COOKIE}=${t}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
  }

  return (
    <div role="radiogroup" aria-label="Tema" className="grid grid-cols-3 gap-2">
      {OPTIONS.map((o) => {
        const on = theme === o.value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => choose(o.value)}
            className={cx(
              "grid gap-2 rounded-xl border p-2 text-left transition-colors",
              on ? "border-brand bg-accent-soft ring-2 ring-brand/30" : "border-line hover:bg-sunken",
            )}
          >
            <ThemeSample kind={o.value} />
            <span>
              <span className="block text-[13px] font-semibold">{o.label}</span>
              <span className="block text-[11.5px] leading-tight text-muted">{o.hint}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** Miniatura da tela em cada tema (cores fixas para mostrar a diferença). */
function ThemeSample({ kind }: { kind: Theme }) {
  const light = { bg: "#f3f9fe", panel: "#ffffff", line: "#dce6ee", text: "#333333" };
  const dark = { bg: "#26292d", panel: "#30343a", line: "#41474f", text: "#eef2f6" };
  const half = (c: typeof light) => (
    <svg viewBox="0 0 60 36" className="h-full w-full" aria-hidden>
      <rect width="60" height="36" fill={c.bg} />
      <rect x="0" y="0" width="14" height="36" fill={c.panel} />
      <rect x="3" y="5" width="8" height="2.5" rx="1" fill="#14affc" />
      <rect x="3" y="11" width="8" height="1.5" rx="0.75" fill={c.line} />
      <rect x="3" y="15" width="8" height="1.5" rx="0.75" fill={c.line} />
      <rect x="18" y="5" width="24" height="3" rx="1.5" fill={c.text} opacity="0.8" />
      <rect x="18" y="12" width="38" height="19" rx="2" fill={c.panel} stroke={c.line} strokeWidth="0.6" />
    </svg>
  );
  return (
    <span className="relative block aspect-[5/3] overflow-hidden rounded-lg border border-line">
      {kind === "sistema" ? (
        <span className="grid h-full grid-cols-2">
          <span className="overflow-hidden">{half(light)}</span>
          <span className="overflow-hidden">{half(dark)}</span>
        </span>
      ) : (
        half(kind === "claro" ? light : dark)
      )}
    </span>
  );
}
