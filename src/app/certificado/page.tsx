import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth-shell";
import { VerifyForm } from "./verify-form";

export const metadata: Metadata = { title: "Validar certificado" };

/** Página pública: digite o código impresso no certificado. */
export default async function ValidarPage({ searchParams }: { searchParams: Promise<{ codigo?: string }> }) {
  const { codigo } = await searchParams;
  const code = (codigo ?? "").toUpperCase().replace(/[^0-9A-F]/g, "");
  if (code.length === 12) redirect(`/certificado/${code.slice(0, 4)}-${code.slice(4, 8)}-${code.slice(8)}`);
  return (
    <AuthShell title="Validar certificado" description="Digite o código de validação impresso no certificado (ex.: A1B2-C3D4-E5F6).">
      <VerifyForm invalid={codigo !== undefined} />
    </AuthShell>
  );
}
