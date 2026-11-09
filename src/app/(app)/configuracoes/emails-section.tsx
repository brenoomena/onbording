import { CheckCircle2, Mail, MailCheck, Palette, Send, XCircle } from "lucide-react";
import { ActionButton, ActionForm, FormBar, SubmitButton } from "@/components/forms";
import { Badge, Card, cx, formatDateTime } from "@/components/ui";
import { EMAIL_KINDS, REMINDER_OPTIONS, reminderLabel, sanitizeEmailSettings } from "@/lib/email-settings";
import { BRANDING_STORAGE, emailConfig } from "@/lib/email/send";
import { fromHeader } from "@/lib/email-settings";
import { getBranding, logoFor } from "@/lib/branding";
import { publicEnv } from "@/lib/env";
import { resolveTheme } from "@/lib/theme-tokens";
import { EmailThemeEditor } from "./email-theme-editor";
import { createClient } from "@/lib/supabase/server";
import type { TagKey } from "@/lib/tag-catalog";
import { saveEmailSettings, sendTestEmail } from "./actions";

const KIND_LABEL: Record<string, string> = {
  matricula: "Matrícula",
  prazo_proximo: "Prazo chegando",
  prazo_vencido: "Prazo vencido",
  comunicado: "Comunicado",
  resumo_semanal: "Resumo semanal",
  equipe_atraso: "Atraso na equipe",
  tarefas_dia: "Tarefas do dia",
  teste: "Teste",
};
const STATUS_LABEL: Record<string, string> = { pendente: "Na fila", enviando: "Enviando", enviado: "Enviado", erro: "Erro", ignorado: "Não enviado" };

