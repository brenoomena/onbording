import type { ReactNode } from "react";
import { LoginScene } from "@/components/login-scene";
import { getBranding, logoFor, sizeStyle } from "@/lib/branding";

/** Telas de acesso (login, sem permissão…) com a aparência de Configurações › Página de login. */
export async function AuthShell({
  title,
  description,
  hero = false,
  children,
}: {
  title: string;
  description?: ReactNode;
  hero?: boolean;
  children: ReactNode;
}) {
  const branding = await getBranding();
  const t = branding.login;
  // O fundo é o degradê: usa a versão da logo para fundo escuro quando ele for escuro.
  const img = logoFor(branding, t.to);
  return (
    <LoginScene t={t} logo={img ? { src: img.src, style: sizeStyle(img, "logo") } : null} title={title} description={description} hero={hero}>
      {children}
    </LoginScene>
  );
}
