"use client";

import { ImagePlus, Lock, Ruler, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { NoticeDialog } from "@/components/forms";
import { buttonVariants, cx } from "@/components/ui";
import { fromHeight, fromWidth, kindOf, sizeRange, type LogoSizes, type LogoSlot, type Size } from "@/lib/logo-sizes";
import { createClient } from "@/lib/supabase/client";
import { setLogo, setLogoSize } from "./actions";

/** Resolução máxima do arquivo guardado (a exibição usa o tamanho configurado). */
const MAX_FILE = { logo: { w: 640, h: 200 }, symbol: { w: 256, h: 256 } } as const;

/**
 * Reduz a imagem para a resolução máxima da variante, mantendo a proporção,
 * e converte para WebP (preserva transparência). SVG não é aceito: arquivos
 * SVG podem carregar scripts.
 */
async function fitImage(file: File, slot: LogoSlot): Promise<{ blob: Blob; ratio: number }> {
  const bitmap = await createImageBitmap(file);
  const max = MAX_FILE[kindOf(slot)];
  const ratio = bitmap.width / bitmap.height;
  const scale = Math.min(1, max.w / bitmap.width, max.h / bitmap.height);
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas");
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/webp", 0.92));
  if (!blob) throw new Error("webp");
  return { blob, ratio };
}

const SLOTS: { slot: LogoSlot; title: string; hint: string; bg: (s: { light: string; dark: string }) => { label: string; color: string }[] }[] = [
  {
    slot: "logo",
    title: "Logo principal",
    hint: "Menu aberto e tela de login. PNG ou WebP com fundo transparente fica melhor.",
    bg: (s) => [
      { label: "Fundo claro", color: "#ffffff" },
      { label: "Menu (modo claro)", color: s.light },
    ],
  },
  {
    slot: "logo_dark",
    title: "Logo para fundo escuro (opcional)",
    hint: "Versão clara da logo, usada sobre fundos escuros (menu escuro e modo escuro).",
    bg: (s) => [
      { label: "Menu (modo escuro)", color: s.dark },
      { label: "Fundo escuro", color: "#151a21" },
    ],
  },
  {
    slot: "symbol",
    title: "Símbolo · menu recolhido",
    hint: "Só o ícone da marca, de preferência quadrado. Aparece quando o menu está recolhido.",
    bg: (s) => [{ label: "Menu recolhido (modo claro)", color: s.light }],
  },
  {
    slot: "symbol_dark",
    title: "Símbolo para fundo escuro (opcional)",
    hint: "Versão do símbolo para o menu recolhido no modo escuro.",
    bg: (s) => [{ label: "Menu recolhido (modo escuro)", color: s.dark }],
  },
];

export function LogoEditor({
  urls,
  sizes,
  sidebar,
}: {
  urls: Record<LogoSlot, string | null>;
  sizes: LogoSizes;
  sidebar: { light: string; dark: string };
}) {
  return (
    <div className="grid gap-6">
      <div>
        <h3 className="mb-3 text-[13px] font-semibold uppercase tracking-[0.06em] text-muted">Menu aberto e login</h3>
        <div className="grid gap-4 xl:grid-cols-2">
          {SLOTS.slice(0, 2).map((s) => (
            <Slot key={s.slot} {...s} backgrounds={s.bg(sidebar)} url={urls[s.slot]} size={sizes[s.slot] ?? null} />
          ))}
        </div>
      </div>
      <div>
        <h3 className="mb-3 text-[13px] font-semibold uppercase tracking-[0.06em] text-muted">Menu recolhido</h3>
        <div className="grid gap-4 xl:grid-cols-2">
          {SLOTS.slice(2).map((s) => (
            <Slot key={s.slot} {...s} backgrounds={s.bg(sidebar)} url={urls[s.slot]} size={sizes[s.slot] ?? null} />
          ))}
        </div>
      </div>
    </div>
  );
}

function Slot({
  slot,
  url,
  size,
  title,
  hint,
  backgrounds,
}: {
  slot: LogoSlot;
  url: string | null;
  size: Size | null;
  title: string;
  hint: string;
  backgrounds: { label: string; color: string }[];
}) {
  const input = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ tone: "ok" | "danger"; message: string } | null>(null);
  const [pending, start] = useTransition();
  // Proporção lida da própria imagem publicada (largura ÷ altura).
  const [ratio, setRatio] = useState<number | null>(null);
  const [draft, setDraft] = useState<Size | null>(size);
  const [typing, setTyping] = useState<{ w?: string; h?: string }>({});
  const id = `logo-${slot}`;
  const symbol = kindOf(slot) === "symbol";

  useEffect(() => setDraft(size), [size]);
  useEffect(() => {
    setRatio(null);
    if (!url) return;
    const im = new Image();
    im.onload = () => setRatio(im.naturalWidth / im.naturalHeight);
    im.src = url;
  }, [url]);

  const range = ratio ? sizeRange(slot, ratio) : null;
  // Sem tamanho salvo: mostra o padrão calculado pela proporção.
  const current = draft ?? (ratio ? (symbol ? fromHeight(slot, ratio, 36) : fromWidth(slot, ratio, 175)) : null);
  const changed = !!current && (!size || current.w !== size.w || current.h !== size.h);

  async function onFile(file: File | undefined) {
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      setNotice({ tone: "danger", message: "Envie a imagem em PNG, JPG ou WebP." });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setNotice({ tone: "danger", message: "A imagem passa de 10 MB. Escolha uma menor." });
      return;
    }
    setBusy(true);
    try {
      const { blob, ratio: r } = await fitImage(file, slot);
      const path = `logo/${crypto.randomUUID()}.webp`;
      const { error } = await createClient().storage.from("branding").upload(path, blob, { contentType: "image/webp" });
      if (error) throw error;
      const res = await setLogo(slot, path, r);
      if (res.error) throw new Error(res.error);
      setNotice({ tone: "ok", message: res.ok ?? "Imagem atualizada." });
      start(() => router.refresh());
    } catch (e) {
      setNotice({ tone: "danger", message: e instanceof Error && e.message.startsWith("Somente") ? e.message : "Não foi possível enviar a imagem. Tente de novo." });
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  async function remove() {
    setBusy(true);
    const res = await setLogo(slot, null);
    setBusy(false);
    setNotice(res.error ? { tone: "danger", message: res.error } : { tone: "ok", message: res.ok ?? "Removida." });
    start(() => router.refresh());
  }

  async function saveSize() {
    if (!current || !ratio) return;
    setBusy(true);
    const res = await setLogoSize(slot, current.w, ratio);
    setBusy(false);
    setNotice(res.error ? { tone: "danger", message: res.error } : { tone: "ok", message: res.ok ?? "Tamanho salvo." });
    start(() => router.refresh());
  }

  // Digitação livre; ao sair do campo (ou Enter) o valor é ajustado aos limites e à proporção.
  function commit(side: "w" | "h") {
    if (!ratio) return;
    const raw = Number((side === "w" ? typing.w : typing.h) ?? "");
    setTyping({});
    if (!Number.isFinite(raw) || raw <= 0) return;
    setDraft(side === "w" ? fromWidth(slot, ratio, raw) : fromHeight(slot, ratio, raw));
  }

  const working = busy || pending;
  return (
    <section className="grid content-start gap-3 rounded-xl border border-line p-4">
      <div>
        <h4 className="text-[14px] font-semibold">{title}</h4>
        <p className="text-[12.5px] text-muted">{hint}</p>
      </div>
      <div className={cx("grid gap-2", backgrounds.length > 1 ? "grid-cols-2" : "grid-cols-1")}>
        {backgrounds.map((b) => (
          <div key={b.label} className="grid gap-1">
            <div className={cx("grid place-items-center overflow-hidden rounded-lg border border-line p-3", symbol ? "h-24" : "h-28")} style={{ background: b.color }}>
              {url && current ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={url}
                  alt={`${title} sobre ${b.label}`}
                  className={cx("max-w-full object-contain", working && "opacity-50")}
                  style={{ width: current.w, height: current.h }}
                />
              ) : url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={url} alt="" className="max-h-14 max-w-full object-contain" />
              ) : (
                <span className="text-[11.5px]" style={{ color: b.color === "#ffffff" ? "#69717b" : "#a6afb9" }}>
                  Sem imagem
                </span>
              )}
            </div>
            <span className="text-[11.5px] text-muted">{b.label}</span>
          </div>
        ))}
      </div>

      {url && range && current && (
        <fieldset className="grid gap-2 rounded-lg bg-sunken/60 p-3">
          <legend className="sr-only">Tamanho de exibição</legend>
          <p className="flex items-center gap-1.5 text-[12.5px] font-semibold">
            <Ruler size={14} aria-hidden className="text-icon" /> Tamanho de exibição
          </p>
          <div className="flex flex-wrap items-end gap-2">
            <label className="grid gap-1 text-[12px] font-medium">
              Largura (px)
              <input
                type="number"
                inputMode="numeric"
                min={range.wMin}
                max={range.wMax}
                value={typing.w ?? current.w}
                onChange={(e) => setTyping({ w: e.target.value })}
                onBlur={() => commit("w")}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), commit("w"))}
                className="w-24 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-[13px] tabular-nums"
                aria-describedby={`${id}-limits`}
              />
            </label>
            <span className="pb-2 text-muted" title="Proporção mantida" aria-label="Proporção mantida">
              <Lock size={14} aria-hidden />
            </span>
            <label className="grid gap-1 text-[12px] font-medium">
              Altura (px)
              <input
                type="number"
                inputMode="numeric"
                min={range.hMin}
                max={range.hMax}
                value={typing.h ?? current.h}
                onChange={(e) => setTyping({ h: e.target.value })}
                onBlur={() => commit("h")}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), commit("h"))}
                className="w-24 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-[13px] tabular-nums"
                aria-describedby={`${id}-limits`}
              />
            </label>
            <button type="button" onClick={saveSize} disabled={!changed || working} className={cx(buttonVariants.primary, "py-1.5 text-[13px]")}>
              Salvar tamanho
            </button>
          </div>
          <input
            type="range"
            min={range.wMin}
            max={range.wMax}
            value={current.w}
            onChange={(e) => setDraft(fromWidth(slot, ratio!, Number(e.target.value)))}
            aria-label="Ajustar tamanho"
            className="w-full accent-[rgb(var(--brand))]"
          />
          <p id={`${id}-limits`} className="text-[11.5px] text-muted">
            Limites para esta imagem: largura de {range.wMin} a {range.wMax} px · altura de {range.hMin} a {range.hMax} px. A proporção é mantida
            automaticamente; valores fora da faixa são ajustados ao limite.
          </p>
        </fieldset>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <input ref={input} id={id} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} />
        <label htmlFor={id} className={cx(buttonVariants.secondary, "cursor-pointer", working && "pointer-events-none opacity-60")}>
          <ImagePlus size={16} aria-hidden /> {working ? "Enviando…" : url ? "Substituir" : "Enviar imagem"}
        </label>
        {url && !working && (
          <button type="button" onClick={remove} className={buttonVariants.danger}>
            <Trash2 size={15} aria-hidden /> Remover
          </button>
        )}
      </div>
      {notice && <NoticeDialog tone={notice.tone} message={notice.message} onClose={() => setNotice(null)} />}
    </section>
  );
}
