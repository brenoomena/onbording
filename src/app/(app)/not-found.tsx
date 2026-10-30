import Link from "next/link";
import { EmptyState, buttonVariants } from "@/components/ui";

export default function NotFound() {
  return (
    <EmptyState
      title="Página não encontrada"
      action={<Link href="/painel" className={buttonVariants.primary}>Voltar ao painel</Link>}
    >
      O registro não existe ou você não tem permissão para vê-lo.
    </EmptyState>
  );
}
