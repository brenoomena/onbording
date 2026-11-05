"use client";

import { ChevronDown, ChevronRight, LogOut, Menu, PanelLeftClose, PanelLeftOpen, UserRound, Waypoints, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Avatar } from "@/components/avatar";
import { NoticeHost } from "@/components/forms";
import { ModuleIcon } from "@/components/icons";
import { cx } from "@/components/ui";
import { sizeStyle, type BrandImage } from "@/lib/branding";
import { sectionFor, type MenuGroup } from "@/lib/permissions";
import { MENU_COOKIE } from "@/lib/theme";


interface ShellProps {
  groups: MenuGroup[];
  user: { name: string; role: string; avatarPath: string | null };
  /** Logo (menu aberto) e símbolo (menu recolhido) para o fundo do menu em cada modo. */
  logo: { light: BrandImage | null; dark: BrandImage | null; symbolLight: BrandImage | null; symbolDark: BrandImage | null };
  compact: boolean;
  children: ReactNode;
  /** Janela de ver/editar aberta por cima da página (slot @modal). */
  modal?: ReactNode;
}

/**
 * Estrutura das páginas internas: menu lateral escuro (recolhível), barra
 * superior com o módulo atual e área de conteúdo. No celular o menu abre
 * como gaveta.
 */
export function AppShell({ groups, user, logo, compact: initialCompact, children, modal }: ShellProps) {
  const pathname = usePathname();
  const [compact, setCompact] = useState(initialCompact);
  const [open, setOpen] = useState(false);
  const section = sectionFor(pathname);

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  function toggleCompact() {
    const next = !compact;
    setCompact(next);
    document.cookie = `${MENU_COOKIE}=${next ? "compacto" : "aberto"}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
  }

  const sidebar = (mobile: boolean) => {
    const mini = compact && !mobile;
    return (
      <div className="flex h-full flex-col">
        <div className={cx("relative flex items-start justify-center gap-2 px-4 pb-4 pt-5", mini && "px-2")}>
          <Brand logo={logo} mini={mini} />
          {mobile && (
            <button type="button" onClick={() => setOpen(false)} aria-label="Fechar menu" className="absolute right-3 top-4 rounded-lg p-1.5 text-sidebar-text hover:bg-sidebar-active-bg">
              <X size={20} />
            </button>
          )}
        </div>

        <nav aria-label="Menu principal" className="flex-1 overflow-y-auto px-3 pb-4">
          {groups.map((g, gi) => (
            <div key={g.label ?? `g${gi}`} className="mt-3 grid gap-0.5 first:mt-0">
              {g.label && !mini && (
                <p className="px-3 pb-1.5 pt-2 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-sidebar-muted">{g.label}</p>
              )}
              {g.label && mini && <div aria-hidden className="mx-3 my-2 h-px bg-sidebar-text/10" />}
              {g.items.map((item) => {
                const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    title={mini ? item.label : undefined}
                    className={cx(
                      "group flex items-center gap-3 rounded-lg px-3 py-2 text-[13.5px] font-medium transition-colors",
                      mini && "justify-center px-0",
                      active
                        ? "bg-sidebar-active-bg text-sidebar-active-text shadow-[inset_3px_0_0_rgb(var(--brand))]"
                        : "text-sidebar-text/85 hover:bg-sidebar-active-bg/60 hover:text-sidebar-active-text",
                    )}
                  >
                    <ModuleIcon name={item.icon} size={18} className={active ? "text-brand" : "opacity-80 group-hover:opacity-100"} />
                    {!mini && <span className="truncate">{item.label}</span>}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

      </div>
    );
  };

  return (
    <div className="min-h-dvh">
      {/* Menu lateral fixo (telas largas) */}
      <aside
        className={cx(
          "fixed inset-y-0 left-0 z-30 hidden bg-sidebar-bg transition-[width] duration-200 lg:block",
          compact ? "w-[76px]" : "w-[252px]",
        )}
      >
        {sidebar(false)}
      </aside>

      {/* Gaveta (celular e tablet) */}
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <button type="button" aria-label="Fechar menu" className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-[min(288px,85vw)] bg-sidebar-bg shadow-2xl">{sidebar(true)}</aside>
        </div>
      )}

      <div className={cx("min-w-0 transition-[padding] duration-200", compact ? "lg:pl-[76px]" : "lg:pl-[252px]")}>
        <header className="sticky top-0 z-20 flex h-[60px] items-center gap-3 border-b border-line bg-surface/95 px-4 backdrop-blur sm:px-6">
          <button type="button" onClick={() => setOpen(true)} aria-label="Abrir menu" className="rounded-lg p-2 text-muted hover:bg-sunken hover:text-ink lg:hidden">
            <Menu size={20} />
          </button>
          <button
            type="button"
            onClick={toggleCompact}
            aria-label={compact ? "Expandir menu" : "Recolher menu"}
            title={compact ? "Expandir menu" : "Recolher menu"}
            className="hidden rounded-lg p-2 text-muted hover:bg-sunken hover:text-ink lg:inline-flex"
          >
            {compact ? <PanelLeftOpen size={19} /> : <PanelLeftClose size={19} />}
          </button>
          <div className="min-w-0 leading-tight">
            {section ? (
              <>
                <p className="flex items-center gap-1 truncate text-[11.5px] font-medium text-muted">
                  Onboarding <ChevronRight size={12} aria-hidden /> {section.group}
                </p>
                <p className="flex items-center gap-1.5 truncate text-[14px] font-semibold text-heading">
                  <ModuleIcon name={section.icon} size={15} className="text-icon" />
                  {section.label}
                </p>
              </>
            ) : (
              <p className="text-[14px] font-semibold text-heading">Onboarding</p>
            )}
          </div>
          <UserMenu user={user} />
        </header>

        <main className="min-w-0 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <div className="mx-auto grid max-w-[1320px] gap-6 [&>*]:min-w-0">{children}</div>
        </main>
      </div>
      {modal}
      <NoticeHost />
    </div>
  );
}

function Brand({ logo, mini }: { logo: ShellProps["logo"]; mini: boolean }) {
  // Selo abaixo da logo: identifica o módulo dentro do hub da Implantta.
  const tag = (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-sidebar-text/20 bg-sidebar-active-bg/60 px-3 py-1 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-sidebar-text">
      <Waypoints size={13} strokeWidth={2.2} aria-hidden className="text-brand" />
      Hub
      <span aria-hidden className="h-3 w-px bg-sidebar-text/40" />
      Onbording
    </span>
  );
  // Menu recolhido: símbolo da marca; sem símbolo, a logo reduzida para caber.
  const light = mini ? logo.symbolLight ?? logo.light : logo.light;
  const dark = mini ? logo.symbolDark ?? logo.dark : logo.dark;
  const usingSymbol = mini && !!(logo.symbolLight || logo.symbolDark);
  if (!light && !dark) {
    return (
      <Link href="/painel" className={cx("grid justify-items-center gap-2.5", mini ? "" : "w-full")}>
        <span aria-hidden className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand text-[15px] font-bold text-on-brand">I</span>
        {!mini && tag}
      </Link>
    );
  }
  const img = (im: BrandImage | null, cls: string) =>
    im && (
      <span className={cls}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={im.src}
          alt="Logomarca"
          className="mx-auto max-w-full object-contain"
          style={mini && !usingSymbol ? { width: 44, height: 32 } : sizeStyle(im, usingSymbol ? "symbol" : "logo")}
        />
      </span>
    );
  const same = light?.src === dark?.src && light?.size?.w === dark?.size?.w && light?.size?.h === dark?.size?.h;
  return (
    <Link href="/painel" className={cx("grid min-w-0 justify-items-center gap-2.5", !mini && "w-full")}>
      {same ? img(light, "block") : (
        <>
          {img(light ?? dark, "only-light")}
          {img(dark ?? light, "only-dark")}
        </>
      )}
      {!mini && tag}
    </Link>
  );
}

/**
 * Nome e perfil no topo: ao passar o mouse (ou clicar/tocar) abre o menu com
 * Meu perfil e Sair. Fecha ao sair com o mouse, com Esc ou clicando fora.
 */
function UserMenu({ user }: { user: ShellProps["user"] }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const box = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const menuId = useId();

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        box.current?.querySelector<HTMLButtonElement>("button[aria-haspopup]")?.focus();
      }
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Mouse: abre ao passar e fecha com um pequeno atraso (dá tempo de chegar ao menu).
  const enter = (e: React.PointerEvent) => {
    if (e.pointerType !== "mouse") return;
    if (timer.current) clearTimeout(timer.current);
    setOpen(true);
  };
  const leave = (e: React.PointerEvent) => {
    if (e.pointerType !== "mouse") return;
    timer.current = setTimeout(() => setOpen(false), 180);
  };

  return (
    <div ref={box} className="relative ml-auto" onPointerEnter={enter} onPointerLeave={leave}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={(e) => {
          // Com o mouse o menu já abriu ao passar por cima: o clique só o mantém aberto.
          if ((e.nativeEvent as PointerEvent).pointerType === "mouse") setOpen(true);
          else setOpen((o) => !o);
        }}
        className={cx("flex items-center gap-2 rounded-lg px-2 py-1 hover:bg-sunken", open && "bg-sunken")}
      >
        <span className="hidden text-right leading-tight sm:block">
          <span className="block text-[13px] font-semibold text-heading">{user.name}</span>
          <span className="block text-[11.5px] text-muted">{user.role}</span>
        </span>
        <Avatar name={user.name} path={user.avatarPath} size={32} />
        <ChevronDown size={15} aria-hidden className={cx("text-muted transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div
          id={menuId}
          role="menu"
          aria-label="Minha conta"
          className="absolute right-0 top-full z-30 mt-1 w-60 overflow-hidden rounded-xl border border-line bg-surface p-1.5 shadow-[0_12px_32px_rgba(0,0,0,0.14)]"
        >
          <div className="border-b border-line px-3 pb-2.5 pt-2 sm:hidden">
            <p className="truncate text-[13px] font-semibold text-heading">{user.name}</p>
            <p className="truncate text-[12px] text-muted">{user.role}</p>
          </div>
          <Link
            href="/meu-perfil"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13.5px] font-medium text-ink hover:bg-sunken"
          >
            <UserRound size={16} aria-hidden className="text-icon" /> Meu perfil
          </Link>
          <form action="/sair" method="post">
            <button
              type="submit"
              role="menuitem"
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13.5px] font-medium text-danger hover:bg-danger-soft"
            >
              <LogOut size={16} aria-hidden /> Sair
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
