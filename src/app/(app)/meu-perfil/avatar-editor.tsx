"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { Avatar } from "@/components/avatar";
import { Alert, buttonVariants, cx } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { removeMyAvatar, setMyAvatar } from "./actions";

const SIZE = 320;

/** Recorta no centro, reduz para 320×320 e converte para WebP (fica com poucos KB). */
async function toSquareWebp(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas");
  ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, SIZE, SIZE);
  bitmap.close();
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/webp", 0.86));
  if (!blob) throw new Error("webp");
  return blob;
}

export function AvatarEditor({ userId, name, path }: { userId: string; name: string; path: string | null }) {
  const input = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function onFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    if (!file.type.startsWith("image/")) return setError("Escolha uma imagem (JPG, PNG ou WebP).");
    if (file.size > 15 * 1024 * 1024) return setError("A imagem passa de 15 MB. Escolha uma menor.");
    setBusy(true);
    try {
      const blob = await toSquareWebp(file);
      const newPath = `${userId}/${crypto.randomUUID()}.webp`;
      const { error: upErr } = await createClient().storage.from("avatars").upload(newPath, blob, { contentType: "image/webp" });
      if (upErr) throw upErr;
      const res = await setMyAvatar(newPath);
      if (res.error) throw new Error(res.error);
      startTransition(() => router.refresh());
    } catch {
      setError("Não foi possível enviar a foto. Tente de novo.");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  async function remove() {
    setBusy(true);
    const res = await removeMyAvatar();
    setBusy(false);
    if (res.error) setError(res.error);
    else startTransition(() => router.refresh());
  }

  const working = busy || pending;
  return (
    <div className="grid gap-3">
      <div className="flex items-center gap-4">
        <Avatar name={name} path={path} size={88} className={cx(working && "opacity-50")} />
        <div className="grid gap-2">
          <input ref={input} type="file" accept="image/*" className="sr-only" id="avatar-file" onChange={(e) => onFile(e.target.files?.[0])} />
          <label htmlFor="avatar-file" className={cx(buttonVariants.secondary, "w-fit cursor-pointer", working && "pointer-events-none opacity-60")}>
            {working ? "Enviando…" : path ? "Trocar foto" : "Enviar foto"}
          </label>
          {path && !working && (
            <button type="button" onClick={remove} className="w-fit text-left text-[13px] font-medium text-muted hover:text-danger">
              Remover foto
            </button>
          )}
        </div>
      </div>
      <p className="text-[12px] text-muted">A foto é recortada em quadrado. Sem foto, aparecem as iniciais do seu nome.</p>
      {error && <Alert>{error}</Alert>}
    </div>
  );
}
