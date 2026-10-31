"use client";

import { createContext, startTransition, useActionState, useContext, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Button, buttonVariants, cx, iconButtonClass } from "@/components/ui";
import type { ActionState } from "@/lib/action-state";

const PendingContext = createContext<boolean | null>(null);

export function SubmitButton({
  children,
  pendingLabel = "Salvando…",
  variant = "primary",
  className,
  name,
  value,
}: {
  children: ReactNode;
  pendingLabel?: string;
  variant?: keyof typeof buttonVariants;
  className?: string;
  /** Com name/value, o botão clicado vai junto no envio (ex.: status=publicado). */
  name?: string;
  value?: string;
}) {
  const ctx = useContext(PendingContext);
  const { pending: formPending } = useFormStatus();
  const pending = ctx ?? formPending;
  // Com vários botões no mesmo formulário, só o clicado mostra "Salvando…".
  const [clicked, setClicked] = useState(false);
  useEffect(() => {
    if (!pending) setClicked(false);
  }, [pending]);
  const showPending = pending && (clicked || !name);
  return (
    <Button
      type="submit"
      name={name}
      value={value}
      variant={variant}
      disabled={pending}
      aria-disabled={pending}
      className={className}
      onClick={() => setClicked(true)}
    >
      {showPending ? pendingLabel : children}
    </Button>
  );
}

/**
 * Formulário ligado a uma Server Action que devolve ActionState.
 * Envia via onSubmit (e não pela prop action) para que o React não
 * limpe os campos quando a validação falha.
 */
export function ActionForm({
  action,
  children,
  className,
  resetOnSuccess = false,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  children: ReactNode | ((state: ActionState) => ReactNode);
  className?: string;
  resetOnSuccess?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, {} as ActionState);
  const ref = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (resetOnSuccess && state.ok) ref.current?.reset();
  }, [state, resetOnSuccess]);

  return (
    <PendingContext.Provider value={pending}>
      <form
        ref={ref}
        className={cx("grid gap-4", className)}
        onSubmit={(event) => {
          event.preventDefault();
          // Inclui o botão clicado (name/value), como num envio normal do navegador.
          const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
          const data = new FormData(event.currentTarget, submitter?.name ? submitter : undefined);
          startTransition(() => formAction(data));
        }}
      >
        <StateNotice state={state} />
        {typeof children === "function" ? children(state) : children}
      </form>
    </PendingContext.Provider>
  );
}

/** Botão que dispara uma Server Action; com `confirm`, pede confirmação numa janela antes. */
export function ActionButton({
  action,
  label,
  pendingLabel = "Aguarde…",
  variant = "secondary",
  hidden,
  confirm = false,
  confirmLabel = "Confirmar",
  confirmText,
  icon,
  iconOnly = false,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  label: string;
  pendingLabel?: string;
  variant?: keyof typeof buttonVariants;
  hidden?: Record<string, string>;
  confirm?: boolean;
  confirmLabel?: string;
  /** Texto explicativo da janela de confirmação. */
  confirmText?: string;
  /** Ícone do botão (elemento, ex.: <Trash2 size={16} />). */
  icon?: ReactNode;
  /** Mostra só o ícone (ações nas linhas das listagens). */
  iconOnly?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, {} as ActionState);
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const inputs = hidden && Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />);

  // Fecha a confirmação quando a ação termina (o resultado aparece em outra janela).
  useEffect(() => {
    if (!pending) dialog.current?.close();
  }, [pending]);

  return (
    <PendingContext.Provider value={pending}>
      <form action={formAction} className="inline-flex">
        {inputs}
        {confirm ? (
          <>
            <button
              type="button"
              onClick={() => dialog.current?.showModal()}
              title={iconOnly ? label : undefined}
              aria-label={iconOnly ? label : undefined}
              className={iconOnly ? iconButtonClass(variant === "danger" ? "danger" : "neutral") : cx(buttonVariants[variant], "py-1.5 text-[13px]")}
            >
              {iconOnly ? icon : <>{icon}{label}</>}
            </button>
            <dialog
              ref={dialog}
              aria-labelledby={titleId}
              onClick={(e) => e.target === dialog.current && !pending && dialog.current?.close()}
              className={DIALOG}
            >
              <div className="grid gap-4 p-5">
                <div className="flex items-start gap-3">
                  <ToneIcon tone={variant === "danger" ? "danger" : "warn"} />
                  <div className="grid gap-1">
                    <h2 id={titleId} className="text-[16px] font-semibold">{label}?</h2>
                    <p className="text-[13.5px] text-muted">{confirmText ?? "Tem certeza? Confirme para continuar."}</p>
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => dialog.current?.close()} disabled={pending} className={buttonVariants.secondary}>
                    Cancelar
                  </button>
                  <SubmitButton variant={variant === "danger" ? "danger" : "primary"} pendingLabel={pendingLabel}>
                    {confirmLabel}
                  </SubmitButton>
                </div>
              </div>
            </dialog>
          </>
        ) : iconOnly ? (
          <button type="submit" disabled={pending} title={label} aria-label={label} className={iconButtonClass(variant === "danger" ? "danger" : "neutral")}>
            {icon}
          </button>
        ) : (
          <SubmitButton variant={variant} pendingLabel={pendingLabel} className="py-1.5 text-[13px]">
            {icon}
            {label}
          </SubmitButton>
        )}
        <StateNotice state={state} />
      </form>
    </PendingContext.Provider>
  );
}

