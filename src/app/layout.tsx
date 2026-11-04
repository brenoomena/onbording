import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { THEME_COOKIE, parseTheme, themeAttr } from "@/lib/theme";
import "@fontsource-variable/inter";
import { brandingUrl, getBranding } from "@/lib/branding";
import { themeCss } from "@/lib/theme-tokens";
import "./globals.css";

/** Favicon: o enviado em Configurações; sem ele, o ícone padrão. */
export async function generateMetadata(): Promise<Metadata> {
  const favicon = brandingUrl((await getBranding()).faviconPath);
  return {
    title: { default: "Onboarding Implantta", template: "%s · Onboarding Implantta" },
    description: "Plataforma de onboarding e desenvolvimento dos colaboradores Implantta.",
    robots: { index: false, follow: false },
    icons: favicon
      ? { icon: [{ url: favicon, type: "image/png", sizes: "192x192" }], apple: [{ url: favicon, sizes: "192x192" }] }
      : { icon: [{ url: "/favicon-padrao.svg", type: "image/svg+xml" }] },
  };
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f3f9fe" },
    { media: "(prefers-color-scheme: dark)", color: "#26292d" },
  ],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Tema escolhido em Meu perfil (cookie); sem escolha, segue o sistema.
  const theme = parseTheme((await cookies()).get(THEME_COOKIE)?.value);
  const branding = await getBranding();
  return (
    <html lang="pt-BR" data-theme={themeAttr(theme)}>
      <head>
        {/* Cores da identidade visual (padrão + personalização do Administrador). Valores validados como #RRGGBB. */}
        <style id="theme-tokens" dangerouslySetInnerHTML={{ __html: themeCss(branding.theme) }} />
      </head>
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
