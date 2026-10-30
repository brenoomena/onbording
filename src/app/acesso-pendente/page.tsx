import type { Metadata } from "next";
import { AuthShell } from "@/components/auth-shell";
import { Button } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Acesso não liberado" };

export default async function PendingPage({ searchParams }: { searchParams: Promise<{ motivo?: string }> }) {
  const { motivo } = await searchParams;
  const me = await getCurrentUser();
  const inactive = motivo === "inativo";
  return (
    <AuthShell
      title={inactive ? "Conta desativada" : "Acesso ainda não liberado"}
      description={me?.email ? `Conta: ${me.email}` : undefined}
    >
      <div className="grid gap-4">
        <p className="text-muted">
          {inactive
            ? "Sua conta foi desativada por um administrador. Se acha que isso é um engano, fale com o seu gestor."
            : "Seu login funciona, mas o seu cadastro de colaborador ainda não foi criado. Peça ao administrador da plataforma para cadastrar este e-mail."}
        </p>
        <form action="/sair" method="post">
          <Button type="submit" variant="secondary">
            Sair
          </Button>
        </form>
      </div>
    </AuthShell>
  );
}
