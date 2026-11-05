"use client";

import { Monitor, RotateCcw, Smartphone } from "lucide-react";
import { useState } from "react";
import { ActionForm, FormBar, SubmitButton } from "@/components/forms";
import { GOOGLE_BUTTON_CLASS, GoogleMark, LoginScene, googleButtonStyle, type SceneLogo } from "@/components/login-scene";
import { Field, Input, Textarea, cx } from "@/components/ui";
import {
  DEFAULT_LOGIN,
  LOGIN_CARD_LABEL,
  LOGIN_EFFECT_LABEL,
  TEXT_LIMITS,
  diffLogin,
  type LoginCard,
  type LoginEffect,
  type LoginTheme,
} from "@/lib/login-theme";
import { saveLoginTheme } from "./actions";

const HEX = /^#[0-9a-f]{6}$/i;

/** Combinações prontas de degradê e efeito. */
const PRESETS: { name: string; values: Partial<LoginTheme> }[] = [
  { name: "Implantta", values: { from: DEFAULT_LOGIN.from, via: DEFAULT_LOGIN.via, to: DEFAULT_LOGIN.to, effectColor: DEFAULT_LOGIN.effectColor } },
  { name: "Oceano", values: { from: "#22c1e6", via: "#1572b8", to: "#0b1f4d", effectColor: "#bdf2ff" } },
  { name: "Noite", values: { from: "#1f3b73", via: "#122452", to: "#070f26", effectColor: "#7fb6ff" } },
  { name: "Turquesa", values: { from: "#2dd4bf", via: "#0e8aa8", to: "#0c2f55", effectColor: "#c2fff3" } },
  { name: "Violeta", values: { from: "#4f8cf7", via: "#4b3bbf", to: "#1a103f", effectColor: "#d4c8ff" } },
];

export function LoginEditor({ initial, logo, domainHint }: { initial: LoginTheme; logo: SceneLogo | null; domainHint: string }) {
  const [t, setT] = useState<LoginTheme>(initial);
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const set = <K extends keyof LoginTheme>(k: K, v: LoginTheme[K]) => setT((x) => ({ ...x, [k]: v }));
  const custom = Object.keys(diffLogin(t)).length;

  return (
    <ActionForm action={saveLoginTheme}>
      <FormBar info={custom ? `${custom} ${custom === 1 ? "ajuste personalizado" : "ajustes personalizados"}` : "Usando a aparência padrão"}>
        <button
          type="button"
          onClick={() => setT(DEFAULT_LOGIN)}
          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-[13px] font-medium text-muted hover:bg-sunken hover:text-ink"
        >
          <RotateCcw size={15} aria-hidden /> Restaurar padrão
        </button>
        <SubmitButton>Salvar página de login</SubmitButton>
      </FormBar>
      <input type="hidden" name="login" value={JSON.stringify(t)} />

      <div className="grid items-start gap-6 xl:grid-cols-2">
        <div className="grid content-start gap-4">
          <Group title="Fundo degradê" hint="Do canto inicial ao final, passando pela cor do meio.">
            <div className="flex flex-wrap gap-2">
              {PRESETS.map((p) => {
                const active = p.values.from === t.from && p.values.via === t.via && p.values.to === t.to;
                return (
                  <button
                    key={p.name}
                    type="button"
                    onClick={() => setT((x) => ({ ...x, ...p.values }))}
                    className={cx("flex items-center gap-2 rounded-lg border px-2 py-1.5 text-[12.5px] font-medium", active ? "border-brand bg-accent-soft text-accent" : "border-line hover:border-accent/40")}
                  >
                    <span aria-hidden className="h-5 w-8 rounded-md" style={{ background: `linear-gradient(135deg, ${p.values.from}, ${p.values.via}, ${p.values.to})` }} />
                    {p.name}
                  </button>
                );
              })}
            </div>
            <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(150px,1fr))]">
              <Color id="lg-from" label="Cor inicial" value={t.from} onChange={(v) => set("from", v)} />
              <Color id="lg-via" label="Cor do meio" value={t.via} onChange={(v) => set("via", v)} />
              <Color id="lg-to" label="Cor final" value={t.to} onChange={(v) => set("to", v)} />
            </div>
            <Range id="lg-angle" label="Direção" value={t.angle} min={0} max={360} step={5} suffix="°" onChange={(v) => set("angle", v)} />
          </Group>

          <Group title="Efeito animado" hint="Desenhado por cima do degradê. Quem usa “reduzir movimento” no sistema vê o efeito parado.">
            <div className="grid gap-2 [grid-template-columns:repeat(auto-fill,minmax(170px,1fr))]">
              {(Object.keys(LOGIN_EFFECT_LABEL) as LoginEffect[]).map((k) => (
                <Choice key={k} name="lg-effect" checked={t.effect === k} onChange={() => set("effect", k)} label={LOGIN_EFFECT_LABEL[k]} />
              ))}
            </div>
            {t.effect !== "nenhum" && (
              <div className="grid gap-3 sm:grid-cols-[auto_1fr_1fr] sm:items-end xl:grid-cols-1 2xl:grid-cols-[auto_1fr_1fr]">
                <Color id="lg-effect-color" label="Cor das linhas" value={t.effectColor} onChange={(v) => set("effectColor", v)} />
                <Range id="lg-speed" label="Velocidade" value={t.speed} min={1} max={10} onChange={(v) => set("speed", v)} />
                <Range id="lg-intensity" label="Intensidade" value={t.intensity} min={1} max={10} onChange={(v) => set("intensity", v)} />
              </div>
            )}
          </Group>

          <Group title="Textos" hint="Chamada acima do cartão e textos do cartão de entrada.">
            <Field label="Chamada" htmlFor="lg-headline" hint="Deixe em branco para não mostrar.">
              <Input id="lg-headline" value={t.headline} maxLength={TEXT_LIMITS.headline} onChange={(e) => set("headline", e.target.value)} />
            </Field>
            <Field label="Frase de apoio" htmlFor="lg-tagline">
              <Textarea id="lg-tagline" rows={2} value={t.tagline} maxLength={TEXT_LIMITS.tagline} onChange={(e) => set("tagline", e.target.value)} />
            </Field>
            <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(180px,1fr))]">
              <Field label="Título do cartão" htmlFor="lg-title">
                <Input id="lg-title" value={t.title} maxLength={TEXT_LIMITS.title} required onChange={(e) => set("title", e.target.value)} />
              </Field>
              <Color id="lg-text" label="Cor dos textos sobre o fundo" value={t.textColor} onChange={(v) => set("textColor", v)} />
            </div>
            <Field label="Texto do cartão" htmlFor="lg-subtitle">
              <Textarea id="lg-subtitle" rows={2} value={t.subtitle} maxLength={TEXT_LIMITS.subtitle} onChange={(e) => set("subtitle", e.target.value)} />
            </Field>
          </Group>

          <Group title="Cartão e botão">
            <div className="grid gap-2 [grid-template-columns:repeat(auto-fill,minmax(170px,1fr))]">
              {(Object.keys(LOGIN_CARD_LABEL) as LoginCard[]).map((k) => (
                <Choice key={k} name="lg-card" checked={t.card === k} onChange={() => set("card", k)} label={LOGIN_CARD_LABEL[k]} />
              ))}
            </div>
            <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(180px,1fr))]">
              <Color id="lg-btn-bg" label="Fundo do botão" value={t.buttonBg} onChange={(v) => set("buttonBg", v)} />
              <Color id="lg-btn-text" label="Texto do botão" value={t.buttonText} onChange={(v) => set("buttonText", v)} />
            </div>
          </Group>
        </div>

        <div className="grid gap-2 xl:sticky xl:top-24">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[12.5px] font-semibold text-muted">Prévia ao vivo</p>
            <div role="tablist" aria-label="Tamanho da prévia" className="inline-flex rounded-lg border border-line p-0.5">
              {(
                [
                  ["desktop", "Computador", Monitor],
                  ["mobile", "Celular", Smartphone],
                ] as const
              ).map(([k, label, Icon]) => (
                <button
                  key={k}
                  type="button"
                  role="tab"
                  aria-selected={device === k}
                  onClick={() => setDevice(k)}
                  className={cx("inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[12.5px] font-medium", device === k ? "bg-accent-soft text-accent" : "text-muted hover:text-ink")}
                >
                  <Icon size={14} aria-hidden /> {label}
                </button>
              ))}
            </div>
          </div>
          <div className="overflow-hidden rounded-2xl border border-line bg-sunken">
            <div className={cx("mx-auto h-[640px] transition-[width]", device === "mobile" ? "w-[390px] max-w-full" : "w-full")}>
              <LoginScene t={t} logo={logo} title={t.title || DEFAULT_LOGIN.title} description={t.subtitle} hero contained>
                <div className="grid gap-4">
                  <button type="button" tabIndex={-1} className={GOOGLE_BUTTON_CLASS} style={googleButtonStyle(t)}>
                    <GoogleMark /> Entrar com Google
                  </button>
                  <p className="text-center text-[12.5px] text-muted">{domainHint}</p>
                </div>
              </LoginScene>
            </div>
          </div>
        </div>
      </div>
    </ActionForm>
  );
}

