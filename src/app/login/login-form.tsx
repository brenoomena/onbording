"use client";

import Link from "next/link";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Field, Input } from "@/components/ui";
import { signIn } from "./actions";

export function LoginForm({ next }: { next?: string }) {
  return (
    <ActionForm action={signIn}>
      <input type="hidden" name="next" value={next ?? ""} />
      <Field label="E-mail corporativo" htmlFor="email">
        <Input id="email" name="email" type="email" autoComplete="email" required placeholder="nome@implantta.com.br" />
      </Field>
      <Field label="Senha" htmlFor="password">
        <Input id="password" name="password" type="password" autoComplete="current-password" required />
      </Field>
      <SubmitButton pendingLabel="Entrando…" className="w-full">
        Entrar
      </SubmitButton>
      <Link href="/recuperar-senha" className="text-center text-[13px] font-medium text-accent hover:underline">
        Esqueci minha senha
      </Link>
    </ActionForm>
  );
}
