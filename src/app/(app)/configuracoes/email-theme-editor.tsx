"use client";

import { ImageUp, RotateCcw, Trash2 } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { ActionForm, FormBar, SubmitButton } from "@/components/forms";
import { Alert, Field, Input, buttonVariants, cx } from "@/components/ui";
import { DEFAULT_EMAIL_THEME, EMAIL_LAYOUTS, EMAIL_LIMITS, fromHeader, type EmailTheme } from "@/lib/email-settings";
import { buttonColor, emailLogo, renderEmail, type EmailRow } from "@/lib/email/templates";
import { createClient } from "@/lib/supabase/client";
import { saveEmailTheme } from "./actions";
import { toPng } from "./certificate-editor";
import { HexField } from "./tag-editor";

const SAMPLES: { key: string; label: string; row: EmailRow }[] = [
  {
    key: "matricula",
    label: "Matrícula",
    row: { kind: "matricula", subject: "Nova trilha: Onboarding Comercial", data: { name: "Vera", title: "Nova trilha: Onboarding Comercial", body: "Prazo para concluir: 30/11/2026.", link: "/minhas-trilhas" } },
  },
  {
    key: "prazo",
    label: "Prazo chegando",
    row: { kind: "prazo_proximo", subject: "Prazo chegando: Onboarding Comercial", data: { name: "Vera", track: "Onboarding Comercial", days: 3, due: "30/11/2026", progress: 45, link: "/minhas-trilhas" } },
  },
  {
    key: "atraso",
    label: "Prazo vencido",
    row: { kind: "prazo_vencido", subject: "Prazo vencido: Onboarding Comercial", data: { name: "Vera", track: "Onboarding Comercial", due: "30/11/2026", progress: 60, mandatory: true, link: "/minhas-trilhas" } },
  },
  {
    key: "equipe",
    label: "Atraso na equipe",
    row: { kind: "equipe_atraso", subject: "Atraso na equipe: Vera Vendedora", data: { name: "Sérgio", person: "Vera Vendedora", track: "Onboarding Comercial", due: "30/11/2026", progress: 60, mandatory: true, link: "/colaboradores" } },
  },
  {
    key: "comunicado",
    label: "Comunicado",
    row: { kind: "comunicado", subject: "Mudança no horário do suporte", data: { name: "Vera", title: "Mudança no horário do suporte", body: "A partir de segunda o suporte atende das 8h às 18h.", link: "/comunicados" } },
  },
  {
    key: "resumo",
    label: "Resumo semanal",
    row: {
      kind: "resumo_semanal",
      subject: "Resumo semanal da sua equipe",
      data: {
        name: "Sérgio",
        week: "16/11/2026",
        late: 1,
        open: 2,
        done: 1,
        link: "/acompanhamento",
        rows: [
          { person: "Vera Vendedora", track: "Onboarding Comercial", progress: 30, due: "12/11/2026", late: true },
          { person: "Carlos Lima", track: "Produtos", progress: 55, due: "30/11/2026" },
          { person: "Ana Souza", track: "Cultura", progress: 100, due: "10/11/2026", done: true },
        ],
      },
    },
  },
];

