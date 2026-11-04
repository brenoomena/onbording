import { AppWindow, ImageIcon, Palette } from "lucide-react";
import type { Metadata } from "next";
import { Card, PageHeader } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { brandingUrl } from "@/lib/branding";
import { createClient } from "@/lib/supabase/server";
import { sanitizeSizes } from "@/lib/logo-sizes";
import { resolveTheme, sanitizeTheme } from "@/lib/theme-tokens";
import { FaviconEditor } from "./favicon-editor";
import { LogoEditor } from "./logo-editor";
import { ThemeEditor } from "./theme-editor";

export const metadata: Metadata = { title: "Configurações" };

/** Identidade visual do sistema. Exclusivo do perfil Administrador (rota, ações e banco). */
export default async function ConfiguracoesPage() {
  await requireAdmin();
  const supabase = await createClient();
  const { data } = await supabase
    .from("app_settings")
    .select("theme, logo_path, logo_dark_path, symbol_path, symbol_dark_path, favicon_path, logo_sizes, updated_at")
    .eq("id", 1)
    .maybeSingle();
  const theme = resolveTheme(sanitizeTheme(data?.theme));

  return (
    <>
      <PageHeader
        eyebrow="Administração"
        icon={Palette}
        title="Configurações"
        description="Identidade visual do sistema: cores dos modos claro e escuro, logomarca e favicon. As mudanças valem para todas as pessoas e todas as telas."
      />
      <Card
        title="Logomarca e símbolo"
        description="Logo no topo do menu aberto e no login; símbolo no menu recolhido. Ajuste o tamanho de cada uma dentro dos limites, mantendo a proporção."
        icon={ImageIcon}
      >
        <LogoEditor
          urls={{
            logo: brandingUrl(data?.logo_path),
            logo_dark: brandingUrl(data?.logo_dark_path),
            symbol: brandingUrl(data?.symbol_path),
            symbol_dark: brandingUrl(data?.symbol_dark_path),
          }}
          sizes={sanitizeSizes(data?.logo_sizes)}
          sidebar={{ light: theme.light["sidebar-bg"], dark: theme.dark["sidebar-bg"] }}
        />
      </Card>
      <Card
        title="Favicon"
        description="Ícone exibido na aba do navegador, nos favoritos e no atalho da tela inicial do celular."
        icon={AppWindow}
      >
        <FaviconEditor url={brandingUrl(data?.favicon_path)} />
      </Card>
      <Card title="Cores" description="Escolha as cores de cada elemento para o modo claro e para o modo escuro. A prévia mostra o resultado antes de salvar." icon={Palette}>
        <ThemeEditor initial={theme} />
      </Card>
    </>
  );
}