function Group({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <fieldset className="grid content-start gap-3 rounded-xl border border-line p-4">
      <legend className="px-1 text-[13px] font-semibold">{title}</legend>
      {hint && <p className="-mt-1 text-[12px] text-muted">{hint}</p>}
      {children}
    </fieldset>
  );
}

function Choice({ name, checked, onChange, label }: { name: string; checked: boolean; onChange: () => void; label: string }) {
  return (
    <label className={cx("flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-[13px]", checked ? "border-brand bg-accent-soft/60 font-medium text-accent" : "border-line hover:border-accent/40")}>
      <input type="radio" name={name} checked={checked} onChange={onChange} className="h-4 w-4 accent-[rgb(var(--brand))]" />
      {label}
    </label>
  );
}

function Color({ id, label, value, onChange }: { id: string; label: string; value: string; onChange: (v: string) => void }) {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <div className="grid gap-1.5">
      <label htmlFor={id} className="text-[13px] font-medium">
        {label}
      </label>
      <div className="flex items-center gap-2">
        <input id={id} type="color" value={value} onChange={(e) => onChange(e.target.value)} className="h-9 w-11 shrink-0 cursor-pointer rounded-lg border border-line bg-surface p-0.5" />
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
          aria-label={`Código da cor: ${label}`}
          className="w-[92px] rounded-lg border border-line bg-surface px-2 py-1.5 font-mono text-[12px] uppercase"
        />
      </div>
    </div>
  );
}

function Range({
  id,
  label,
  value,
  min,
  max,
  step = 1,
  suffix = "",
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="grid gap-1.5">
      <label htmlFor={id} className="flex items-center justify-between text-[13px] font-medium">
        {label} <span className="font-mono text-[12px] text-muted">{value}{suffix}</span>
      </label>
      <input id={id} type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full accent-[rgb(var(--brand))]" />
    </div>
  );
}
