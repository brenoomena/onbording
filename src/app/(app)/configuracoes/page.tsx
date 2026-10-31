import { ImageIcon, Palette } from "lucide-react";
import type { Metadata } from "next";
import { Card, PageHeader } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { brandingUrl } from "@/lib/branding";
import { createClient } from "@/lib/supabase/server";
import { resolveTheme, sanitizeTheme } from "@/lib/theme-tokens";
import { LogoEditor } from "./logo-editor";
import { ThemeEditor } from "./theme-editor";

export const metadata: Metadata = { title: "Configurações" };

/** Identidade visual do sistema. Exclusivo do perfil Administrador (rota, ações e banco). */
export default async function ConfiguracoesPage() {
  await requireAdmin();
  const supabase = await createClient();
  const { data } = await supabase.from("app_settings").select("theme, logo_path, logo_dark_path, updated_at").eq("id", 1).maybeSingle();
  const theme = resolveTheme(sanitizeTheme(data?.theme));

  return (
    <>
      <PageHeader
        eyebrow="Administração"
        icon={Palette}
        title="Configurações"
        description="Identidade visual do sistema: cores dos modos claro e escuro e logomarca. As mudanças valem para todas as pessoas e todas as telas."
      />
      <Card title="Logomarca" description="Aparece no topo do menu lateral, acima do nome Onboarding, e na tela de login." icon={ImageIcon}>
        <LogoEditor light={brandingUrl(data?.logo_path)} dark={brandingUrl(data?.logo_dark_path)} sidebar={{ light: theme.light["sidebar-bg"], dark: theme.dark["sidebar-bg"] }} />
      </Card>
      <Card title="Cores" description="Escolha as cores de cada elemento para o modo claro e para o modo escuro. A prévia mostra o resultado antes de salvar." icon={Palette}>
        <ThemeEditor initial={theme} />
      </Card>
    </>
  );
}
