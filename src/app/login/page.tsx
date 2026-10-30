import type { Metadata } from "next";
import { AuthShell } from "@/components/auth-shell";
import { Alert, Button } from "@/components/ui";
import { publicEnv } from "@/lib/env";
import { signInWithGoogle } from "./actions";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Entrar" };

const MESSAGES: Record<string, string> = {
  senha: "Senha definida. Entre com o seu e-mail e a nova senha.",
  saiu: "Você saiu da plataforma.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; aviso?: string }> }) {
  const { next, aviso } = await searchParams;
  return (
    <AuthShell title="Entrar na plataforma" description="Use o e-mail corporativo cadastrado pelo seu gestor.">
      <div className="grid gap-4">
        {aviso && MESSAGES[aviso] && <Alert tone="ok">{MESSAGES[aviso]}</Alert>}
        {publicEnv.googleLogin && (
          <>
            <form action={signInWithGoogle}>
              <input type="hidden" name="next" value={next ?? ""} />
              <Button type="submit" variant="secondary" className="w-full">
                Entrar com Google
              </Button>
            </form>
            <div className="flex items-center gap-3 text-[12px] text-muted">
              <span className="h-px flex-1 bg-line" /> ou com e-mail e senha <span className="h-px flex-1 bg-line" />
            </div>
          </>
        )}
        <LoginForm next={next} />
      </div>
    </AuthShell>
  );
}
