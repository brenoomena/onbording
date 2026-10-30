import Link from "next/link";
import { AuthShell } from "@/components/auth-shell";
import { buttonVariants } from "@/components/ui";

export default function NoAccessPage() {
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
