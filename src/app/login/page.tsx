import type { Metadata } from "next";
import { AuthShell } from "@/components/auth-shell";
import { googleButtonStyle } from "@/components/login-scene";
import { Alert } from "@/components/ui";
import { DENIED_MESSAGE, domainHint } from "@/lib/access";
import { getBranding } from "@/lib/branding";
import { publicEnv } from "@/lib/env";
import { signInWithGoogle } from "./actions";
import { GoogleButton } from "./google-button";

export const metadata: Metadata = { title: "Entrar" };

type Key = keyof typeof DENIED_MESSAGE;

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; aviso?: string; erro?: string }> }) {
  const { next, aviso, erro } = await searchParams;
  const key = (erro ?? aviso) as Key | undefined;
  const msg = key && key in DENIED_MESSAGE ? DENIED_MESSAGE[key] : null;
  const t = (await getBranding()).login;
  return (
    <AuthShell title={t.title} description={t.subtitle} hero>
      <div className="grid gap-4">
        {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
        <form action={signInWithGoogle}>
          <input type="hidden" name="next" value={next ?? ""} />
          <GoogleButton style={googleButtonStyle(t)} />
        </form>
        <p className="text-center text-[12.5px] text-muted">{domainHint(publicEnv.googleDomain)}</p>
      </div>
    </AuthShell>
  );
}
