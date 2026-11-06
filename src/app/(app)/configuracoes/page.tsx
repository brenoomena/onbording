import { AppWindow, Award, ImageIcon, LogIn, Palette, PanelLeft, Settings, Tags, type LucideIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Card, PageHeader, cx } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { brandingUrl, logoFor, sizeStyle } from "@/lib/branding";
import { domainHint } from "@/lib/access";
import { publicEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { sanitizeSizes } from "@/lib/logo-sizes";
import { resolveLogin, sanitizeLogin } from "@/lib/login-theme";
import { resolveCertificate, sanitizeCertificate } from "@/lib/certificate";
import { siteOrigin } from "@/lib/certificate-server";
import { CertificateEditor } from "./certificate-editor";
import { TagEditor, type Swatch } from "./tag-editor";
import { TONES, TONE_VARS, sanitizeTags } from "@/lib/tag-catalog";
import { STATUS } from "@/lib/theme-tokens";
import type { Tone } from "@/lib/tags";
import { resolveTheme, sanitizeTheme } from "@/lib/theme-tokens";
import { FaviconEditor } from "./favicon-editor";
import { LoginEditor } from "./login-editor";
import { LogoEditor } from "./logo-editor";
import { ScrollbarEditor } from "./scrollbar-editor";
import { ThemeEditor } from "./theme-editor";
import { sanitizeScrollbar } from "@/lib/scrollbar";

export const metadata: Metadata = { title: "Configurações" };

type Secao = "marca" | "cores" | "menu" | "etiquetas" | "login" | "certificado";

const SECOES: { key: Secao; label: string; hint: string; icon: LucideIcon }[] = [
  { key: "marca", label: "Marca", hint: "Logomarca, símbolo e favicon", icon: ImageIcon },
  { key: "cores", label: "Cores do sistema", hint: "Modos claro e escuro", icon: Palette },
  { key: "menu", label: "Menu lateral", hint: "Barra de rolagem", icon: PanelLeft },
  { key: "etiquetas", label: "Etiquetas", hint: "Cores de cada etiqueta", icon: Tags },
  { key: "login", label: "Página de login", hint: "Fundo, efeito, textos e botão", icon: LogIn },
  { key: "certificado", label: "Certificado", hint: "Modelo, assinatura e validação", icon: Award },
];

/** Identidade visual do sistema. Exclusivo do perfil Administrador (rota, ações e banco). */
export default async function ConfiguracoesPage({ searchParams }: { searchParams: Promise<{ secao?: string }> }) {
  await requireAdmin();
  const { secao: raw } = await searchParams;
  const secao: Secao = SECOES.some((s) => s.key === raw) ? (raw as Secao) : "marca";
  const supabase = await createClient();
  const { data } = await supabase
    .from("app_settings")
    .select("theme, logo_path, logo_dark_path, symbol_path, symbol_dark_path, favicon_path, logo_sizes, login_theme, certificate_theme, tag_theme, menu_theme, updated_at")
    .eq("id", 1)
    .maybeSingle();
  const theme = resolveTheme(sanitizeTheme(data?.theme));
  const login = resolveLogin(sanitizeLogin(data?.login_theme));
  const certificate = resolveCertificate(sanitizeCertificate(data?.certificate_theme));

  // Mesma escolha de logo da página de login (versão para fundo escuro, se houver).
  const sizes = sanitizeSizes(data?.logo_sizes);
  const brand = {
    theme: {},
    logoPath: data?.logo_path ?? null,
    logoDarkPath: data?.logo_dark_path ?? null,
    symbolPath: null,
    symbolDarkPath: null,
    faviconPath: null,
    sizes,
    login,
    certificate,
    tags: sanitizeTags(data?.tag_theme),
    scrollbar: sanitizeScrollbar((data?.menu_theme as Record<string, unknown> | null)?.scrollbar),
  };
  const loginLogo = logoFor(brand, login.to);

  return (
    <>
      <PageHeader
        eyebrow="Administração"
        icon={Settings}
        title="Configurações"
        description="Identidade visual do sistema. As mudanças valem para todas as pessoas e todas as telas."
      />
      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-5 lg:grid-cols-[230px_minmax(0,1fr)]">
        <nav aria-label="Seções das configurações" className="min-w-0 lg:sticky lg:top-24">
          <ul className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 lg:mx-0 lg:grid lg:overflow-visible lg:px-0 lg:pb-0">
            {SECOES.map((s) => {
              const active = s.key === secao;
              const Icon = s.icon;
              return (
                <li key={s.key} className="shrink-0">
                  <Link
                    href={`/configuracoes?secao=${s.key}`}
                    aria-current={active ? "page" : undefined}
                    className={cx(
                      "flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors",
                      active ? "border-accent/30 bg-accent-soft text-accent" : "border-transparent text-ink hover:border-line hover:bg-surface",
                    )}
                  >
                    <span className={cx("grid h-8 w-8 shrink-0 place-items-center rounded-lg", active ? "bg-surface text-accent" : "bg-icon-bg text-icon")}>
                      <Icon size={16} aria-hidden />
                    </span>
                    <span className="grid leading-tight">
                      <span className="text-[13.5px] font-semibold">{s.label}</span>
                      <span className="hidden text-[11.5px] text-muted lg:block">{s.hint}</span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="grid min-w-0 gap-5">
          {secao === "marca" && (
            <>
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
                  sizes={sizes}
                  sidebar={{ light: theme.light["sidebar-bg"], dark: theme.dark["sidebar-bg"] }}
                />
              </Card>
              <Card title="Favicon" description="Ícone exibido na aba do navegador, nos favoritos e no atalho da tela inicial do celular." icon={AppWindow}>
                <FaviconEditor url={brandingUrl(data?.favicon_path)} />
              </Card>
            </>
          )}
          {secao === "cores" && (
            <Card title="Cores do sistema" description="Escolha as cores de cada elemento para o modo claro e para o modo escuro. A prévia mostra o resultado antes de salvar." icon={Palette}>
              <ThemeEditor initial={theme} />
            </Card>
          )}
          {secao === "menu" && (
            <Card
              title="Barra de rolagem do menu lateral"
              description="Aparece quando o menu tem mais itens do que cabem na tela. Escolha largura, formato, quando ela aparece e as cores nos modos claro e escuro. A prévia mostra o resultado antes de salvar."
              icon={PanelLeft}
            >
              <ScrollbarEditor
                initial={brand.scrollbar}
                sidebar={{
                  light: { bg: theme.light["sidebar-bg"], text: theme.light["sidebar-text"], activeBg: theme.light["sidebar-active-bg"], activeText: theme.light["sidebar-active-text"] },
                  dark: { bg: theme.dark["sidebar-bg"], text: theme.dark["sidebar-text"], activeBg: theme.dark["sidebar-active-bg"], activeText: theme.dark["sidebar-active-text"] },
                }}
              />
            </Card>
          )}
          {secao === "etiquetas" && (
            <Card
              title="Etiquetas"
              description="Todas as etiquetas do sistema, agrupadas pelo que informam. Troque a cor por outra da paleta ou defina cores próprias para os modos claro e escuro. A prévia mostra os dois modos."
              icon={Tags}
            >
              <TagEditor initial={brand.tags} palette={tagPalette(theme)} />
            </Card>
          )}
          {secao === "certificado" && (
            <Card
              title="Certificado"
              description="Emitido automaticamente quando a pessoa conclui uma trilha. O modelo vale para todos os certificados, inclusive os já emitidos; os dados de cada um (nome, trilha, data, carga e média) ficam guardados como na conclusão."
              icon={Award}
            >
              <CertificateEditor
                initial={certificate}
                brandLogoUrl={logoFor(brand, "#ffffff")?.src ?? null}
                storageBase={`${publicEnv.supabaseUrl.replace(/\/$/, "")}/storage/v1/object/public/branding`}
                validationBase={await siteOrigin()}
              />
            </Card>
          )}
          {secao === "login" && (
            <Card
              title="Página de login"
              description="Fundo em degradê, efeito animado, textos, cartão e botão da tela de entrada (e das telas de acesso negado). A prévia ao lado mostra o resultado antes de salvar."
              icon={LogIn}
            >
              <LoginEditor
                initial={login}
                logo={loginLogo ? { src: loginLogo.src, style: sizeStyle(loginLogo, "logo") } : null}
                domainHint={domainHint(publicEnv.googleDomain)}
              />
            </Card>
          )}
        </div>
      </div>
    </>
  );
}

/** Cores (hex) de cada cor da paleta nos dois modos, para a prévia das etiquetas. */
function tagPalette(theme: ReturnType<typeof resolveTheme>): Record<Tone, Swatch> {
  const pick = (mode: "light" | "dark", v: string) => (theme[mode] as Record<string, string>)[v] ?? STATUS[mode][v] ?? "#888888";
  return Object.fromEntries(
    TONES.map((tone) => {
      const [t, b] = TONE_VARS[tone];
      return [tone, { lt: pick("light", t), lb: pick("light", b), dt: pick("dark", t), db: pick("dark", b) }];
    }),
  ) as Record<Tone, Swatch>;
}