const DIALOG =
  "m-auto w-[min(440px,calc(100vw-2rem))] rounded-xl border border-line bg-surface p-0 text-ink shadow-[0_18px_50px_rgba(0,0,0,0.25)] backdrop:bg-ink/50 backdrop:backdrop-blur-[1px]";

/** Mostra numa janela o resultado de uma ação (sucesso ou erro). */
function StateNotice({ state }: { state: ActionState }) {
  const [shown, setShown] = useState<ActionState | null>(null);
  useEffect(() => {
    if (state.error || state.ok) setShown(state);
  }, [state]);
  if (!shown) return null;
  return (
    <NoticeDialog
      tone={shown.error ? "danger" : "ok"}
      message={shown.error ?? shown.ok ?? ""}
      onClose={() => setShown(null)}
    />
  );
}

/**
 * Aviso em janela sobre a página. Sucesso fecha sozinho em poucos segundos;
 * erro e atenção ficam até a pessoa clicar em OK (ou Esc).
 */
export function NoticeDialog({
  tone,
  message,
  title,
  onClose,
  duration = 2600,
}: {
  tone: "ok" | "danger" | "warn" | "brand";
  message: ReactNode;
  title?: string;
  onClose: () => void;
  /** Tempo até fechar sozinho (só avisos de sucesso). */
  duration?: number;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const close = useRef(onClose);
  close.current = onClose;

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (!d.open) d.showModal();
    const onEnd = () => close.current();
    d.addEventListener("close", onEnd);
    const timer = tone === "ok" ? setTimeout(() => d.close(), duration) : undefined;
    return () => {
      d.removeEventListener("close", onEnd);
      if (timer) clearTimeout(timer);
    };
  }, [tone, message, duration]);

  const heading = title ?? (tone === "ok" ? "Pronto" : tone === "danger" ? "Não foi possível concluir" : tone === "warn" ? "Atenção" : "Aviso");
  return (
    <dialog
      ref={ref}
      role={tone === "danger" ? "alertdialog" : "dialog"}
      aria-label={heading}
      onClick={(e) => e.target === ref.current && ref.current?.close()}
      className={DIALOG}
    >
      <div className="grid gap-4 p-5">
        <div className="flex items-start gap-3">
          <ToneIcon tone={tone} />
          <div className="grid gap-1">
            <h2 className="text-[16px] font-semibold">{heading}</h2>
            <div className="text-[14px]">{message}</div>
          </div>
        </div>
        <div className="flex justify-end">
          <button type="button" autoFocus onClick={() => ref.current?.close()} className={buttonVariants[tone === "danger" ? "secondary" : "primary"]}>
            OK
          </button>
        </div>
      </div>
      {tone === "ok" && <span aria-hidden className="block h-1 origin-left bg-ok/70" style={{ animation: `shrink ${duration}ms linear forwards` }} />}
    </dialog>
  );
}

function ToneIcon({ tone }: { tone: "ok" | "danger" | "warn" | "brand" }) {
  const cls = { ok: "bg-ok-soft text-ok", danger: "bg-danger-soft text-danger", warn: "bg-warn-soft text-warn", brand: "bg-accent-soft text-accent" }[tone];
  return (
    <span aria-hidden className={cx("grid h-9 w-9 shrink-0 place-items-center rounded-full", cls)}>
      <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {tone === "ok" ? <path d="M5 10.5l3.2 3.2L15 7" /> : tone === "brand" ? <path d="M10 9v5M10 6h.01" /> : <path d="M10 6v5M10 14h.01" />}
      </svg>
    </span>
  );
}

/**
 * Barra de ações do formulário (salvar, publicar…), presa no topo da tela
 * enquanto a pessoa rola a página, para os botões estarem sempre à vista.
 */
export function FormBar({ children, info }: { children: ReactNode; info?: ReactNode }) {
  return (
    <div className="sticky top-[57px] z-10 -mx-1 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface/95 px-3 py-2.5 shadow-[0_4px_14px_rgba(0,0,0,0.06)] backdrop-blur lg:top-2">
      <div className="min-w-0 text-[13px] text-muted">{info}</div>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}

/** Aviso vindo do endereço (?aviso=…) depois de criar algo: mostra em janela e limpa o endereço. */
export function PageNotice({ message, tone = "ok" }: { message: ReactNode; tone?: "ok" | "warn" | "brand" }) {
  const [open, setOpen] = useState(true);
  if (!open) return null;
  return (
    <NoticeDialog
      tone={tone}
      message={message}
      duration={6000}
      onClose={() => {
        setOpen(false);
        const url = new URL(window.location.href);
        url.searchParams.delete("aviso");
        window.history.replaceState(null, "", url);
      }}
    />
  );
}
