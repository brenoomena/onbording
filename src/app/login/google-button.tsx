"use client";

import type { CSSProperties } from "react";
import { useFormStatus } from "react-dom";
import { GOOGLE_BUTTON_CLASS, GoogleMark } from "@/components/login-scene";

/** Botão "Entrar com Google" com as cores definidas em Configurações › Página de login. */
export function GoogleButton({ style }: { style?: CSSProperties }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={GOOGLE_BUTTON_CLASS} style={style}>
      <GoogleMark />
      {pending ? "Abrindo o Google…" : "Entrar com Google"}
    </button>
  );
}
