"use client";

import { FileDown, ImageUp, RotateCcw, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { CertificateView } from "@/components/certificate-view";
import { ActionForm, FormBar, SubmitButton } from "@/components/forms";
import { Alert, Field, Input, Textarea, buttonVariants, cx } from "@/components/ui";
import { CERT_LIMITS, DEFAULT_CERTIFICATE, SAMPLE_CERTIFICATE, diffCertificate, type CertificateTheme, type NameStyle } from "@/lib/certificate";
import { createClient } from "@/lib/supabase/client";
import { saveCertificateTheme } from "./actions";

const HEX = /^#[0-9a-f]{6}$/i;
const MARKERS: [string, string][] = [
  ["{trilha}", "nome da trilha"],
  ["{carga}", "carga horária"],
  ["{data}", "data de conclusão"],
  ["{media}", "média nas avaliações"],
  ["{nome}", "nome da pessoa"],
];

/** Imagem da assinatura em PNG (mantém a transparência), com no máximo 900 px de largura. */
async function toPng(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 900 / bitmap.width, 300 / bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/png"));
  if (!blob) throw new Error("png");
  return blob;
}

export function CertificateEditor({
  initial,
  logoUrl,
  storageBase,
  validationBase,
}: {
  initial: CertificateTheme;
  logoUrl: string | null;
  /** Endereço público do bucket "branding" (para mostrar a assinatura enviada). */
  storageBase: string;
  validationBase: string;
}) {
  const [t, setT] = useState<CertificateTheme>(initial);
  const [upload, setUpload] = useState<{ busy: boolean; error?: string }>({ busy: false });
  const file = useRef<HTMLInputElement>(null);
  const body = useRef<HTMLTextAreaElement>(null);
  const set = <K extends keyof CertificateTheme>(k: K, v: CertificateTheme[K]) => setT((x) => ({ ...x, [k]: v }));
  const custom = Object.keys(diffCertificate(t)).length;
  const signatureUrl = t.signaturePath ? `${storageBase}/${t.signaturePath}` : null;

  async function onSignature(f: File | undefined) {
    if (!f) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(f.type)) {
      setUpload({ busy: false, error: "Envie uma imagem PNG, JPG ou WebP. PNG com fundo transparente fica melhor." });
      return;
    }
    if (f.size > 5 * 1024 * 1024) {
      setUpload({ busy: false, error: "A imagem passa de 5 MB." });
      return;
    }
    setUpload({ busy: true });
    try {
      const blob = await toPng(f);
      const path = `logo/${crypto.randomUUID()}.png`;
      const { error } = await createClient().storage.from("branding").upload(path, blob, { contentType: "image/png" });
      if (error) throw error;
      set("signaturePath", path);
      setUpload({ busy: false });
    } catch {
      setUpload({ busy: false, error: "Não foi possível enviar a imagem. Tente de novo." });
    } finally {
      if (file.current) file.current.value = "";
    }
  }

  function insertMarker(m: string) {
    const el = body.current;
    if (!el) return set("body", `${t.body} ${m}`.slice(0, CERT_LIMITS.body));
    const start = el.selectionStart ?? t.body.length;
    const end = el.selectionEnd ?? start;
    const next = `${t.body.slice(0, start)}${m}${t.body.slice(end)}`.slice(0, CERT_LIMITS.body);
    set("body", next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + m.length, start + m.length);
    });
  }

  return (
    <ActionForm action={saveCertificateTheme}>
      <FormBar info={custom ? `${custom} ${custom === 1 ? "ajuste personalizado" : "ajustes personalizados"}` : "Usando o modelo padrão"}>
        <button
          type="button"
          onClick={() => setT({ ...DEFAULT_CERTIFICATE, signaturePath: t.signaturePath })}
          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-[13px] font-medium text-muted hover:bg-sunken hover:text-ink"
        >
          <RotateCcw size={15} aria-hidden /> Restaurar padrão
        </button>
        <a href="/configuracoes/certificado/exemplo" target="_blank" rel="noreferrer" className={cx(buttonVariants.secondary, "py-2 text-[13px]")} title="Usa o modelo salvo">
          <FileDown size={15} aria-hidden /> PDF de exemplo
        </a>
        <SubmitButton>Salvar certificado</SubmitButton>
      </FormBar>
      <input type="hidden" name="certificate" value={JSON.stringify(t)} />

      <div className="grid gap-2">
        <p className="text-[12.5px] font-semibold text-muted">Prévia ao vivo (dados de exemplo)</p>
        <div className="rounded-2xl border border-line bg-sunken/60 p-3 sm:p-5">
          <CertificateView
            theme={t}
            data={SAMPLE_CERTIFICATE}
            logoUrl={logoUrl}
            signatureUrl={signatureUrl}
            validationUrl={`${validationBase}/certificado/${SAMPLE_CERTIFICATE.code}`}
            className="mx-auto w-full max-w-[920px]"
          />
        </div>
        {!logoUrl && <p className="text-[12px] text-muted">Sem logomarca cadastrada: o certificado sai sem logo. Cadastre em Marca.</p>}
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <Group title="Textos">
          <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(180px,1fr))]">
            <Field label="Título" htmlFor="ct-title">
              <Input id="ct-title" value={t.title} maxLength={CERT_LIMITS.title} required onChange={(e) => set("title", e.target.value)} />
            </Field>
            <Field label="Subtítulo" htmlFor="ct-subtitle">
              <Input id="ct-subtitle" value={t.subtitle} maxLength={CERT_LIMITS.subtitle} onChange={(e) => set("subtitle", e.target.value)} />
            </Field>
          </div>
          <Field label="Antes do nome" htmlFor="ct-intro">
            <Input id="ct-intro" value={t.intro} maxLength={CERT_LIMITS.intro} onChange={(e) => set("intro", e.target.value)} />
          </Field>
          <Field label="Texto principal" htmlFor="ct-body" hint="Os marcadores são trocados pelos dados de cada pessoa. Sem carga horária, a parte “com carga horária de {carga}” sai sozinha.">
            <Textarea ref={body} id="ct-body" rows={3} value={t.body} maxLength={CERT_LIMITS.body} onChange={(e) => set("body", e.target.value)} />
          </Field>
          <div className="flex flex-wrap gap-1.5">
            {MARKERS.map(([m, label]) => (
              <button key={m} type="button" onClick={() => insertMarker(m)} title={`Inserir ${label}`} className="rounded-md border border-line bg-surface px-2 py-1 font-mono text-[12px] hover:border-accent/50 hover:text-accent">
                {m} <span className="font-sans text-muted">· {label}</span>
              </button>
            ))}
          </div>
          <Field label="Frase da média" htmlFor="ct-score" hint="Só aparece quando a trilha tem avaliação.">
            <Input id="ct-score" value={t.scoreText} maxLength={CERT_LIMITS.scoreText} onChange={(e) => set("scoreText", e.target.value)} />
          </Field>
        </Group>

        <div className="grid gap-4">
          <Group title="Mostrar no certificado">
            <Check label="Carga horária" hint="Da trilha (campo em Dados e público) ou a soma do tempo estimado dos conteúdos." checked={t.showHours} onChange={(v) => set("showHours", v)} />
            <Check label="Média nas avaliações" hint="Melhor nota de cada avaliação da trilha." checked={t.showScore} onChange={(v) => set("showScore", v)} />
            <Check label="QR code de validação" hint="Leva à página pública que confirma o certificado." checked={t.showQr} onChange={(v) => set("showQr", v)} />
          </Group>

          <Group title="Aparência">
            <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(150px,1fr))]">
              <Color id="ct-primary" label="Cor principal" value={t.primary} onChange={(v) => set("primary", v)} />
              <Color id="ct-accent" label="Cor de destaque" value={t.accent} onChange={(v) => set("accent", v)} />
              <Color id="ct-ink" label="Cor do texto" value={t.ink} onChange={(v) => set("ink", v)} />
            </div>
            <fieldset className="grid gap-1.5">
              <legend className="mb-1 text-[13px] font-medium">Letra do nome</legend>
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    ["serifada", "Serifada (clássica)", "'Times New Roman', serif"],
                    ["sem_serifa", "Sem serifa (moderna)", "Helvetica, Arial, sans-serif"],
                  ] as [NameStyle, string, string][]
                ).map(([k, label, font]) => (
                  <label
                    key={k}
                    className={cx("flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-[13px]", t.nameStyle === k ? "border-brand bg-accent-soft/60 text-accent" : "border-line hover:border-accent/40")}
                  >
                    <input type="radio" name="ct-name" checked={t.nameStyle === k} onChange={() => set("nameStyle", k)} className="h-4 w-4 accent-[rgb(var(--brand))]" />
                    <span style={{ fontFamily: font, fontStyle: k === "serifada" ? "italic" : "normal", fontWeight: 700 }}>{label}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          </Group>

          <Group title="Assinatura">
            <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(180px,1fr))]">
              <Field label="Nome de quem assina" htmlFor="ct-signer">
                <Input id="ct-signer" value={t.signerName} maxLength={CERT_LIMITS.signerName} onChange={(e) => set("signerName", e.target.value)} placeholder="Ex.: Breno Omena" />
              </Field>
              <Field label="Cargo" htmlFor="ct-role">
                <Input id="ct-role" value={t.signerRole} maxLength={CERT_LIMITS.signerRole} onChange={(e) => set("signerRole", e.target.value)} placeholder="Ex.: Diretor de Operações" />
              </Field>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="grid h-16 w-44 place-items-center rounded-lg border border-dashed border-line bg-white">
                {signatureUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={signatureUrl} alt="Assinatura" className="max-h-14 max-w-40 object-contain" />
                ) : (
                  <span className="text-[12px] text-slate-400">Sem imagem</span>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <label className={cx(buttonVariants.secondary, "cursor-pointer py-1.5 text-[13px]")}>
                  <ImageUp size={15} aria-hidden /> {upload.busy ? "Enviando…" : signatureUrl ? "Trocar imagem" : "Enviar imagem da assinatura"}
                  <input ref={file} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(e) => onSignature(e.target.files?.[0])} disabled={upload.busy} />
                </label>
                {signatureUrl && (
                  <button type="button" onClick={() => set("signaturePath", null)} className={cx(buttonVariants.ghost, "py-1.5 text-[13px] text-danger")}>
                    <Trash2 size={15} aria-hidden /> Remover
                  </button>
                )}
              </div>
            </div>
            <p className="text-[12px] text-muted">PNG com fundo transparente fica melhor. A imagem só vale depois de salvar.</p>
            {upload.error && <Alert>{upload.error}</Alert>}
          </Group>
        </div>
      </div>
    </ActionForm>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="grid content-start gap-3 rounded-xl border border-line p-4">
      <legend className="px-1 text-[13px] font-semibold">{title}</legend>
      {children}
    </fieldset>
  );
}

function Check({ label, hint, checked, onChange }: { label: string; hint: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 text-[13.5px]">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[rgb(var(--brand))]" />
      <span>
        {label}
        <span className="block text-[12px] text-muted">{hint}</span>
      </span>
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
