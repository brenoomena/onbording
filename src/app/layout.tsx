import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Onboarding Implantta", template: "%s · Onboarding Implantta" },
  description: "Plataforma de onboarding e desenvolvimento dos colaboradores Implantta.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f3f9fe" },
    { media: "(prefers-color-scheme: dark)", color: "#26292d" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
