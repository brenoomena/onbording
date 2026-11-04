"use client";

import { BookOpenCheck, FileStack, LayoutDashboard, Moon, RotateCcw, Route, Sun, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { ActionForm, FormBar, SubmitButton } from "@/components/forms";
import { cx } from "@/components/ui";
import { DEFAULT_THEME, TOKEN_GROUPS, isHex, themeStyle, type Mode, type TokenKey } from "@/lib/theme-tokens";
import { saveTheme } from "./actions";

type Colors = Record<Mode, Record<TokenKey, string>>;

/**
 * Editor das cores dos dois modos com prévia ao vivo. A prévia aplica as
 * variáveis só dentro do quadro, sem mudar a tela até salvar.
 */
export function ThemeEditor({ initial }: { initial: Colors }) {
  const [colors, setColors] = useState<Colors>(initial);
  const [mode, setMode] = useState<Mode>("light");
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const changedFromDefault = useMemo(
    () => (["light", "dark"] as const).reduce((n, m) => n + TOKEN_GROUPS.flatMap((g) => g.tokens).filter((t) => colors[m][t.key] !== DEFAULT_THEME[m][t.key]).length, 0),
    [colors],
  );

  function set(m: Mode, key: TokenKey, value: string) {
    setColors((c) => ({ ...c, [m]: { ...c[m], [key]: value.toLowerCase() } }));
  }

  return (
    <ActionForm action={saveTheme}>
      <FormBar info={changedFromDefault ? `${changedFromDefault} ${changedFromDefault === 1 ? "cor personalizada" : "cores personalizadas"}` : "Usando as cores padrão Implantta"}>
        <button
          type="button"
          onClick={() => setColors((c) => ({ ...c, [mode]: { ...DEFAULT_THEME[mode] } }))}
          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-[13px] font-medium text-muted hover:bg-sunken hover:text-ink"
        >
          <RotateCcw size={15} aria-hidden /> Restaurar padrão do modo {mode === "light" ? "claro" : "escuro"}
        </button>
        <SubmitButton>Salvar cores</SubmitButton>
      </FormBar>
      <input type="hidden" name="theme" value={JSON.stringify(colors)} />

      <div role="tablist" aria-label="Modo" className="inline-flex w-fit rounded-xl border border-line p-1">
        {(
          [
            ["light", "Modo claro", Sun],
            ["dark", "Modo escuro", Moon],
          ] as const
        ).map(([m, label, Icon]) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            onClick={() => setMode(m)}
            className={cx(
              "inline-flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-[13px] font-semibold transition-colors",
              mode === m ? "bg-accent-soft text-accent" : "text-muted hover:text-ink",
            )}
          >
            <Icon size={15} aria-hidden /> {label}
          </button>
        ))}
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-[1fr_440px]">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
          {TOKEN_GROUPS.map((g) => (
            <fieldset key={g.title} className="grid content-start gap-3 rounded-xl border border-line p-4">
              <legend className="px-1 text-[13px] font-semibold">{g.title}</legend>
              <p className="-mt-1 text-[12px] text-muted">{g.hint}</p>
              {g.tokens.map((t) => {
                const value = colors[mode][t.key];
                const id = `c-${mode}-${t.key}`;
                const draftKey = `${mode}:${t.key}`;
                return (
                  <div key={t.key} className="flex items-center gap-3">
                    <input
                      id={id}
                      type="color"
                      value={value}
                      onChange={(e) => set(mode, t.key, e.target.value)}
                      className="h-9 w-11 shrink-0 cursor-pointer rounded-lg border border-line bg-surface p-0.5"
                      aria-label={`${t.label} (${mode === "light" ? "claro" : "escuro"})`}
                    />
                    <label htmlFor={id} className="min-w-0 flex-1 text-[13px] leading-tight">
                      {t.label}
                      {value !== DEFAULT_THEME[mode][t.key] && <span className="ml-1 text-[11px] font-semibold text-accent">· personalizada</span>}
                    </label>
                    <input
                      type="text"
                      inputMode="text"
                      spellCheck={false}
                      value={drafts[draftKey] ?? value}
                      onChange={(e) => {
                        const v = e.target.value.trim();
                        setDrafts((d) => ({ ...d, [draftKey]: v }));
                        if (isHex(v)) set(mode, t.key, v);
                      }}
                      onBlur={() => setDrafts((d) => {
                        const { [draftKey]: _drop, ...rest } = d;
                        return rest;
                      })}
                      aria-label={`Código da cor: ${t.label}`}
                      className="w-[88px] rounded-lg border border-line bg-surface px-2 py-1.5 font-mono text-[12px] uppercase"
                    />
                  </div>
                );
              })}
            </fieldset>
          ))}
        </div>

        <div className="xl:sticky xl:top-24">
          <p className="mb-2 text-[12.5px] font-semibold text-muted">Prévia · {mode === "light" ? "modo claro" : "modo escuro"}</p>
          <Preview colors={colors[mode]} mode={mode} />
        </div>
      </div>
    </ActionForm>
  );
}

