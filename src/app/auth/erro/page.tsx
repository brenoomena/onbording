import Link from "next/link";
import { AuthShell } from "@/components/auth-shell";
import { buttonVariants } from "@/components/ui";

const REASONS: Record<string, { title: string; text: string }> = {
  link: {
    title: "Link inválido ou expirado",
    text: "Os links de convite e de senha valem por tempo limitado e só podem ser usados uma vez. Peça um novo link na tela de recuperação de senha ou ao seu gestor.",
  },
  google: {
    title: "Não foi possível entrar com Google",
    text: "O login com Google foi cancelado ou não está configurado. Tente de novo ou entre com e-mail e senha.",
  },
  dominio: {
    title: "Conta Google de outro domínio",
    text: "Use a sua conta Google corporativa para entrar.",
  },
};

export default async function AuthErrorPage({ searchParams }: { searchParams: Promise<{ motivo?: string }> }) {
  const { motivo } = await searchParams;
  const r = REASONS[motivo ?? "link"] ?? REASONS.link;
  return (
    <AuthShell title={r.title}>
      <div className="grid gap-4">
        <p className="text-muted">{r.text}</p>
        <div className="flex flex-wrap gap-2">
          <Link href="/login" className={buttonVariants.primary}>
            Ir para o login
          </Link>
          <Link href="/recuperar-senha" className={buttonVariants.secondary}>
            Pedir novo link
          </Link>
        </div>
      </div>
    </AuthShell>
  );
}
