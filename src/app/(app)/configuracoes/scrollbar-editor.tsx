"use client";

import { RotateCcw } from "lucide-react";
import { useState } from "react";
import { ActionForm, FormBar, SubmitButton } from "@/components/forms";
import { cx } from "@/components/ui";
import {
  DEFAULT_SCROLLBAR,
  SB_SHAPES,
  SB_SHAPE_LABEL,
  SB_VISIBILITY,
  SB_VISIBILITY_LABEL,
  SB_WIDTHS,
  SB_WIDTH_LABEL,
  isDefaultScrollbar,
  scrollbarCss,
  type SbColors,
  type SbWidth,
  type Scrollbar,
} from "@/lib/scrollbar";
import { saveScrollbar } from "./actions";
import { HexField } from "./tag-editor";

type Mode = "light" | "dark";
export interface SidebarSwatch {
  bg: string;
  text: string;
  activeBg: string;
  activeText: string;
}

function Options<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <fieldset className="grid gap-1.5">
      <legend className="mb-1.5 text-[12.5px] font-semibold text-heading">{label}</legend>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => (
          <label
            key={o.value}
            className={cx(
              "cursor-pointer rounded-lg border px-3 py-1.5 text-[13px] font-medium transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand",
              value === o.value ? "border-accent bg-accent-soft text-heading" : "border-line bg-surface text-ink hover:border-accent/50",
            )}
          >
            <input type="radio" className="sr-only" checked={value === o.value} onChange={() => onChange(o.value)} />
            {o.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

const MENU = ["Painel", "Minhas trilhas", "Conquistas", "Comunicados", "Trilhas", "Conteúdos", "Pessoas", "Relatórios", "Áreas", "Cargos", "Níveis", "Perfis de acesso", "Configurações", "Auditoria"];

function Preview({ s, mode, sidebar }: { s: Scrollbar; mode: Mode; sidebar: SidebarSwatch }) {
  const cls = `sb-prev-${mode}`;
  const css = scrollbarCss(s, `.${cls}`, { mode });
  return (
    <figure className="grid gap-1.5">
      <figcaption className="text-[12px] font-medium text-muted">{mode === "light" ? "Modo claro" : "Modo escuro"}</figcaption>
      <style dangerouslySetInnerHTML={{ __html: css }} />
      {/* O Chrome só redesenha a barra com outra largura ao recriar o elemento. */}
      <div key={css} className={cx(cls, "h-[260px] overflow-y-auto rounded-xl p-2")} style={{ background: sidebar.bg }} tabIndex={0} aria-label={`Prévia do menu no ${mode === "light" ? "modo claro" : "modo escuro"}`}>
        {MENU.map((m, i) => (
          <div
            key={m}
            className="rounded-md px-3 py-2 text-[12.5px] font-medium"
            style={i === 1 ? { background: sidebar.activeBg, color: sidebar.activeText } : { color: sidebar.text }}
          >
            {m}
          </div>
        ))}
      </div>
    </figure>
  );
}

function Colors({ mode, c, onChange }: { mode: Mode; c: SbColors; onChange: (c: SbColors) => void }) {
  return (
    <fieldset className="grid gap-2 rounded-xl border border-line p-3">
      <legend className="px-1 text-[12.5px] font-semibold text-heading">Cores · {mode === "light" ? "modo claro" : "modo escuro"}</legend>
      <HexField label="Barra" value={c.thumb} onChange={(v) => onChange({ ...c, thumb: v })} />
      <HexField label="Ao passar o mouse" value={c.hover} onChange={(v) => onChange({ ...c, hover: v })} />
      <div className="flex flex-wrap items-center gap-2">
        {c.track ? (
          <HexField label="Trilho" value={c.track} onChange={(v) => onChange({ ...c, track: v })} />
        ) : (
          <span className="rounded-lg border border-dashed border-line px-2 py-1.5 text-[12px] text-muted">Trilho transparente (fundo do menu)</span>
        )}
        <label className="flex items-center gap-1.5 text-[12.5px] text-ink">
          <input type="checkbox" checked={!c.track} onChange={(e) => onChange({ ...c, track: e.target.checked ? "" : mode === "light" ? "#1c2c44" : "#18263a" })} className="h-4 w-4 accent-[rgb(var(--brand))]" />
          Trilho transparente
        </label>
      </div>
    </fieldset>
  );
}

/** Barra de rolagem do menu lateral: largura, formato, quando aparece e cores. */
export function ScrollbarEditor({ initial, sidebar }: { initial: Scrollbar; sidebar: Record<Mode, SidebarSwatch> }) {
  const [s, setS] = useState<Scrollbar>(initial);
  const set = (patch: Partial<Scrollbar>) => setS((cur) => ({ ...cur, ...patch }));
  return (
    <ActionForm action={saveScrollbar}>
      <FormBar info={isDefaultScrollbar(s) ? "Barra no padrão" : "Barra personalizada"}>
        <button
          type="button"
          onClick={() => setS(DEFAULT_SCROLLBAR)}
          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-[13px] font-medium text-muted hover:bg-sunken hover:text-ink"
        >
          <RotateCcw size={15} aria-hidden /> Restaurar padrão
        </button>
        <SubmitButton>Salvar barra de rolagem</SubmitButton>
      </FormBar>
      <input type="hidden" name="scrollbar" value={JSON.stringify(s)} />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,400px)]">
        <div className="grid content-start gap-5">
          <Options
            label="Largura"
            value={s.width}
            options={(Object.keys(SB_WIDTHS) as SbWidth[]).map((w) => ({ value: w, label: `${SB_WIDTH_LABEL[w]} · ${SB_WIDTHS[w]} px` }))}
            onChange={(width) => set({ width })}
          />
          <Options label="Formato" value={s.shape} options={SB_SHAPES.map((v) => ({ value: v, label: SB_SHAPE_LABEL[v] }))} onChange={(shape) => set({ shape })} />
          <Options label="Quando aparece" value={s.visibility} options={SB_VISIBILITY.map((v) => ({ value: v, label: SB_VISIBILITY_LABEL[v] }))} onChange={(visibility) => set({ visibility })} />
          <p className="text-[12px] text-muted">
            A barra só aparece quando o menu tem mais itens do que cabem na tela. No Firefox a largura segue o padrão do navegador (fina ou normal).
          </p>
        </div>
        <div className="grid content-start gap-3 sm:grid-cols-2">
          <Preview s={s} mode="light" sidebar={sidebar.light} />
          <Preview s={s} mode="dark" sidebar={sidebar.dark} />
        </div>
      </div>
      {s.visibility !== "oculta" && (
        <div className="grid gap-3 lg:grid-cols-2">
          <Colors mode="light" c={s.light} onChange={(light) => set({ light })} />
          <Colors mode="dark" c={s.dark} onChange={(dark) => set({ dark })} />
        </div>
      )}
    </ActionForm>
  );
}
