import type { CSSProperties, ReactNode } from "react";
import { LoginBackdrop } from "@/components/login-backdrop";
import { cx } from "@/components/ui";
import { CARD_CLASS, cardVars, gradientCss, type LoginTheme } from "@/lib/login-theme";

export interface SceneLogo {
  src: string;
  style: { width?: number; height?: number };
}

/**
 * Cenário das telas de acesso (login, sem acesso…): degradê, efeito animado,
 * logo, chamada e o cartão. Usado também na prévia de Configurações.
 */
export function LoginScene({
  t,
  logo,
  title,
  description,
  hero = false,
  contained = false,
  children,
}: {
  t: LoginTheme;
  logo: SceneLogo | null;
  title: string;
  description?: ReactNode;
  /** Mostra a chamada (título grande e frase) acima do cartão: só no login. */
  hero?: boolean;
  /** Dentro de uma caixa (prévia) em vez da tela inteira. */
  contained?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className={cx("relative isolate overflow-hidden", contained ? "h-full" : "min-h-dvh")}
      style={{ background: gradientCss(t), color: t.textColor }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(55% 45% at 12% 0%, rgba(255,255,255,0.18), transparent 70%), radial-gradient(50% 40% at 100% 100%, rgba(0,0,0,0.28), transparent 70%)",
        }}
      />
      <LoginBackdrop effect={t.effect} color={t.effectColor} speed={t.speed} intensity={t.intensity} />
      <main className={cx("relative z-10 grid place-items-center px-4 py-10", contained ? "h-full" : "min-h-dvh")}>
        <div className="grid w-full max-w-[420px] gap-7">
          <div className="grid justify-items-center gap-4 text-center">
            {logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logo.src} alt="Logomarca" className="max-w-full object-contain drop-shadow-[0_2px_12px_rgba(0,0,0,0.18)]" style={logo.style} />
            ) : (
              <span className="flex items-center gap-2 text-[17px] font-semibold">
                <span aria-hidden className="grid h-8 w-8 place-items-center rounded-lg bg-white/15 font-mono text-[14px] font-bold ring-1 ring-white/30">
                  I
                </span>
                Onboarding Implantta
              </span>
            )}
            {hero && (t.headline || t.tagline) && (
              <div className="grid gap-2">
                {t.headline && <p className="text-balance text-[28px] font-semibold leading-[1.15] tracking-tight sm:text-[32px]">{t.headline}</p>}
                {t.tagline && <p className="text-balance text-[15px] leading-relaxed opacity-80">{t.tagline}</p>}
              </div>
            )}
          </div>
          <div className={cx("rounded-2xl border p-6 text-ink sm:p-7", CARD_CLASS[t.card])} style={cardVars(t) as CSSProperties}>
            <h1 className="text-[18px] font-semibold tracking-tight text-heading">{title}</h1>
            {description && <p className="mt-1.5 text-[13.5px] leading-relaxed text-muted">{description}</p>}
            <div className="mt-5">{children}</div>
          </div>
        </div>
      </main>
    </div>
  );
}

/** Aparência do botão "Entrar com Google" (cores configuráveis). */
export function googleButtonStyle(t: LoginTheme): CSSProperties {
  return { background: t.buttonBg, color: t.buttonText };
}

export function GoogleMark() {
  return (
    <svg aria-hidden viewBox="0 0 48 48" width="20" height="20">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

export const GOOGLE_BUTTON_CLASS =
  "flex w-full items-center justify-center gap-3 rounded-xl px-4 py-3 text-[14.5px] font-semibold shadow-[0_6px_20px_-8px_rgba(0,0,0,0.35)] ring-1 ring-black/5 transition-[filter,transform] hover:brightness-[0.96] active:translate-y-px disabled:opacity-70";
