import type { Metadata } from "next";
import { AuthShell } from "@/components/auth-shell";
import { Alert } from "@/components/ui";
import { DENIED_MESSAGE } from "@/lib/access";
import { publicEnv } from "@/lib/env";
import { signInWithGoogle } from "./actions";
import { GoogleButton } from "./google-button";

export const metadata: Metadata = { title: "Entrar" };

type Key = keyof typeof DENIED_MESSAGE;

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; aviso?: string; erro?: string }> }) {
  const { next, aviso, erro } = await searchParams;
  const key = (erro ?? aviso) as Key | undefined;
  const msg = key && key in DENIED_MESSAGE ? DENIED_MESSAGE[key] : null;
  const domain = publicEnv.googleDomain;
  return (
    <AuthShell title="Entrar na plataforma" description="Entre com a sua conta Google. O acesso é liberado pelo administrador para o e-mail cadastrado.">
      <div className="grid gap-4">
        {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
        <form action={signInWithGoogle}>
          <input type="hidden" name="next" value={next ?? ""} />
          <GoogleButton />
        </form>
        <p className="text-center text-[12.5px] text-muted">
          {domain ? `Use a conta Google @${domain} cadastrada pelo seu gestor.` : "Use a conta Google do e-mail cadastrado pelo seu gestor."}
        </p>
      </div>
    </AuthShell>
  );
}
