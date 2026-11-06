"use client";

import { RotateCcw } from "lucide-react";
import { useState } from "react";
import { ActionForm, FormBar, SubmitButton } from "@/components/forms";
import { Select, TAG_ICON, cx } from "@/components/ui";
import {
  TAG_GROUPS,
  TAGS,
  TONES,
  TONE_LABEL,
  type TagKey,
  type TagOverride,
  type TagTheme,
} from "@/lib/tag-catalog";
import type { Tone } from "@/lib/tags";
import { saveTagTheme } from "./actions";

export interface Swatch {
  lt: string;
  lb: string;
  dt: string;
  db: string;
}

const HEX = /^#[0-9a-f]{6}$/i;

function colorsOf(
  key: TagKey,
  o: TagOverride | undefined,
  palette: Record<Tone, Swatch>,
): Swatch {
  if (o && "custom" in o) return o.custom;
  return palette[o && "tone" in o ? o.tone : TAGS[key].tone];
}

function Chip({ k, c, mode }: { k: TagKey; c: Swatch; mode: "l" | "d" }) {
  const def = TAGS[k];
  const Icon = def.icon ? TAG_ICON[def.icon] : null;
  const [fg, bg] = mode === "l" ? [c.lt, c.lb] : [c.dt, c.db];
  return (
    <span
      className="inline-flex max-w-full items-center gap-1.5 truncate whitespace-nowrap rounded-full px-2 py-0.5 text-[12px] font-medium"
      style={{ color: fg, background: bg }}
    >
      {Icon && (
        <Icon
          size={12}
          strokeWidth={2.4}
          aria-hidden
          className="-ml-0.5 shrink-0"
        />
      )}
      <span className="truncate">{def.label}</span>
    </span>
  );
}

/** Lista todas as etiquetas por tipo de informação, com troca de cor e prévia nos dois modos. */
export function TagEditor({
  initial,
  palette,
}: {
  initial: TagTheme;
  palette: Record<Tone, Swatch>;
}) {
  const [t, setT] = useState<TagTheme>(initial);
  const custom = Object.keys(t).length;
  const set = (k: TagKey, o: TagOverride | null) =>
    setT((cur) => {
      const next = { ...cur };
      if (!o || ("tone" in o && o.tone === TAGS[k].tone)) delete next[k];
      else next[k] = o;
      return next;
    });

  return (
    <ActionForm action={saveTagTheme}>
      <FormBar
        info={
          custom
            ? `${custom} ${custom === 1 ? "etiqueta ajustada" : "etiquetas ajustadas"}`
            : "Todas nas cores padrão"
        }
      >
        <button
          type="button"
          onClick={() => setT({})}
          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-[13px] font-medium text-muted hover:bg-sunken hover:text-ink"
        >
          <RotateCcw size={15} aria-hidden /> Restaurar todas
        </button>
        <SubmitButton>Salvar etiquetas</SubmitButton>
      </FormBar>
      <input type="hidden" name="tags" value={JSON.stringify(t)} />

      <div className="grid gap-4">
        {TAG_GROUPS.map((g) => (
          <fieldset
            key={g.key}
            className="grid gap-1 rounded-xl border border-line p-4"
          >
            <legend className="px-1 text-[13px] font-semibold">
              {g.label}
            </legend>
            <p className="-mt-1 mb-2 text-[12px] text-muted">{g.where}</p>
            <div className="grid gap-2">
              {(Object.keys(g.tags) as TagKey[]).map((k) => {
                const o = t[k];
                const c = colorsOf(k, o, palette);
                const value =
                  o && "custom" in o
                    ? "custom"
                    : o && "tone" in o
                      ? o.tone
                      : TAGS[k].tone;
                return (
                  <div
                    key={k}
                    className={cx(
                      "grid items-center gap-2 rounded-lg px-2 py-2 sm:grid-cols-[minmax(0,1fr)_auto_auto]",
                      o && "bg-accent-soft/40",
                    )}
                  >
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <span className="inline-flex min-w-0 rounded-full bg-white p-1 ring-1 ring-black/5">
                        <Chip k={k} c={c} mode="l" />
                      </span>
                      <span className="inline-flex min-w-0 rounded-full bg-[#1d232c] p-1">
                        <Chip k={k} c={c} mode="d" />
                      </span>
                      {o && (
                        <span className="text-[11px] font-semibold text-accent">
                          ajustada
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-[210px]">
                        <Select
                          aria-label={`Cor da etiqueta ${TAGS[k].label}`}
                          value={value}
                          onChange={(e) => {
                            const v = e.target.value;
                            if (v === "custom") set(k, { custom: { ...c } });
                            else set(k, { tone: v as Tone });
                          }}
                          className="py-1 text-[13px]"
                        >
                          {TONES.map((tone) => (
                            <option key={tone} value={tone}>
                              {TONE_LABEL[tone]}
                              {tone === TAGS[k].tone ? " (padrão)" : ""}
                            </option>
                          ))}
                          <option value="custom">Cores próprias…</option>
                        </Select>
                      </div>
                      <button
                        type="button"
                        onClick={() => set(k, null)}
                        disabled={!o}
                        className="rounded-md p-1.5 text-muted hover:bg-sunken hover:text-ink disabled:opacity-30"
                        title="Voltar à cor padrão"
                        aria-label={`Voltar à cor padrão: ${TAGS[k].label}`}
                      >
                        <RotateCcw size={15} aria-hidden />
                      </button>
                    </div>
                    {o && "custom" in o ? (
                      <div className="flex flex-wrap gap-2 sm:col-span-3">
                        {(
                          [
                            ["lt", "Texto · claro"],
                            ["lb", "Fundo · claro"],
                            ["dt", "Texto · escuro"],
                            ["db", "Fundo · escuro"],
                          ] as const
                        ).map(([f, label]) => (
                          <HexField
                            key={f}
                            label={label}
                            value={o.custom[f]}
                            onChange={(v) =>
                              set(k, { custom: { ...o.custom, [f]: v } })
                            }
                          />
                        ))}
                      </div>
                    ) : (
                      <span className="hidden sm:block" />
                    )}
                  </div>
                );
              })}
            </div>
          </fieldset>
        ))}
      </div>
    </ActionForm>
  );
}

export function HexField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <label className="flex items-center gap-1.5 rounded-lg border border-line bg-surface px-2 py-1 text-[12px] text-muted">
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-6 w-7 cursor-pointer rounded border border-line bg-surface p-0"
        aria-label={label}
      />
      <span className="min-w-[78px]">{label}</span>
      <input
        type="text"
        spellCheck={false}
        value={draft ?? value}
        onChange={(e) => {
          const v = e.target.value.trim();
          setDraft(v);
          if (HEX.test(v)) onChange(v.toLowerCase());
        }}
        onBlur={() => setDraft(null)}
        aria-label={`Código: ${label}`}
        className="w-[78px] rounded border border-line bg-surface px-1.5 py-0.5 font-mono text-[11.5px] uppercase text-ink"
      />
    </label>
  );
}
