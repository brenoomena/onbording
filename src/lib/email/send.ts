import "server-only";
import { after } from "next/server";
import { getBranding, logoFor } from "@/lib/branding";
import { publicEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveTheme } from "@/lib/theme-tokens";
import { fromHeader, sanitizeEmailSettings } from "@/lib/email-settings";
import { emailLogo, renderEmail, type EmailContext } from "./templates";

/** O que falta para os e-mails saírem (sem mostrar nenhum valor). */
export function emailConfig() {
  return {
    apiKey: !!process.env.RESEND_API_KEY,
    from: !!process.env.EMAIL_FROM,
    cron: !!process.env.CRON_SECRET,
    serviceRole: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
  };
}
export const emailReady = () => {
  const c = emailConfig();
  return c.apiKey && c.from && c.serviceRole;
};

const STALE_MS = 7 * 24 * 60 * 60 * 1000;

export const BRANDING_STORAGE = () => `${publicEnv.supabaseUrl.replace(/\/$/, "")}/storage/v1/object/public/branding`;

async function context(): Promise<{ ctx: EmailContext; from: string }> {
  const b = await getBranding();
  const { data } = await createAdminClient().from("app_settings").select("email_settings").eq("id", 1).maybeSingle();
  const theme = sanitizeEmailSettings(data?.email_settings).theme;
  const logoUrl = emailLogo(theme, { onLight: logoFor(b, "#ffffff")?.src ?? null, onDark: logoFor(b, "#0f172a")?.src ?? null }, BRANDING_STORAGE());
  return {
    ctx: { siteUrl: publicEnv.siteUrl, appName: "Onboarding Implantta", brand: resolveTheme(b.theme).light.brand, logoUrl, theme },
    from: fromHeader(process.env.EMAIL_FROM ?? "", theme.senderName),
  };
}

export interface FlushResult {
  configured: boolean;
  sent: number;
  failed: number;
  skipped: number;
  lastError?: string;
}

/**
 * Envia o que está na fila (até `limit`). Cada e-mail vai com uma chave de
 * idempotência = id da fila, então um reenvio não duplica a mensagem.
 */
export async function flushOutbox(limit = 50): Promise<FlushResult> {
  if (!emailReady()) return { configured: false, sent: 0, failed: 0, skipped: 0 };
  const supabase = createAdminClient();
  const { data: batch, error } = await supabase.rpc("claim_email_batch", { p_limit: limit });
  if (error) return { configured: true, sent: 0, failed: 0, skipped: 0, lastError: error.message };
  const rows = (batch ?? []) as { id: string; kind: string; subject: string; data: Record<string, unknown>; to_email: string; created_at: string }[];
  if (!rows.length) return { configured: true, sent: 0, failed: 0, skipped: 0 };

  const { ctx, from } = await context();
  const out: FlushResult = { configured: true, sent: 0, failed: 0, skipped: 0 };
  for (const row of rows) {
    if (Date.now() - new Date(row.created_at).getTime() > STALE_MS) {
      await supabase.from("email_outbox").update({ status: "ignorado", last_error: "Mais de 7 dias na fila." }).eq("id", row.id);
      out.skipped++;
      continue;
    }
    const mail = renderEmail(row, ctx);
    try {
      const res = await fetch(process.env.RESEND_API_URL ?? "https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${(process.env.RESEND_API_KEY ?? "").trim()}`,
          "Content-Type": "application/json",
          "Idempotency-Key": `outbox-${row.id}`,
        },
        body: JSON.stringify({ from, to: [row.to_email], subject: mail.subject, html: mail.html, text: mail.text }),
        signal: AbortSignal.timeout(15_000),
      });
      const body = (await res.json().catch(() => ({}))) as { id?: string; message?: string; name?: string };
      if (!res.ok) throw new Error(body.message ?? `Resend respondeu ${res.status}.`);
      await supabase.from("email_outbox").update({ status: "enviado", sent_at: new Date().toISOString(), provider_id: body.id ?? null, last_error: null }).eq("id", row.id);
      out.sent++;
    } catch (e) {
      const msg = (e instanceof Error ? e.message : String(e)).slice(0, 500);
      await supabase.from("email_outbox").update({ status: "erro", last_error: msg }).eq("id", row.id);
      out.failed++;
      out.lastError = msg;
    }
  }
  return out;
}

/** Depois de responder ao usuário, tenta mandar o que entrou na fila. */
export function kickEmails() {
  if (!emailReady()) return;
  try {
    after(() => flushOutbox(30).then(() => undefined, () => undefined));
  } catch {
    // Fora de uma requisição (ex.: testes): o envio do dia cuida da fila.
  }
}
