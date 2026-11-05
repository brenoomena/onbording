"use client";

import { Check, Link2 } from "lucide-react";
import { useState } from "react";
import { buttonVariants } from "@/components/ui";

/** Copia um texto (ex.: link de validação) e confirma por 2 segundos. */
export function CopyButton({ value, label }: { value: string; label: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard?.writeText(value).then(() => {
          setDone(true);
          setTimeout(() => setDone(false), 2000);
        });
      }}
      className={buttonVariants.secondary}
    >
      {done ? <Check size={16} aria-hidden /> : <Link2 size={16} aria-hidden />} {done ? "Link copiado" : label}
    </button>
  );
}