function Pills<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: { value: T; label: string; hint?: string }[]; onChange: (v: T) => void }) {
  return (
    <fieldset className="grid gap-1.5">
      <legend className="mb-1.5 text-[12.5px] font-semibold text-heading">{label}</legend>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => (
          <label
            key={o.value}
            title={o.hint}
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

/** Visual dos e-mails, com prévia ao vivo de cada tipo de mensagem. */
export function EmailThemeEditor({
  initial,
  brandColor,
  brandLogo,
  storageBase,
  siteUrl,
  address,
}: {
  initial: EmailTheme;
  brandColor: string;
  brandLogo: { onLight: string | null; onDark: string | null };
  storageBase: string;
  siteUrl: string;
  /** Endereço do EMAIL_FROM (sem o nome), ou "" quando não configurado. */
  address: string;
}) {
  const [t, setT] = useState<EmailTheme>(initial);
  const [sample, setSample] = useState(SAMPLES[0].key);
  const [upload, setUpload] = useState<{ busy: boolean; error?: string }>({ busy: false });
  const file = useRef<HTMLInputElement>(null);
  const set = <K extends keyof EmailTheme>(k: K, v: EmailTheme[K]) => setT((x) => ({ ...x, [k]: v }));
  const changed = JSON.stringify(t) !== JSON.stringify(DEFAULT_EMAIL_THEME);

  const preview = useMemo(() => {
    const row = SAMPLES.find((s) => s.key === sample)!.row;
    const logoUrl = emailLogo(t, brandLogo, storageBase);
    return renderEmail(row, { siteUrl, appName: "Onboarding Implantta", brand: brandColor, logoUrl, theme: t });
  }, [t, sample, brandLogo, storageBase, siteUrl, brandColor]);

  async function onLogo(f: File | undefined) {
    if (!f) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(f.type)) return setUpload({ busy: false, error: "Envie uma imagem PNG, JPG ou WebP." });
    if (f.size > 5 * 1024 * 1024) return setUpload({ busy: false, error: "A imagem passa de 5 MB." });
    setUpload({ busy: true });
    try {
      const blob = await toPng(f, 1200, 400);
      const path = `logo/${crypto.randomUUID()}.png`;
      const { error } = await createClient().storage.from("branding").upload(path, blob, { contentType: "image/png" });
      if (error) throw error;
      setT((x) => ({ ...x, logoSource: "propria", logoPath: path }));
      setUpload({ busy: false });
    } catch {
      setUpload({ busy: false, error: "Não foi possível enviar a imagem. Tente de novo." });
    } finally {
      if (file.current) file.current.value = "";
    }
  }

  const sender = address ? fromHeader(address, t.senderName) : `"${t.senderName}" <endereço do EMAIL_FROM>`;

  return (
    <ActionForm action={saveEmailTheme}>
      <FormBar info={changed ? "Visual personalizado" : "Visual padrão"}>
        <button type="button" onClick={() => setT(DEFAULT_EMAIL_THEME)} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-[13px] font-medium text-muted hover:bg-sunken hover:text-ink">
          <RotateCcw size={15} aria-hidden /> Restaurar padrão
        </button>
        <SubmitButton>Salvar visual</SubmitButton>
      </FormBar>
      <input type="hidden" name="theme" value={JSON.stringify(t)} />

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,460px)] 2xl:grid-cols-[minmax(0,1fr)_minmax(0,600px)]">
        <div className="grid content-start gap-6">
          <section className="grid gap-3">
            <h3 className="text-[14px] font-semibold text-heading">Remetente</h3>
            <Field label="Nome que aparece na caixa de entrada" htmlFor="em-sender" hint={`Como chega: ${sender}`}>
              <Input id="em-sender" value={t.senderName} maxLength={EMAIL_LIMITS.senderName} onChange={(e) => set("senderName", e.target.value)} placeholder="Onboarding Implantta" />
            </Field>
          </section>

          <section className="grid gap-3">
            <h3 className="text-[14px] font-semibold text-heading">Layout</h3>
            <div className="flex flex-wrap gap-2">
              {EMAIL_LAYOUTS.map((l) => (
                <label
                  key={l.key}
                  className={cx(
                    "min-w-[140px] flex-1 cursor-pointer rounded-xl border px-3 py-2.5 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand",
                    t.layout === l.key ? "border-accent bg-accent-soft" : "border-line hover:border-accent/50",
                  )}
                >
                  <input type="radio" className="sr-only" checked={t.layout === l.key} onChange={() => set("layout", l.key)} />
                  <span className="block text-[13.5px] font-semibold text-heading">{l.label}</span>
                  <span className="block text-[12px] text-muted">{l.hint}</span>
                </label>
              ))}
            </div>
          </section>

          <section className="grid gap-3">
            <h3 className="text-[14px] font-semibold text-heading">Logomarca</h3>
            <Pills
              label="Qual logo usar"
              value={t.logoSource}
              options={[
                { value: "marca", label: "Logo da Marca" },
                { value: "propria", label: "Logo própria dos e-mails" },
                { value: "nenhuma", label: "Sem logo (só o nome)" },
              ]}
              onChange={(v) => set("logoSource", v)}
            />
            {t.logoSource === "propria" && (
              <div className="flex flex-wrap items-center gap-2">
                <label className={cx(buttonVariants.secondary, "cursor-pointer py-1.5 text-[13px]", upload.busy && "opacity-60")}>
                  <ImageUp size={15} aria-hidden /> {upload.busy ? "Enviando…" : t.logoPath ? "Trocar logo" : "Enviar logo"}
                  <input ref={file} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" disabled={upload.busy} onChange={(e) => onLogo(e.target.files?.[0])} />
                </label>
                {t.logoPath && (
                  <button type="button" onClick={() => set("logoPath", null)} className={cx(buttonVariants.ghost, "py-1.5 text-[13px] text-danger")}>
                    <Trash2 size={15} aria-hidden /> Remover
                  </button>
                )}
                <span className="text-[12px] text-muted">PNG com fundo transparente fica melhor.</span>
              </div>
            )}
            {upload.error && <Alert>{upload.error}</Alert>}
            {t.logoSource !== "nenhuma" && (
              <div className="flex flex-wrap items-start gap-x-6 gap-y-3">
                <Field label={`Altura da logo: ${t.logoHeight} px`} htmlFor="em-logo-h">
                  <input id="em-logo-h" type="range" style={{ minWidth: 180 }} min={20} max={80} step={2} value={t.logoHeight} onChange={(e) => set("logoHeight", Number(e.target.value))} className="w-full accent-[rgb(var(--brand))]" />
                </Field>
                <Pills
                  label="Posição"
                  value={t.logoAlign}
                  options={[
                    { value: "esquerda", label: "À esquerda" },
                    { value: "centro", label: "Centralizada" },
                  ]}
                  onChange={(v) => set("logoAlign", v)}
                />
              </div>
            )}
          </section>

          <section className="grid gap-3">
            <h3 className="text-[14px] font-semibold text-heading">Cores</h3>
            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
              <HexField label={t.layout === "faixa" ? "Faixa do cabeçalho" : "Fundo do cabeçalho"} value={t.header} onChange={(v) => set("header", v)} />
              <div className="grid gap-1">
                {t.accent ? (
                  <HexField label="Botão e destaques" value={t.accent} onChange={(v) => set("accent", v)} />
                ) : (
                  <span className="rounded-lg border border-dashed border-line px-3 py-2 text-[12.5px] text-muted">Botão e destaques: cor da marca ({buttonColor(brandColor)})</span>
                )}
                <label className="flex items-center gap-1.5 text-[12.5px] text-ink">
                  <input type="checkbox" checked={!t.accent} onChange={(e) => set("accent", e.target.checked ? "" : buttonColor(brandColor))} className="h-4 w-4 accent-[rgb(var(--brand))]" />
                  Usar a cor da marca
                </label>
              </div>
              <HexField label="Texto" value={t.text} onChange={(v) => set("text", v)} />
              <HexField label="Fundo do e-mail" value={t.background} onChange={(v) => set("background", v)} />
              {t.layout !== "minimalista" && <HexField label="Fundo do cartão" value={t.card} onChange={(v) => set("card", v)} />}
            </div>
            <p className="text-[12px] text-muted">O texto do botão fica branco ou escuro sozinho, conforme a cor escolhida, para continuar legível.</p>
          </section>

          <section className="grid gap-3">
            <h3 className="text-[14px] font-semibold text-heading">Textos</h3>
            <Field label="Saudação" htmlFor="em-greeting" hint="{nome} vira o primeiro nome da pessoa. Deixe vazio para não ter saudação.">
              <Input id="em-greeting" value={t.greeting} maxLength={EMAIL_LIMITS.greeting} onChange={(e) => set("greeting", e.target.value)} placeholder="Olá, {nome}!" />
            </Field>
            <Field label="Assinatura" htmlFor="em-signature" hint="Aparece no fim de todos os e-mails.">
              <Input id="em-signature" value={t.signature} maxLength={EMAIL_LIMITS.signature} onChange={(e) => set("signature", e.target.value)} placeholder="Equipe de Onboarding Implantta" />
            </Field>
            <Field label="Rodapé" htmlFor="em-footer" hint={`Ex.: endereço, telefone ou canal de dúvidas. ${t.footer.length}/${EMAIL_LIMITS.footer}`}>
              <textarea
                id="em-footer"
                rows={3}
                value={t.footer}
                maxLength={EMAIL_LIMITS.footer}
                onChange={(e) => set("footer", e.target.value)}
                className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-[14px] text-ink focus:border-accent focus:outline-none"
                placeholder="Dúvidas? Fale com o RH: rh@implanttasistemas.com.br"
              />
            </Field>
          </section>
        </div>

        <div className="grid content-start gap-3 xl:sticky xl:top-24">
          <Pills label="Prévia" value={sample} options={SAMPLES.map((s) => ({ value: s.key, label: s.label }))} onChange={setSample} />
          <div className="overflow-hidden rounded-xl border border-line bg-surface">
            <div className="grid gap-0.5 border-b border-line px-4 py-2.5 text-[12.5px]">
              <p className="truncate">
                <span className="text-muted">De: </span>
                <strong className="text-heading">{t.senderName || "(sem nome)"}</strong>
                {address && <span className="text-muted"> &lt;{fromHeader(address, "")}&gt;</span>}
              </p>
              <p className="truncate">
                <span className="text-muted">Assunto: </span>
                <span className="text-ink">{preview.subject}</span>
              </p>
            </div>
            <iframe title="Prévia do e-mail" sandbox="" srcDoc={preview.html} className="block h-[620px] w-full bg-white" />
          </div>
        </div>
      </div>
    </ActionForm>
  );
}
