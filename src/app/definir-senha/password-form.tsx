"use client";

import { ActionForm, SubmitButton } from "@/components/forms";
import { Field, Input } from "@/components/ui";
import { setPassword } from "./actions";

export function PasswordForm({ submitLabel = "Salvar senha e entrar" }: { submitLabel?: string }) {
  return (
    <ActionForm action={setPassword}>
      {(state) => (
        <>
          <Field label="Nova senha" htmlFor="password" hint="Mínimo de 10 caracteres." error={state.fieldErrors?.password}>
            <Input id="password" name="password" type="password" autoComplete="new-password" minLength={10} required />
          </Field>
          <Field label="Repita a senha" htmlFor="confirm" error={state.fieldErrors?.confirm}>
            <Input id="confirm" name="confirm" type="password" autoComplete="new-password" required />
          </Field>
          <SubmitButton className="w-full">{submitLabel}</SubmitButton>
        </>
      )}
    </ActionForm>
  );
}
