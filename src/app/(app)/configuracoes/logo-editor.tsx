"use client";

import { ImagePlus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { NoticeDialog } from "@/components/forms";
import { buttonVariants, cx } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { setLogo } from "./actions";

const MAX_W = 640;
const MAX_H = 200;

/**
 * Reduz a imagem para caber em 640×200 mantendo a proporção e converte para
 * WebP (preserva transparência). SVG não é aceito: arquivos SVG podem
 * carregar scripts.
 */
async function fitLogo(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_W / bitmap.width, MAX_H / bitmap.height);
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
  return blob;
}

export function LogoEditor({
  light,
  dark,
  sidebar,
}: {
  light: string | null;
  dark: string | null;
  sidebar: { light: string; dark: string };
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Slot
        variant="light"
        url={light}
        title="Logo principal"
        hint="Usada no login e no menu. PNG ou WebP com fundo transparente fica melhor."
        backgrounds={[
          { label: "Fundo claro", color: "#ffffff" },
          { label: "Menu (modo claro)", color: sidebar.light },
        ]}
      />
      <Slot
        variant="dark"
        url={dark}
        title="Logo para fundo escuro (opcional)"
        hint="Versão clara da logo. Quando enviada, aparece sobre fundos escuros (menu escuro e modo escuro)."
        backgrounds={[
          { label: "Menu (modo escuro)", color: sidebar.dark },
          { label: "Fundo escuro", color: "#151a21" },
        ]}
      />
    </div>
  );
}

function Slot({
  variant,
  url,
  title,
  hint,
  backgrounds,
}: {
  variant: "light" | "dark";
  url: string | null;
  title: string;
  hint: string;
  backgrounds: { label: string; color: string }[];
}) {
  const input = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ tone: "ok" | "danger"; message: string } | null>(null);
  const [pending, start] = useTransition();
  const id = `logo-${variant}`;

  async function onFile(file: File | undefined) {
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      setNotice({ tone: "danger", message: "Envie a logomarca em PNG, JPG ou WebP." });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setNotice({ tone: "danger", message: "A imagem passa de 10 MB. Escolha uma menor." });
      return;
    }
    setBusy(true);
    try {
      const blob = await fitLogo(file);
      const path = `logo/${crypto.randomUUID()}.webp`;
      const { error } = await createClient().storage.from("branding").upload(path, blob, { contentType: "image/webp" });
      if (error) throw error;
      const res = await setLogo(variant, path);
      if (res.error) throw new Error(res.error);
      setNotice({ tone: "ok", message: res.ok ?? "Logomarca atualizada." });
      start(() => router.refresh());
    } catch (e) {
      setNotice({ tone: "danger", message: e instanceof Error && e.message.startsWith("Somente") ? e.message : "Não foi possível enviar a logomarca. Tente de novo." });
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  async function remove() {
    setBusy(true);
    const res = await setLogo(variant, null);
    setBusy(false);
    setNotice(res.error ? { tone: "danger", message: res.error } : { tone: "ok", message: res.ok ?? "Removida." });
    start(() => router.refresh());
  }

  const working = busy || pending;
  return (
    <section className="grid content-start gap-3 rounded-xl border border-line p-4">
      <div>
        <h3 className="text-[14px] font-semibold">{title}</h3>
        <p className="text-[12.5px] text-muted">{hint}</p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {backgrounds.map((b) => (
          <div key={b.label} className="grid gap-1">
            <div className="grid h-24 place-items-center rounded-lg border border-line p-3" style={{ background: b.color }}>
              {url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={url} alt={`${title} sobre ${b.label}`} className={cx("max-h-14 max-w-full object-contain", working && "opacity-50")} />
              ) : (
                <span className="text-[11.5px]" style={{ color: b.color === "#ffffff" ? "#69717b" : "#a6afb9" }}>
                  Sem logomarca
                </span>
              )}
            </div>
            <span className="text-[11.5px] text-muted">{b.label}</span>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <input ref={input} id={id} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} />
        <label htmlFor={id} className={cx(buttonVariants.secondary, "cursor-pointer", working && "pointer-events-none opacity-60")}>
          <ImagePlus size={16} aria-hidden /> {working ? "Enviando…" : url ? "Substituir" : "Enviar logomarca"}
        </label>
        {url && !working && (
          <button type="button" onClick={remove} className={buttonVariants.danger}>
            <Trash2 size={15} aria-hidden /> Remover
          </button>
        )}
      </div>
      <p className="text-[11.5px] text-muted">A imagem é ajustada automaticamente (até 640×200 px), mantendo a proporção.</p>
      {notice && <NoticeDialog tone={notice.tone} message={notice.message} onClose={() => setNotice(null)} />}
    </section>
  );
}
