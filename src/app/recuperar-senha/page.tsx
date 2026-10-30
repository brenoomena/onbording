import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/auth-shell";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Field, Input } from "@/components/ui";
import { requestReset } from "./actions";

export const metadata: Metadata = { title: "Recuperar senha" };

export default function RecoverPage() {
  return (
    <AuthShell title="Recuperar senha" description="Enviaremos um link para você criar uma nova senha.">
      <ActionForm action={requestReset} resetOnSuccess>
        <Field label="E-mail corporativo" htmlFor="email">
          <Input id="email" name="email" type="email" autoComplete="email" required />
        </Field>
        <SubmitButton pendingLabel="Enviando…" className="w-full">
          Enviar link
        </SubmitButton>
        <Link href="/login" className="text-center text-[13px] font-medium text-accent hover:underline">
          Voltar para o login
        </Link>
      </ActionForm>
    </AuthShell>
  );
}
