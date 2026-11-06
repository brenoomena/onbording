import { Check, CircleCheck, CircleSlash, CircleX, ClipboardCheck, Clock3, FileText, Hourglass, Link2, Paperclip, PlayCircle, Target, X, type LucideIcon } from "lucide-react";
import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { TAGS, type TagIcon, type TagKey } from "@/lib/tag-catalog";
import { levelTag, type Tone } from "@/lib/tags";

export function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

/**
 * Cabeçalho da página: selo do módulo, ícone, título, descrição e ações.
 * Fundo com leve degradê, no padrão das telas de referência.
 */
export function PageHeader({
  title,
  description,
  actions,
  eyebrow,
  icon: Icon,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  eyebrow?: string;
  icon?: LucideIcon;
}) {
  return (
    <header className="relative overflow-hidden rounded-2xl border border-line bg-surface px-5 py-5 sm:px-7 sm:py-6 [.in-modal_&]:py-4 sm:[.in-modal_&]:px-5">
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[linear-gradient(115deg,rgb(var(--header-bg)),rgb(var(--surface)/0)_58%)]" />
      <div className="relative flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0 space-y-3">
          {eyebrow && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface/80 px-2.5 py-0.5 text-[11.5px] font-medium text-muted">
              <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-brand" />
              {eyebrow}
            </span>
          )}
          <div className="flex items-center gap-3.5">
            {Icon && (
              <span aria-hidden className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-icon-bg text-icon ring-1 ring-inset ring-icon/10">
                <Icon size={24} strokeWidth={1.9} />
              </span>
            )}
            <h1 className="min-w-0 text-[26px] font-bold leading-tight tracking-tight sm:text-[30px] [.in-modal_&]:text-[22px] sm:[.in-modal_&]:text-[24px]">{title}</h1>
          </div>
          {description && <div className="max-w-3xl text-[14px] text-muted">{description}</div>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}

export function Card({ children, className, title, description, actions, icon: Icon, flush = false }: {
  children: ReactNode;
  className?: string;
  title?: string;
  description?: ReactNode;
  actions?: ReactNode;
  icon?: LucideIcon;
  /** Sem espaçamento interno (tabelas e listas que encostam na borda). */
  flush?: boolean;
}) {
  return (
    <section className={cx("rounded-2xl border border-line bg-surface shadow-[0_1px_2px_rgba(16,24,40,0.04)]", className)}>
      {(title || actions) && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
          <div className="flex min-w-0 items-center gap-3">
            {Icon && (
              <span aria-hidden className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-icon-bg text-icon">
                <Icon size={18} strokeWidth={1.9} />
              </span>
            )}
            <div className="min-w-0">
              {title && <h2 className="text-[15px] font-semibold">{title}</h2>}
              {description && <p className="mt-0.5 text-[12.5px] text-muted">{description}</p>}
            </div>
          </div>
          {actions}
        </div>
      )}
      <div className={flush ? "" : "p-5"}>{children}</div>
    </section>
  );
}

/** Indicador numérico com ícone (painéis e listagens). */
export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "brand",
  href,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon: LucideIcon;
  tone?: "brand" | "ok" | "warn" | "danger" | "neutral";
  href?: string;
}) {
  const tones = {
    brand: { tile: "bg-icon-bg text-icon", value: "text-accent", ring: "border-accent/25" },
    ok: { tile: "bg-ok-soft text-ok", value: "text-ok", ring: "border-ok/25" },
    warn: { tile: "bg-warn-soft text-warn", value: "text-warn", ring: "border-warn/30" },
    danger: { tile: "bg-danger-soft text-danger", value: "text-danger", ring: "border-danger/25" },
    neutral: { tile: "bg-sunken text-muted", value: "text-heading", ring: "border-line" },
  }[tone];
  const body = (
    <div className={cx("flex h-full items-start justify-between gap-3 rounded-2xl border bg-surface p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition-colors", tones.ring, href && "hover:bg-sunken/50")}>
      <div className="min-w-0">
        <p className="text-[11.5px] font-semibold uppercase tracking-[0.06em] text-muted">{label}</p>
        <p className={cx("mt-2 text-[26px] font-bold leading-none tabular-nums", tones.value)}>{value}</p>
        {hint && <p className="mt-2 truncate text-[12.5px] text-muted">{hint}</p>}
      </div>
      <span aria-hidden className={cx("grid h-11 w-11 shrink-0 place-items-center rounded-xl", tones.tile)}>
        <Icon size={20} strokeWidth={1.9} />
      </span>
    </div>
  );
  return href ? <Link href={href} className="block">{body}</Link> : body;
}

/** Botão só com ícone, com nome acessível e dica ao passar o mouse. */
export function IconLink({
  href,
  label,
  icon: Icon,
  tone = "neutral",
}: {
  href: string;
  label: string;
  icon: LucideIcon;
  tone?: "neutral" | "danger" | "brand";
}) {
  return (
    <Link href={href} title={label} aria-label={label} className={iconButtonClass(tone)}>
      <Icon size={16} strokeWidth={1.9} aria-hidden />
    </Link>
  );
}