/** Configurações › E-mails: situação do envio, o que é enviado e o histórico. */
export async function EmailsSection({ raw }: { raw: unknown }) {
  const settings = sanitizeEmailSettings(raw);
  const cfg = emailConfig();
  const supabase = await createClient();
  const [{ data: log }, { count: queued }] = await Promise.all([
    supabase.from("email_outbox").select("id, to_email, kind, subject, status, attempts, last_error, created_at, sent_at").order("created_at", { ascending: false }).limit(40),
    supabase.from("email_outbox").select("id", { count: "exact", head: true }).in("status", ["pendente", "erro", "enviando"]),
  ]);
  const ready = cfg.apiKey && cfg.from && cfg.serviceRole;
  const b = await getBranding();
  const address = process.env.EMAIL_FROM ? fromHeader(process.env.EMAIL_FROM, "") : "";
  const item = (ok: boolean, label: string, hint: string) => (
    <li className="flex items-start gap-2.5">
      {ok ? <CheckCircle2 size={18} aria-hidden className="mt-0.5 shrink-0 text-ok" /> : <XCircle size={18} aria-hidden className="mt-0.5 shrink-0 text-danger" />}
      <span>
        <span className="font-medium text-heading">{label}</span>
        <span className="block text-[12.5px] text-muted">{hint}</span>
      </span>
    </li>
  );

  return (
    <>
      <Card
        title="Envio de e-mails"
        description="Os e-mails saem pelo Resend. As chaves ficam na Vercel (Settings › Environment Variables) e nunca aparecem aqui."
        icon={MailCheck}
        actions={ready ? <ActionButton action={sendTestEmail} hidden={{}} label="Enviar e-mail de teste para mim" icon={<Send size={15} aria-hidden />} variant="secondary" /> : undefined}
      >
        <ul className="grid gap-3 text-[13.5px] md:grid-cols-2">
          {item(cfg.apiKey, "RESEND_API_KEY", "Chave de API criada no Resend (permissão de envio).")}
          {item(cfg.from, "EMAIL_FROM", 'Remetente com domínio verificado no Resend, ex.: "Onboarding Implantta <onboarding@implanttasistemas.com.br>".')}
          {item(cfg.cron, "CRON_SECRET", "Senha da tarefa diária (8h) que gera os lembretes de prazo, atraso e o resumo semanal.")}
          {item(cfg.serviceRole, "SUPABASE_SERVICE_ROLE_KEY", "Já usada pelo sistema para ler a fila.")}
        </ul>
        <p className={cx("mt-4 rounded-lg px-3 py-2 text-[13px]", ready ? "bg-ok/10 text-ink" : "bg-warn/10 text-ink")}>
          {ready
            ? `Envio ativo. ${queued ? `${queued} e-mail(s) aguardando na fila.` : "Nenhum e-mail aguardando."}`
            : `Envio desligado: os e-mails ficam guardados na fila (${queued ?? 0} agora) e saem quando a configuração estiver completa. Os que passarem de 7 dias na fila são descartados.`}
        </p>
      </Card>

      <Card
        title="Visual dos e-mails"
        description="Nome do remetente, layout, logomarca, cores e textos de todas as mensagens. A prévia ao lado mostra cada tipo de e-mail antes de salvar."
        icon={Palette}
      >
        <EmailThemeEditor
          initial={settings.theme}
          brandColor={resolveTheme(b.theme).light.brand}
          brandLogo={{ onLight: logoFor(b, "#ffffff")?.src ?? null, onDark: logoFor(b, "#0f172a")?.src ?? null }}
          storageBase={BRANDING_STORAGE()}
          siteUrl={publicEnv.siteUrl}
          address={address}
        />
      </Card>

      <Card title="O que é enviado" description="Vale para todos. Cada pessoa ainda pode desligar lembretes, comunicados e o resumo em Meu perfil; matrícula nova e atraso de trilha obrigatória sempre são enviados." icon={Mail}>
        <ActionForm action={saveEmailSettings}>
          <FormBar info="E-mails automáticos">
            <SubmitButton>Salvar</SubmitButton>
          </FormBar>
          <fieldset className="grid gap-2">
            <legend className="sr-only">Tipos de e-mail</legend>
            {EMAIL_KINDS.map((k) => (
              <label key={k.key} className="flex cursor-pointer items-start gap-3 rounded-xl border border-line px-4 py-3 hover:border-accent/50">
                <input type="checkbox" name={`kind_${k.key}`} defaultChecked={settings.kinds[k.key]} className="mt-0.5 h-[18px] w-[18px] accent-[rgb(var(--brand))]" />
                <span>
                  <span className="font-medium text-heading">{k.label}</span>
                  <span className="block text-[12.5px] text-muted">{k.hint}</span>
                </span>
              </label>
            ))}
          </fieldset>
          <fieldset className="grid gap-2">
            <legend className="mb-1.5 text-[13px] font-semibold text-heading">Lembrete de prazo</legend>
            <div className="flex flex-wrap gap-2">
              {REMINDER_OPTIONS.map((d) => (
                <label key={d} className="flex cursor-pointer items-center gap-2 rounded-lg border border-line px-3 py-2 text-[13.5px] has-[:checked]:border-accent has-[:checked]:bg-accent-soft">
                  <input type="checkbox" name="reminder_days" value={d} defaultChecked={settings.reminderDays.includes(d)} className="h-4 w-4 accent-[rgb(var(--brand))]" />
                  {reminderLabel(d)}
                </label>
              ))}
            </div>
          </fieldset>
        </ActionForm>
      </Card>

      <Card title="Últimos e-mails" description="Os 40 mais recentes, de todos os tipos." icon={Send} flush>
        {!log?.length ? (
          <p className="px-5 py-4 text-[13px] text-muted">Nenhum e-mail gerado ainda.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-[13px]">
              <thead className="border-b border-line text-[12px] text-muted">
                <tr>
                  <th className="px-5 py-2.5 font-medium">Quando</th>
                  <th className="px-3 py-2.5 font-medium">Para</th>
                  <th className="px-3 py-2.5 font-medium">Tipo</th>
                  <th className="px-3 py-2.5 font-medium">Assunto</th>
                  <th className="px-5 py-2.5 font-medium">Situação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {log.map((e) => (
                  <tr key={e.id} className="align-top">
                    <td className="whitespace-nowrap px-5 py-2.5 text-muted">{formatDateTime(e.sent_at ?? e.created_at)}</td>
                    <td className="px-3 py-2.5">{e.to_email}</td>
                    <td className="whitespace-nowrap px-3 py-2.5">{KIND_LABEL[e.kind] ?? e.kind}</td>
                    <td className="px-3 py-2.5">{e.subject}</td>
                    <td className="px-5 py-2.5">
                      <Badge tag={`email.${e.status}` as TagKey}>{STATUS_LABEL[e.status] ?? e.status}</Badge>
                      {e.last_error && e.status !== "enviado" && <p className="mt-1 max-w-[260px] text-[12px] text-danger">{e.last_error}</p>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
