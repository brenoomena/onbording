"use client";

import { Star } from "lucide-react";
import { useId, useState } from "react";
import { cx } from "@/components/ui";
import { RATING_LABEL } from "@/lib/feedback";

/** Estrelas só para leitura (ex.: média 4,3 → 4 cheias e uma parcial). */
export function Stars({ value, size = 16, className }: { value: number | null; size?: number; className?: string }) {
  const v = value ?? 0;
  return (
    <span className={cx("inline-flex items-center gap-0.5", className)} role="img" aria-label={value == null ? "Sem nota" : `${String(v).replace(".", ",")} de 5 estrelas`}>
      {[1, 2, 3, 4, 5].map((i) => {
        const fill = Math.max(0, Math.min(1, v - (i - 1)));
        return (
          <span key={i} className="relative inline-block" style={{ width: size, height: size }}>
            <Star size={size} aria-hidden className="absolute inset-0 text-line" fill="currentColor" strokeWidth={0} />
            {fill > 0 && (
              <span className="absolute inset-0 overflow-hidden" style={{ width: `${fill * 100}%` }}>
                <Star size={size} aria-hidden className="text-tag-gold" fill="currentColor" strokeWidth={0} />
              </span>
            )}
          </span>
        );
      })}
    </span>
  );
}

/**
 * Escolha de 1 a 5 estrelas. São botões de rádio de verdade (teclado e
 * leitores de tela funcionam); o valor vai no formulário em `name`.
 */
export function StarInput({ name = "rating", defaultValue = 0, size = 30, label = "Sua nota" }: { name?: string; defaultValue?: number; size?: number; label?: string }) {
  const [value, setValue] = useState(defaultValue);
  const [hover, setHover] = useState(0);
  const id = useId();
  const shown = hover || value;
  return (
    <fieldset className="grid gap-1">
      <legend className="sr-only">{label}</legend>
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center" onMouseLeave={() => setHover(0)}>
          {[1, 2, 3, 4, 5].map((n) => (
            <label key={n} htmlFor={`${id}-${n}`} className="relative cursor-pointer p-0.5" onMouseEnter={() => setHover(n)} title={RATING_LABEL[n]}>
              <input
                id={`${id}-${n}`}
                type="radio"
                name={name}
                value={n}
                checked={value === n}
                onChange={() => setValue(n)}
                className="peer sr-only"
                aria-label={`${n} ${n === 1 ? "estrela" : "estrelas"}: ${RATING_LABEL[n]}`}
              />
              <Star
                size={size}
                aria-hidden
                strokeWidth={1.6}
                className={cx(
                  "rounded transition-transform peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent",
                  n <= shown ? "scale-105 text-tag-gold" : "text-muted/60",
                )}
                fill={n <= shown ? "currentColor" : "none"}
              />
            </label>
          ))}
        </div>
        <span className="min-w-[80px] text-[13px] font-medium text-heading" aria-live="polite">
          {shown ? RATING_LABEL[shown] : "Escolha de 1 a 5"}
        </span>
      </div>
    </fieldset>
  );
}
