import type { ReactNode } from "react";

export function AuthShell({ title, description, children }: { title: string; description?: ReactNode; children: ReactNode }) {
  return (
    <main className="grid min-h-dvh place-items-center px-4 py-10">
      <div className="w-full max-w-[400px] space-y-6">
        <div className="space-y-2">
          <Wordmark />
          <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
          {description && <p className="text-muted">{description}</p>}
        </div>
        <div className="rounded-xl border border-line bg-surface p-6 shadow-[0_1px_0_rgb(var(--line))]">{children}</div>
      </div>
    </main>
  );
}

export function Wordmark({ compact = false }: { compact?: boolean }) {
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
