"use client";

import { createContext, startTransition, useActionState, useContext, useEffect, useRef, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Alert, Button, buttonVariants, cx } from "@/components/ui";
import type { ActionState } from "@/lib/action-state";

const PendingContext = createContext<boolean | null>(null);

export function SubmitButton({
  children,
  pendingLabel = "Salvando…",
  variant = "primary",
  className,
}: {
  children: ReactNode;
  pendingLabel?: string;
  variant?: keyof typeof buttonVariants;
  className?: string;
}) {
  const ctx = useContext(PendingContext);
  const { pending: formPending } = useFormStatus();
  const pending = ctx ?? formPending;
  return (
    <Button type="submit" variant={variant} disabled={pending} aria-disabled={pending} className={className}>
      {pending ? pendingLabel : children}
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
          const data = new FormData(event.currentTarget);
          startTransition(() => formAction(data));
        }}
      >
        {state.error && <Alert>{state.error}</Alert>}
        {state.ok && <Alert tone="ok">{state.ok}</Alert>}
        {typeof children === "function" ? children(state) : children}
      </form>
    </PendingContext.Provider>
  );
}

/** Botão que dispara uma Server Action, com confirmação em duas etapas quando `confirm` é verdadeiro. */
export function ActionButton({
  action,
  label,
  pendingLabel = "Aguarde…",
  variant = "secondary",
  hidden,
  confirm = false,
  confirmLabel = "Confirmar",
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  label: string;
  pendingLabel?: string;
  variant?: keyof typeof buttonVariants;
  hidden?: Record<string, string>;
  confirm?: boolean;
  confirmLabel?: string;
}) {
  const [state, formAction, pending] = useActionState(action, {} as ActionState);
  const inputs = hidden && Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />);
  return (
    <PendingContext.Provider value={pending}>
      <form action={formAction} className="inline-flex flex-col items-end gap-1">
        {inputs}
        {confirm ? (
          <details className="relative">
            <summary
              className={cx(buttonVariants[variant], "cursor-pointer list-none py-1.5 text-[13px] [&::-webkit-details-marker]:hidden")}
            >
              {label}
            </summary>
            <div className="absolute right-0 z-10 mt-1 flex items-center gap-2 whitespace-nowrap rounded-lg border border-line bg-surface p-2 shadow-sm">
              <span className="text-[12px] text-muted">Tem certeza?</span>
              <SubmitButton variant={variant === "danger" ? "danger" : "primary"} pendingLabel={pendingLabel} className="py-1 text-[12px]">
                {confirmLabel}
              </SubmitButton>
            </div>
          </details>
        ) : (
          <SubmitButton variant={variant} pendingLabel={pendingLabel} className="py-1.5 text-[13px]">
            {label}
          </SubmitButton>
        )}
        {state.error && <span className="max-w-xs text-right text-[12px] text-danger">{state.error}</span>}
        {state.ok && <span className="max-w-xs text-right text-[12px] text-ok">{state.ok}</span>}
      </form>
    </PendingContext.Provider>
  );
}
