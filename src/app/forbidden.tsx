import Link from "next/link";
import { AuthShell } from "@/components/auth-shell";
import { buttonVariants } from "@/components/ui";

/** Resposta 403: a rota existe, mas o perfil da pessoa não dá acesso a ela. */
export default function Forbidden() {
  return (
    <AuthShell title="Sem permissão para esta página">
      <div className="grid gap-4">
        <p className="text-muted">O seu perfil de acesso não inclui esta área. Se precisar dela, fale com o administrador.</p>
        <Link href="/painel" className={buttonVariants.primary}>
          Voltar ao painel
        </Link>
      </div>
    </AuthShell>
  );
}
