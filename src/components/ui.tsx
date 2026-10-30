import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

export function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export function PageHeader({
  title,
  description,
  actions,
  eyebrow,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  eyebrow?: string;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4 border-b border-line pb-5">
      <div className="min-w-0 space-y-1">
        {eyebrow && <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-accent">{eyebrow}</p>}
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="max-w-2xl text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  );
}

export function Card({ children, className, title, description, actions }: {
  children: ReactNode;
  className?: string;
  title?: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <section className={cx("rounded-xl border border-line bg-surface", className)}>
      {(title || actions) && (
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4">
          <div className="min-w-0">
            {title && <h2 className="text-base font-semibold">{title}</h2>}
            {description && <p className="mt-0.5 text-[13px] text-muted">{description}</p>}
          </div>
          {actions}
        </div>
      )}
      <div className="p-5">{children}</div>
    </section>
  );
}

const buttonBase =
  "inline-flex items-center justify-center gap-2 rounded-lg px-3.5 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60";

export const buttonVariants = {
  primary: `${buttonBase} bg-brand text-on-brand hover:bg-brand/85`,
  secondary: `${buttonBase} border border-line bg-surface text-ink hover:bg-sunken`,
  ghost: `${buttonBase} text-accent hover:bg-accent-soft`,
  danger: `${buttonBase} border border-danger/40 bg-surface text-danger hover:bg-danger-soft`,
} as const;

export function Button({
  variant = "primary",
  className,
  ...props
}: ComponentProps<"button"> & { variant?: keyof typeof buttonVariants }) {
  return <button className={cx(buttonVariants[variant], className)} {...props} />;
}

export function LinkButton({
  variant = "primary",
  className,
  ...props
}: ComponentProps<typeof Link> & { variant?: keyof typeof buttonVariants }) {
  return <Link className={cx(buttonVariants[variant], className)} {...props} />;
}

const fieldBase =
  "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-muted/70 focus:border-brand focus:outline-none disabled:bg-sunken disabled:text-muted";

export function Input(props: ComponentProps<"input">) {
  return <input {...props} className={cx(fieldBase, props.className)} />;
}

export function Textarea(props: ComponentProps<"textarea">) {
  return <textarea rows={3} {...props} className={cx(fieldBase, props.className)} />;
}

export function Select(props: ComponentProps<"select">) {
  return <select {...props} className={cx(fieldBase, "pr-8", props.className)} />;
}

export function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
  className,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  error?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx("grid content-start gap-1.5", className)}>
      <label htmlFor={htmlFor} className="text-[13px] font-medium">
        {label}
      </label>
      {children}
      {error ? (
        <p className="text-[12px] text-danger">{error}</p>
      ) : hint ? (
        <p className="text-[12px] text-muted">{hint}</p>
      ) : null}
    </div>
  );
}

type Tone = "neutral" | "brand" | "ok" | "warn" | "danger";
const toneClass: Record<Tone, string> = {
  neutral: "bg-sunken text-muted",
  brand: "bg-accent-soft text-accent",
  ok: "bg-ok-soft text-ok",
  warn: "bg-warn-soft text-warn",
  danger: "bg-danger-soft text-danger",
};

export function Badge({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span className={cx("inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[12px] font-medium", toneClass[tone])}>
      {children}
    </span>
  );
}

export function StatusBadge({ status }: { status: "onboarding" | "ativo" | "inativo" }) {
  if (status === "ativo") return <Badge tone="ok">Ativo</Badge>;
  if (status === "onboarding") return <Badge tone="brand">Em onboarding</Badge>;
  return <Badge>Inativo</Badge>;
}

export function Alert({ tone = "danger", children }: { tone?: "danger" | "ok" | "warn" | "brand"; children: ReactNode }) {
  const map = {
    danger: "border-danger/30 bg-danger-soft text-danger",
    ok: "border-ok/30 bg-ok-soft text-ok",
    warn: "border-warn/30 bg-warn-soft text-warn",
    brand: "border-accent/30 bg-accent-soft text-accent",
  } as const;
  return (
    <div role={tone === "danger" ? "alert" : "status"} className={cx("rounded-lg border px-3.5 py-2.5 text-[13px]", map[tone])}>
      {children}
    </div>
  );
}

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="grid justify-items-center gap-2 rounded-xl border border-dashed border-line px-6 py-10 text-center">
      <p className="font-semibold">{title}</p>
      {children && <p className="max-w-md text-[13px] text-muted">{children}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function Table({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-line bg-surface">
      <table className="w-full min-w-[640px] border-collapse text-left text-sm [&_td]:border-t [&_td]:border-line [&_td]:px-4 [&_td]:py-3 [&_th]:bg-sunken/60 [&_th]:px-4 [&_th]:py-2.5 [&_th]:text-[12px] [&_th]:font-semibold [&_th]:uppercase [&_th]:tracking-[0.04em] [&_th]:text-muted">
        {children}
      </table>
    </div>
  );
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const d = value.length === 10 ? new Date(`${value}T12:00:00`) : new Date(value);
  return d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    dateStyle: "short",
    timeStyle: "short",
  });
}
