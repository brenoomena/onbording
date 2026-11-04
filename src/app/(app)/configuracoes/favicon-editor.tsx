"use client";

import { ImagePlus, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { NoticeDialog } from "@/components/forms";
import { buttonVariants, cx } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { setFavicon } from "./actions";

/** Resolução do arquivo: 192×192 atende abas, favoritos e atalho no celular. */
const SIDE = 192;

/**
 * Centraliza a imagem num quadrado transparente de 192×192 (sem cortar nem
 * distorcer) e gera PNG, o formato aceito por todos os navegadores.
 */
async function squarePng(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(SIDE / bitmap.width, SIDE / bitmap.height);
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = SIDE;
  canvas.height = SIDE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, Math.round((SIDE - w) / 2), Math.round((SIDE - h) / 2), w, h);
  bitmap.close();
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/png"));
  if (!blob) throw new Error("png");
  return blob;
}

/** Aba de navegador simulada para conferir o ícone em fundo claro e escuro. */
function TabPreview({ src, dark }: { src: string; dark: boolean }) {
  return (
    <div className={cx("grid gap-1")}>
      <div className="overflow-hidden rounded-lg border border-line" style={{ background: dark ? "#1f2329" : "#dfe3e8" }}>
        <div className="flex items-end px-2 pt-2">
          <div
            className="flex w-[210px] max-w-full items-center gap-2 rounded-t-lg px-3 py-2 text-[12px]"
            style={{ background: dark ? "#35393f" : "#ffffff", color: dark ? "#e8eaed" : "#202124" }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt="" width={16} height={16} className="shrink-0" />
            <span className="truncate">Onboarding Implantta</span>
            <X size={12} aria-hidden className="ml-auto shrink-0 opacity-60" />
          </div>
        </div>
      </div>
      <span className="text-[11.5px] text-muted">Aba do navegador ({dark ? "tema escuro" : "tema claro"})</span>
    </div>
  );
}

export function FaviconEditor({ url }: { url: string | null }) {
  const input = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [pending, start] = useTransition();
  const [notice, setNotice] = useState<{ tone: "ok" | "danger"; message: string } | null>(null);
  const src = url ?? "/favicon-padrao.svg";
  const working = busy || pending;

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
      const blob = await squarePng(file);
      const path = `logo/${crypto.randomUUID()}.png`;
      const { error } = await createClient().storage.from("branding").upload(path, blob, { contentType: "image/png" });
      if (error) throw error;
      const res = await setFavicon(path);
      if (res.error) throw new Error(res.error);
      setNotice({ tone: "ok", message: res.ok ?? "Favicon atualizado." });
      start(() => router.refresh());
    } catch (e) {
      setNotice({ tone: "danger", message: e instanceof Error && e.message.startsWith("Somente") ? e.message : "Não foi possível enviar o favicon. Tente de novo." });
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  async function remove() {
    setBusy(true);
    const res = await setFavicon(null);
    setBusy(false);
    setNotice(res.error ? { tone: "danger", message: res.error } : { tone: "ok", message: res.ok ?? "Removido." });
    start(() => router.refresh());
  }

  return (
    <div className="grid gap-4">
      <div className="grid gap-4 lg:grid-cols-[auto_1fr] lg:items-start">
        <div className="flex items-end gap-4 rounded-xl border border-line p-4">
          {[64, 32, 16].map((s) => (
            <div key={s} className="grid justify-items-center gap-1.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt={s === 64 ? "Favicon atual" : ""} width={s} height={s} className={cx(working && "opacity-50")} />
              <span className="text-[11px] tabular-nums text-muted">
                {s}×{s}
              </span>
            </div>
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <TabPreview src={src} dark={false} />
          <TabPreview src={src} dark />
        </div>
      </div>
      <p className="text-[12.5px] text-muted">
        {url ? "Favicon personalizado em uso." : "Usando o ícone padrão."} Use uma imagem quadrada e simples, como o símbolo da marca, de preferência PNG com fundo
        transparente. Imagens retangulares são centralizadas num quadrado, sem cortar nem distorcer. O navegador pode guardar o ícone antigo por alguns
        instantes; se não mudar, recarregue a página.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <input ref={input} id="favicon-file" type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} />
        <label htmlFor="favicon-file" className={cx(buttonVariants.secondary, "cursor-pointer", working && "pointer-events-none opacity-60")}>
          <ImagePlus size={16} aria-hidden /> {working ? "Enviando…" : url ? "Substituir favicon" : "Enviar favicon"}
        </label>
        {url && !working && (
          <button type="button" onClick={remove} className={buttonVariants.danger}>
            <Trash2 size={15} aria-hidden /> Usar ícone padrão
          </button>
        )}
      </div>
      {notice && <NoticeDialog tone={notice.tone} message={notice.message} onClose={() => setNotice(null)} />}
    </div>
  );
}
