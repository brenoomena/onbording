"use client";

import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * Registra o tempo de estudo de um conteúdo.
 * - Tempo de sessão: tempo com a página aberta.
 * - Tempo ativo: página visível E interação nos últimos 60 s (ou um vídeo
 *   incorporado em foco). Página aberta e parada não conta.
 * Envia a cada 30 s e quando a página é escondida; o banco limita os
 * valores ao tempo real decorrido.
 */
export function StudyTracker({ contentId }: { contentId: string }) {
  const session = useRef<string | null>(null);
  const counters = useRef({ active: 0, total: 0 });
  const lastInteraction = useRef(Date.now());

  useEffect(() => {
    const supabase = createClient();
    let stopped = false;

    supabase.rpc("start_learning_session", { p_content: contentId }).then(({ data }) => {
      if (!stopped && typeof data === "string") session.current = data;
    });

    const touch = () => {
      lastInteraction.current = Date.now();
    };
    const events = ["mousemove", "keydown", "scroll", "click", "touchstart", "wheel"] as const;
    events.forEach((e) => window.addEventListener(e, touch, { passive: true }));

    const tick = window.setInterval(() => {
      counters.current.total += 1;
      const visible = document.visibilityState === "visible";
      const recent = Date.now() - lastInteraction.current < 60_000;
      const inEmbed = document.activeElement?.tagName === "IFRAME";
      if (visible && (recent || inEmbed)) counters.current.active += 1;
    }, 1000);

    const flush = () => {
      const id = session.current;
      const { active, total } = counters.current;
      if (!id || total === 0) return;
      counters.current = { active: 0, total: 0 };
      // A consulta do Supabase só é enviada quando o resultado é consumido (then).
      supabase
        .rpc("ping_learning_session", { p_session: id, p_active_seconds: active, p_session_seconds: total })
        .then(({ error }) => {
          if (error) counters.current = { active: counters.current.active + active, total: counters.current.total + total };
        });
    };
    const ping = window.setInterval(flush, 30_000);
    const onHide = () => {
      if (document.visibilityState === "hidden") flush();
    };
    document.addEventListener("visibilitychange", onHide);

    return () => {
      stopped = true;
      flush();
      window.clearInterval(tick);
      window.clearInterval(ping);
      document.removeEventListener("visibilitychange", onHide);
      events.forEach((e) => window.removeEventListener(e, touch));
    };
  }, [contentId]);

  return null;
}