export function iconButtonClass(tone: "neutral" | "danger" | "brand" = "neutral") {
  return cx(
    "inline-grid h-8 w-8 place-items-center rounded-lg border border-transparent transition-colors disabled:cursor-not-allowed disabled:opacity-40",
    tone === "danger" && "text-muted hover:border-danger/30 hover:bg-danger-soft hover:text-danger",
    tone === "brand" && "text-icon hover:border-accent/30 hover:bg-accent-soft",
    tone === "neutral" && "text-muted hover:border-line hover:bg-sunken hover:text-ink",
  );
}

/** Coluna de ações no fim de cada linha (Ver, Editar, Excluir…). */
export function RowActions({ children }: { children: ReactNode }) {
  return <div className="flex items-center justify-end gap-0.5">{children}</div>;
}

const buttonBase =
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg px-3.5 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 [&_svg]:shrink-0";

export const buttonVariants = {
  primary: `${buttonBase} bg-brand text-on-brand shadow-[0_1px_2px_rgba(16,24,40,0.08)] hover:bg-brand/85`,
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
  "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink shadow-[0_1px_1px_rgba(16,24,40,0.03)] placeholder:text-muted/70 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 disabled:bg-sunken disabled:text-muted";

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

export { ENROLLMENT_TAG, ENROLLMENT_TONE, KIND_TAG, KIND_TONE, PUBLISH_TAG, PUBLISH_TONE, enrollmentTag, levelTag, levelTone, type TagColor } from "@/lib/tags";
const toneClass: Record<Tone, string> = {
  neutral: "bg-sunken text-muted",
  brand: "bg-accent-soft text-accent",
  ok: "bg-ok-soft text-ok",
  warn: "bg-warn-soft text-warn",
  danger: "bg-danger-soft text-danger",
  // Classes completas (o Tailwind só gera as que aparecem escritas).
  blue: "bg-tag-blue-soft text-tag-blue",
  violet: "bg-tag-violet-soft text-tag-violet",
  teal: "bg-tag-teal-soft text-tag-teal",
  orange: "bg-tag-orange-soft text-tag-orange",
  pink: "bg-tag-pink-soft text-tag-pink",
  indigo: "bg-tag-indigo-soft text-tag-indigo",
  silver: "bg-tag-silver-soft text-tag-silver ring-1 ring-inset ring-tag-silver/25",
  gold: "bg-tag-gold-soft text-tag-gold ring-1 ring-inset ring-tag-gold/30",
};

export const TAG_ICON: Record<TagIcon, LucideIcon> = {
  check: Check,
  partial: CircleSlash,
  x: X,
  clock: Clock3,
  target: Target,
  hourglass: Hourglass,
  approved: CircleCheck,
  failed: CircleX,
  text: FileText,
  link: Link2,
  video: PlayCircle,
  file: Paperclip,
  quiz: ClipboardCheck,
};

/**
 * Etiqueta. Com `tag`, a cor vem do catálogo (e dos ajustes de
 * Configurações › Etiquetas) e, quando definido, mostra o ícone.
 */
export function Badge({ tone, tag, children, dot = false }: { tone?: Tone; tag?: TagKey; children: ReactNode; dot?: boolean }) {
  const def = tag ? TAGS[tag] : undefined;
  const Icon = def?.icon ? TAG_ICON[def.icon] : null;
  return (
    <span
      data-tag={tag}
      className={cx("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-[12px] font-medium", toneClass[tone ?? def?.tone ?? "neutral"])}
    >
      {dot && <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-current" />}
      {Icon && <Icon size={12} strokeWidth={2.4} aria-hidden className="-ml-0.5 shrink-0" />}
      {children}
    </span>
  );
}

/** Status do colaborador: ativo verde, em onboarding violeta, inativo prata. */
export function StatusBadge({ status }: { status: "onboarding" | "ativo" | "inativo" }) {
  if (status === "ativo") return <Badge tag="colaborador.ativo" dot>Ativo</Badge>;
  if (status === "onboarding") return <Badge tag="colaborador.onboarding" dot>Em onboarding</Badge>;
  return <Badge tag="colaborador.inativo" dot>Inativo</Badge>;
}

export function LevelBadge({ name }: { name: string | null | undefined }) {
  if (!name) return null;
  return <Badge tag={levelTag(name)}>{name}</Badge>;
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

export function EmptyState({ title, children, action, icon: Icon }: { title: string; children?: ReactNode; action?: ReactNode; icon?: LucideIcon }) {
  return (
    <div className="grid justify-items-center gap-2 rounded-2xl border border-dashed border-line bg-surface/60 px-6 py-10 text-center">
      {Icon && (
        <span aria-hidden className="mb-1 grid h-11 w-11 place-items-center rounded-xl bg-sunken text-muted">
          <Icon size={20} strokeWidth={1.9} />
        </span>
      )}
      <p className="font-semibold text-heading">{title}</p>
      {children && <p className="max-w-md text-[13px] text-muted">{children}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function Table({ children, flush = false }: { children: ReactNode; flush?: boolean }) {
  return (
    <div className={cx("overflow-x-auto bg-surface", flush ? "" : "rounded-2xl border border-line shadow-[0_1px_2px_rgba(16,24,40,0.04)]")}>
      <table className="w-full min-w-[640px] border-collapse text-left text-sm [&_tbody_tr:hover]:bg-sunken/40 [&_td]:border-t [&_td]:border-line [&_td]:px-4 [&_td]:py-3 [&_th]:bg-sunken/50 [&_th]:px-4 [&_th]:py-3 [&_th]:text-[12.5px] [&_th]:font-semibold [&_th]:text-muted">
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
