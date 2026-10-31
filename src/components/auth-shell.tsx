import type { ReactNode } from "react";
import { getBranding, logoFor } from "@/lib/branding";
import { resolveTheme } from "@/lib/theme-tokens";

export async function AuthShell({ title, description, children }: { title: string; description?: ReactNode; children: ReactNode }) {
  const branding = await getBranding();
  const theme = resolveTheme(branding.theme);
  const light = logoFor(branding, theme.light.bg);
  const dark = logoFor(branding, theme.dark.bg);
  return (
    <main className="grid min-h-dvh place-items-center px-4 py-10">
      <div className="w-full max-w-[400px] space-y-6">
        <div className="space-y-3">
          {light || dark ? (
            <div className="grid gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {light && <span className={dark && dark !== light ? "only-light" : "block"}><img src={light} alt="Logomarca" className="max-h-14 w-auto max-w-[220px] object-contain" /></span>}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {dark && dark !== light && <span className="only-dark"><img src={dark} alt="Logomarca" className="max-h-14 w-auto max-w-[220px] object-contain" /></span>}
              <Wordmark textOnly />
            </div>
          ) : (
            <Wordmark />
          )}
          <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
          {description && <p className="text-muted">{description}</p>}
        </div>
        <div className="rounded-xl border border-line bg-surface p-6 shadow-[0_1px_0_rgb(var(--line))]">{children}</div>
      </div>
    </main>
  );
}

export function Wordmark({ compact = false, textOnly = false }: { compact?: boolean; textOnly?: boolean }) {
  if (textOnly) {
    return (
      <span className="text-base font-semibold text-heading">
        Onboarding <span className="text-accent">Implantta</span>
      </span>
    );
  }
  return (
    <div className="flex items-center gap-2">
      <span aria-hidden className="grid h-7 w-7 place-items-center rounded-md bg-brand font-mono text-[13px] font-bold text-on-brand">
        I
      </span>
      <span className={compact ? "text-[15px] font-semibold" : "text-base font-semibold"}>
        Onboarding <span className="text-accent">Implantta</span>
      </span>
    </div>
  );
}