/** Miniatura da plataforma pintada com as cores escolhidas. */
function Preview({ colors, mode }: { colors: Record<TokenKey, string>; mode: Mode }) {
  return (
    <div
      style={{ ...themeStyle(colors, mode), colorScheme: mode }}
      className="overflow-hidden rounded-2xl border border-line bg-bg text-ink shadow-sm"
      aria-label="Prévia das cores"
    >
      <div className="grid grid-cols-[130px_1fr]">
        <div className="grid content-start gap-1 bg-sidebar-bg p-3">
          <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold text-sidebar-active-text">
            <span className="grid h-5 w-5 place-items-center rounded bg-brand text-[10px] font-bold text-on-brand">I</span>
            Onboarding
          </p>
          <p className="px-1 text-[8.5px] font-semibold uppercase tracking-[0.1em] text-sidebar-muted">Gestão</p>
          {[
            [LayoutDashboard, "Painel", false],
            [Route, "Trilhas", true],
            [FileStack, "Conteúdos", false],
            [Users, "Colaboradores", false],
          ].map(([I, label, active]) => {
            const Icon = I as typeof Route;
            return (
              <span
                key={label as string}
                className={cx(
                  "flex items-center gap-1.5 rounded-md px-1.5 py-1 text-[10.5px] font-medium",
                  active ? "bg-sidebar-active-bg text-sidebar-active-text" : "text-sidebar-text",
                )}
              >
                <Icon size={11} className={active ? "text-brand" : ""} aria-hidden /> {label as string}
              </span>
            );
          })}
        </div>
        <div className="grid content-start gap-2.5 p-3">
          <div className="rounded-lg border border-line bg-surface bg-[linear-gradient(115deg,rgb(var(--header-bg)),rgb(var(--surface)/0)_62%)] p-2.5">
            <span className="inline-flex items-center gap-1 rounded-full border border-line px-1.5 text-[8.5px] text-muted">
              <span className="h-1 w-1 rounded-full bg-brand" /> Gestão
            </span>
            <p className="mt-1 flex items-center gap-1.5 text-[14px] font-bold text-heading">
              <span className="grid h-6 w-6 place-items-center rounded-md bg-icon-bg text-icon"><Route size={13} aria-hidden /></span>
              Trilhas
            </p>
            <p className="text-[10px] text-muted">Subtítulo e textos de apoio</p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg border border-line bg-surface p-2">
              <p className="text-[8.5px] font-semibold uppercase text-muted">Matrículas</p>
              <p className="text-[15px] font-bold text-accent">128</p>
            </div>
            <div className="rounded-lg border border-line bg-surface p-2">
              <p className="text-[8.5px] font-semibold uppercase text-muted">Concluídas</p>
              <p className="text-[15px] font-bold text-ok">64</p>
            </div>
          </div>
          <div className="rounded-lg border border-line bg-surface">
            <p className="border-b border-line bg-sunken px-2 py-1 text-[9px] font-semibold text-muted">Trilha</p>
            <p className="flex items-center justify-between px-2 py-1.5 text-[10.5px]">
              <span className="flex items-center gap-1"><BookOpenCheck size={11} className="text-icon" aria-hidden /> Onboarding Comercial</span>
              <span className="text-accent underline">Abrir</span>
            </p>
            <p className="flex items-center justify-between border-t border-line bg-accent-soft px-2 py-1.5 text-[10.5px] text-accent">
              <span>Item selecionado</span>
              <span className="text-[9px]">Destaque suave</span>
            </p>
          </div>
          <div className="flex gap-1.5">
            <span className="rounded-md bg-brand px-2 py-1 text-[10px] font-semibold text-on-brand">Botão principal</span>
            <span className="rounded-md border border-line bg-surface px-2 py-1 text-[10px] font-semibold text-ink">Secundário</span>
          </div>
          <p className="text-[10px] text-ink">Texto corrido do conteúdo.</p>
        </div>
      </div>
    </div>
  );
}
